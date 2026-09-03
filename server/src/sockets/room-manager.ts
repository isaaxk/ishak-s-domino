import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { Server, Socket } from 'socket.io';
import {
  GameState,
  GameSettings,
  PlayerState,
  DEFAULT_SETTINGS,
  DominoTile,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../shared/types.js';
import { DominoDatabase } from '../db/database.js';
import {
  startNewRound,
  stageTilePlacement,
  undoStagedTurn,
  confirmTurnAction,
  changeLastMoveAction,
  drawTileAction,
  passTurnAction,
  selectStartingPlayerAction,
  EngineSession,
} from '../engine/game-engine.js';
import { sanitizeStateForPlayer } from './sanitize.js';
import { validateGameConfig } from '../engine/domino-set.js';

export class RoomManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private db: DominoDatabase;

  // In-memory active game sessions
  private sessions: Map<string, EngineSession> = new Map();

  // Mapping socket ID to { roomId, playerId }
  private socketToPlayer: Map<string, { roomId: string; playerId: string }> = new Map();

  // Mapping playerId to socket ID
  private playerToSocket: Map<string, string> = new Map();

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>, db: DominoDatabase) {
    this.io = io;
    this.db = db;
  }

  // Generates 6-character room code e.g. "A7K9P2"
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  createRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    nickname: string,
    settingsInput?: Partial<GameSettings>
  ): { roomId: string; sessionToken: string; playerId: string } {
    let roomId = this.generateRoomCode();
    while (this.sessions.has(roomId) || this.db.getRoom(roomId)) {
      roomId = this.generateRoomCode();
    }

    const playerId = uuidv4();
    const sessionToken = uuidv4();
    const settings: GameSettings = { ...DEFAULT_SETTINGS, ...settingsInput };

    const hostPlayer: PlayerState = {
      id: playerId,
      nickname: nickname.trim() || 'Host',
      isHost: true,
      isReady: true,
      score: 0,
      seatIndex: 0,
      connected: true,
      tileCount: 0,
      hand: [],
    };

    const initialGameState: GameState = {
      roomId,
      phase: 'waiting_players',
      roundNumber: 0,
      currentTurnPlayerId: null,
      board: [],
      boneyardCount: 0,
      protectedBoneyardCount: settings.protectedBoneyardTiles,
      consecutivePasses: 0,
      pendingPlacements: [],
      settings,
      players: [hostPlayer],
      openEnds: [],
      currentOpenEndsSum: 0,
    };

    const session: EngineSession = {
      state: initialGameState,
      privateHands: { [playerId]: [] },
      boneyard: [],
    };

    this.sessions.set(roomId, session);

    // Persist to database
    this.db.saveRoom(roomId, playerId, settings, 'waiting');
    this.db.savePlayer(hostPlayer, roomId, sessionToken);

    // Bind socket
    this.bindSocketToPlayer(socket, roomId, playerId);

    socket.join(roomId);
    this.broadcastRoomState(roomId);

    return { roomId, sessionToken, playerId };
  }

  joinRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    roomId: string,
    nickname: string,
    sessionToken?: string
  ): { success: boolean; isHost?: boolean; sessionToken?: string; playerId?: string; error?: string } {
    const cleanRoomId = roomId.trim().toUpperCase();

    // 1. Check for active session or load from DB
    let session = this.sessions.get(cleanRoomId);
    if (!session) {
      const persisted = this.db.getGameState(cleanRoomId);
      const persistedRoom = this.db.getRoom(cleanRoomId);
      if (persisted && persistedRoom) {
        session = {
          state: persisted.state,
          privateHands: persisted.privateHands,
          boneyard: persisted.boneyard,
        };
        this.sessions.set(cleanRoomId, session);
      } else if (persistedRoom) {
        // Room exists in waiting phase
        const { players } = this.db.getRoomPlayers(cleanRoomId);
        session = {
          state: {
            roomId: cleanRoomId,
            phase: 'waiting_players',
            roundNumber: 0,
            currentTurnPlayerId: null,
            board: [],
            boneyardCount: 0,
            protectedBoneyardCount: persistedRoom.settings.protectedBoneyardTiles,
            consecutivePasses: 0,
            pendingPlacements: [],
            settings: persistedRoom.settings,
            players,
            openEnds: [],
            currentOpenEndsSum: 0,
          },
          privateHands: {},
          boneyard: [],
        };
        this.sessions.set(cleanRoomId, session);
      } else {
        return { success: false, error: `Room ${cleanRoomId} not found` };
      }
    }

    const { state } = session;

    // 2. Reconnection via sessionToken
    if (sessionToken) {
      const existingPlayer = this.db.getPlayerByToken(sessionToken);
      if (existingPlayer && existingPlayer.room_id === cleanRoomId) {
        const pState = state.players.find((p) => p.id === existingPlayer.id);
        if (pState) {
          pState.connected = true;
          this.bindSocketToPlayer(socket, cleanRoomId, pState.id);
          socket.join(cleanRoomId);

          this.db.savePlayer(pState, cleanRoomId, sessionToken);
          this.broadcastRoomState(cleanRoomId);

          return {
            success: true,
            isHost: pState.isHost,
            sessionToken,
            playerId: pState.id,
          };
        }
      }
    }

    // 3. New player joining
    if (state.phase !== 'waiting_players') {
      return { success: false, error: 'Game is already in progress in this room' };
    }

    if (state.players.length >= state.settings.maxPlayers) {
      return { success: false, error: `Room is full (max ${state.settings.maxPlayers} players)` };
    }

    const playerId = uuidv4();
    const newSessionToken = uuidv4();
    const newPlayer: PlayerState = {
      id: playerId,
      nickname: nickname.trim() || `Player ${state.players.length + 1}`,
      isHost: state.players.length === 0,
      isReady: false,
      score: 0,
      seatIndex: state.players.length,
      connected: true,
      tileCount: 0,
      hand: [],
    };

    state.players.push(newPlayer);
    session.privateHands[playerId] = [];

    // Save to DB
    this.db.savePlayer(newPlayer, cleanRoomId, newSessionToken);

    // Bind socket
    this.bindSocketToPlayer(socket, cleanRoomId, playerId);
    socket.join(cleanRoomId);

    this.broadcastRoomState(cleanRoomId);

    return {
      success: true,
      isHost: newPlayer.isHost,
      sessionToken: newSessionToken,
      playerId,
    };
  }

  updateSettings(socketId: string, newSettings: Partial<GameSettings>): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const player = session.state.players.find((p) => p.id === meta.playerId);
    if (!player || !player.isHost) return { success: false, error: 'Only the host can adjust game settings' };

    if (session.state.phase !== 'waiting_players') {
      return { success: false, error: 'Settings cannot be modified while game is running' };
    }

    const merged = { ...session.state.settings, ...newSettings };

    // Validate config compatibility with domino set
    const validation = validateGameConfig(
      merged.dominoSet,
      merged.maxPlayers,
      merged.tilesPerPlayer,
      merged.protectedTiles?.length || 0
    );

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    session.state.settings = merged;
    this.db.saveRoom(meta.roomId, meta.playerId, merged, 'waiting');
    this.broadcastRoomState(meta.roomId);

    return { success: true };
  }

  reorderPlayers(socketId: string, playerIds: string[]): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const player = session.state.players.find((p) => p.id === meta.playerId);
    if (!player || !player.isHost) {
      return { success: false, error: 'Only the room creator can decide player positions' };
    }

    const currentIds = session.state.players.map((p) => p.id);
    if (playerIds.length !== currentIds.length || !playerIds.every((id) => currentIds.includes(id))) {
      return { success: false, error: 'Invalid player ordering list' };
    }

    // Update seatIndex for each player according to the creator's new ordering
    playerIds.forEach((id, index) => {
      const p = session.state.players.find((pl) => pl.id === id);
      if (p) {
        p.seatIndex = index;
      }
    });

    // Re-sort state.players by seatIndex
    session.state.players.sort((a, b) => a.seatIndex - b.seatIndex);

    const hostPlayer = session.state.players.find((p) => p.isHost);
    this.db.saveRoom(
      meta.roomId,
      hostPlayer?.id || meta.playerId,
      session.state.settings,
      session.state.phase === 'playing' ? 'playing' : 'waiting'
    );
    this.broadcastRoomState(meta.roomId);

    return { success: true };
  }

  toggleReady(socketId: string, isReady: boolean): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const player = session.state.players.find((p) => p.id === meta.playerId);
    if (!player) return { success: false, error: 'Player not found' };

    player.isReady = isReady;
    this.broadcastRoomState(meta.roomId);

    return { success: true };
  }

  startGame(socketId: string, startingPlayerId?: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const player = session.state.players.find((p) => p.id === meta.playerId);
    if (!player || !player.isHost) return { success: false, error: 'Only host can start the game' };

    if (session.state.players.length < 2) {
      return { success: false, error: 'At least 2 players are required to start' };
    }

    // Initialize round 1 with creator-chosen starting player
    const newSession = startNewRound(
      meta.roomId,
      session.state.settings,
      session.state.players,
      1,
      undefined,
      startingPlayerId
    );
    this.sessions.set(meta.roomId, newSession);

    // Save state
    this.db.saveGameState(meta.roomId, newSession.state, newSession.privateHands, newSession.boneyard);
    this.broadcastRoomState(meta.roomId);

    return { success: true };
  }

  nextRound(socketId: string, startingPlayerId?: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const player = session.state.players.find((p) => p.id === meta.playerId);
    if (!player || !player.isHost) return { success: false, error: 'Only host can start the next round' };

    if (session.state.phase !== 'round_finished') {
      return { success: false, error: 'Current round is not finished' };
    }

    const nextRoundNumber = session.state.roundNumber + 1;
    const winnerId = session.state.roundWinnerId || undefined;

    const newSession = startNewRound(
      meta.roomId,
      session.state.settings,
      session.state.players,
      nextRoundNumber,
      winnerId,
      startingPlayerId
    );
    this.sessions.set(meta.roomId, newSession);

    this.db.saveGameState(meta.roomId, newSession.state, newSession.privateHands, newSession.boneyard);
    this.broadcastRoomState(meta.roomId);

    return { success: true };
  }

  selectStarter(socketId: string, playerId: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = selectStartingPlayerAction(session, meta.playerId, playerId);
    if (result.success) {
      this.db.saveGameState(meta.roomId, session.state, session.privateHands, session.boneyard);
      this.broadcastRoomState(meta.roomId);
    }

    return result;
  }

  placeTile(
    socketId: string,
    tileId: string,
    x: number,
    y: number,
    rotation: number,
    placementSide?: 'left' | 'right' | 'top' | 'bottom' | 'free',
    attachedToId?: string
  ): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = stageTilePlacement(session, meta.playerId, tileId, {
      placementSide,
      x,
      y,
      rotation,
      attachedToId,
    });

    if (result.success) {
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  rotateTile(socketId: string, tileId: string, rotation: number): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = stageTilePlacement(session, meta.playerId, tileId, { rotation });
    if (result.success) {
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  undoTurn(socketId: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = undoStagedTurn(session, meta.playerId);
    if (result.success) {
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  confirmTurn(socketId: string): { success: boolean; pointsScored?: number; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = confirmTurnAction(session, meta.playerId);
    if (result.success) {
      this.db.saveGameState(meta.roomId, session.state, session.privateHands, session.boneyard);
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  changeLastMove(socketId: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = changeLastMoveAction(session, meta.playerId);
    if (result.success) {
      this.db.saveGameState(meta.roomId, session.state, session.privateHands, session.boneyard);
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  drawTile(socketId: string): { success: boolean; tile?: DominoTile; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = drawTileAction(session, meta.playerId);
    if (result.success) {
      this.db.saveGameState(meta.roomId, session.state, session.privateHands, session.boneyard);
      this.broadcastRoomState(meta.roomId);
      return { success: true, tile: result.drawnTile };
    }
    return result;
  }

  passTurn(socketId: string): { success: boolean; error?: string } {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return { success: false, error: 'Not in a room' };

    const session = this.sessions.get(meta.roomId);
    if (!session) return { success: false, error: 'Session not found' };

    const result = passTurnAction(session, meta.playerId);
    if (result.success) {
      this.db.saveGameState(meta.roomId, session.state, session.privateHands, session.boneyard);
      this.broadcastRoomState(meta.roomId);
    }
    return result;
  }

  handleDisconnect(socketId: string) {
    const meta = this.socketToPlayer.get(socketId);
    if (!meta) return;

    this.socketToPlayer.delete(socketId);
    this.playerToSocket.delete(meta.playerId);

    const session = this.sessions.get(meta.roomId);
    if (session) {
      const player = session.state.players.find((p) => p.id === meta.playerId);
      if (player) {
        player.connected = false;
        this.broadcastRoomState(meta.roomId);
      }
    }
  }

  private bindSocketToPlayer(socket: Socket<any, any>, roomId: string, playerId: string) {
    this.socketToPlayer.set(socket.id, { roomId, playerId });
    this.playerToSocket.set(playerId, socket.id);
  }

  /**
   * Broadcasts the authoritative room state, strictly filtering private hands
   * so each client ONLY receives their own hand.
   */
  public broadcastRoomState(roomId: string) {
    const session = this.sessions.get(roomId);
    if (!session) return;

    for (const player of session.state.players) {
      const targetSocketId = this.playerToSocket.get(player.id);
      if (targetSocketId) {
        const sanitized = sanitizeStateForPlayer(session.state, player.id, session.privateHands);
        this.io.to(targetSocketId).emit('room:state', sanitized);

        // Also emit hand_sync with player's private tiles
        const playerHand = session.privateHands[player.id] || [];
        this.io.to(targetSocketId).emit('game:hand_sync', { hand: playerHand });
      }
    }
  }
}
