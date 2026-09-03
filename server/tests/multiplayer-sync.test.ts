import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DominoDatabase } from '../src/db/database.js';
import { RoomManager } from '../src/sockets/room-manager.js';
import { Server } from 'socket.io';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

describe('End-to-End Multiplayer Synchronization', () => {
  let db: DominoDatabase;
  let roomManager: RoomManager;
  let server: http.Server;
  let io: Server;
  const testDbPath = path.resolve(process.cwd(), 'test-domino.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    server = http.createServer();
    io = new Server(server);
    db = new DominoDatabase(testDbPath);
    roomManager = new RoomManager(io, db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it('synchronizes game state across multiple players while isolating private hands', () => {
    // Mock socket for Host (Alice)
    const hostEmittedEvents: Record<string, any[]> = {};
    const hostSocket: any = {
      id: 'socket-alice',
      join: () => {},
      emit: (evt: string, data: any) => {
        if (!hostEmittedEvents[evt]) hostEmittedEvents[evt] = [];
        hostEmittedEvents[evt].push(data);
      },
    };

    // 1. Host creates room
    const createRes = roomManager.createRoom(hostSocket, 'Alice', { dominoSet: 'double-6', gameType: 'all-fives' });
    expect(createRes.roomId).toBeDefined();
    expect(createRes.playerId).toBeDefined();
    expect(createRes.sessionToken).toBeDefined();

    // Mock socket for Player 2 (Bob)
    const bobEmittedEvents: Record<string, any[]> = {};
    const bobSocket: any = {
      id: 'socket-bob',
      join: () => {},
      emit: (evt: string, data: any) => {
        if (!bobEmittedEvents[evt]) bobEmittedEvents[evt] = [];
        bobEmittedEvents[evt].push(data);
      },
    };

    // 2. Bob joins room
    const joinRes = roomManager.joinRoom(bobSocket, createRes.roomId, 'Bob');
    expect(joinRes.success).toBe(true);
    expect(joinRes.playerId).toBeDefined();

    // 3. Host starts game
    const startRes = roomManager.startGame('socket-alice');
    expect(startRes.success).toBe(true);

    // 3b. After starting, game is in selecting_starter phase where manager decides who starts
    let savedState = db.getGameState(createRes.roomId);
    expect(savedState).not.toBeNull();
    expect(savedState?.state.phase).toBe('selecting_starter');
    expect(savedState?.state.currentTurnPlayerId).toBeNull();

    // Manager selects Alice to start and put first domino
    const selectRes = roomManager.selectStarter('socket-alice', createRes.playerId);
    expect(selectRes.success).toBe(true);

    // 4. Inspect persisted state after manager decision
    savedState = db.getGameState(createRes.roomId);
    expect(savedState?.state.phase).toBe('playing');
    expect(savedState?.state.board.length).toBe(0);
    expect(savedState?.state.players.length).toBe(2);
    expect(savedState?.state.currentTurnPlayerId).toBe(createRes.playerId);

    // 5. Active player plays a turn
    const activePid = savedState!.state.currentTurnPlayerId!;
    const activeSocketId = activePid === createRes.playerId ? 'socket-alice' : 'socket-bob';
    const activeHand = savedState!.privateHands[activePid];
    expect(activeHand.length).toBe(7);

    const tileToPlay = activeHand[0];
    const placeRes = roomManager.placeTile(
      activeSocketId,
      tileToPlay.id,
      0,
      0,
      0,
      'free'
    );
    expect(placeRes.success).toBe(true);

    const confirmRes = roomManager.confirmTurn(activeSocketId);
    expect(confirmRes.success).toBe(true);

    // 6. Verify updated game state in DB
    const afterTurnState = db.getGameState(createRes.roomId);
    expect(afterTurnState?.state.board.length).toBe(1);
    expect(afterTurnState?.state.board[0].id).toBe(tileToPlay.id);
    expect(afterTurnState?.privateHands[activePid].length).toBe(6);

    // 7. Verify Reconnection
    // Bob disconnects and reconnects using sessionToken
    roomManager.handleDisconnect('socket-bob');
    const reconnectSocket: any = {
      id: 'socket-bob-reconnected',
      join: () => {},
      emit: () => {},
    };
    const reconnectRes = roomManager.joinRoom(reconnectSocket, createRes.roomId, 'Bob', joinRes.sessionToken);
    expect(reconnectRes.success).toBe(true);
    expect(reconnectRes.playerId).toBe(joinRes.playerId);
  });
});
