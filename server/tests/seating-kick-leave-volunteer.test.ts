import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DominoDatabase } from '../src/db/database.js';
import { RoomManager } from '../src/sockets/room-manager.js';
import { Server } from 'socket.io';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

describe('Seating, Kick, Leave, and Starter Volunteer Workflow', () => {
  let db: DominoDatabase;
  let roomManager: RoomManager;
  let server: http.Server;
  let io: Server;
  const testDbPath = path.resolve(process.cwd(), 'test-domino-features.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    server = http.createServer();
    io = new Server(server);
    db = new DominoDatabase(testDbPath);
    roomManager = new RoomManager(io, db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('allows manager to assign seat positions to players', () => {
    const hostSocket: any = { id: 's-host', join: () => {}, emit: () => {} };
    const p2Socket: any = { id: 's-p2', join: () => {}, emit: () => {} };
    const p3Socket: any = { id: 's-p3', join: () => {}, emit: () => {} };

    (io.sockets.sockets as any) = new Map([
      ['s-host', hostSocket],
      ['s-p2', p2Socket],
      ['s-p3', p3Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice', { maxPlayers: 6 });
    const p2 = roomManager.joinRoom(p2Socket, created.roomId!, 'Bob');
    const p3 = roomManager.joinRoom(p3Socket, created.roomId!, 'Charlie');

    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.players.length).toBe(3);

    // Non-host cannot assign seat
    const nonHostAssign = roomManager.assignSeat('s-p2', p3.playerId!, 4);
    expect(nonHostAssign.success).toBe(false);

    // Manager assigns Bob to Position 5 (seatIndex 4)
    const hostAssign = roomManager.assignSeat('s-host', p2.playerId!, 4);
    expect(hostAssign.success).toBe(true);

    const bob = session.state.players.find((p: any) => p.id === p2.playerId);
    expect(bob.seatIndex).toBe(4);
  });

  it('allows players to leave room and re-indexes seats', () => {
    const hostSocket: any = { id: 's-host', join: () => {}, leave: () => {}, emit: () => {} };
    const p2Socket: any = { id: 's-p2', join: () => {}, leave: () => {}, emit: () => {} };

    (io.sockets.sockets as any) = new Map([
      ['s-host', hostSocket],
      ['s-p2', p2Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice');
    const p2 = roomManager.joinRoom(p2Socket, created.roomId!, 'Bob');

    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.players.length).toBe(2);

    const leaveRes = roomManager.leaveRoom('s-p2');
    expect(leaveRes.success).toBe(true);
    expect(session.state.players.length).toBe(1);
    expect(session.state.players[0].nickname).toBe('Alice');
  });

  it('allows manager to kick a player and notifies target', () => {
    const hostSocket: any = { id: 's-host', join: () => {}, leave: () => {}, emit: () => {} };
    let kickedPayload: any = null;
    const p2Socket: any = {
      id: 's-p2',
      join: () => {},
      leave: () => {},
      emit: (evt: string, data: any) => {
        if (evt === 'player:kicked') kickedPayload = data;
      },
    };

    (io.sockets.sockets as any) = new Map([
      ['s-host', hostSocket],
      ['s-p2', p2Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice');
    const p2 = roomManager.joinRoom(p2Socket, created.roomId!, 'Bob');

    // Bob tries to kick Alice -> fails
    const failKick = roomManager.kickPlayer('s-p2', created.playerId!);
    expect(failKick.success).toBe(false);

    // Alice kicks Bob -> succeeds
    const kickRes = roomManager.kickPlayer('s-host', p2.playerId!);
    expect(kickRes.success).toBe(true);

    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.players.length).toBe(1);
    expect(kickedPayload).toBeDefined();
    expect(kickedPayload.reason).toContain('kicked');
  });

  it('handles volunteer starter request, refuse, and agree flow', () => {
    const hostSocket: any = { id: 's-host', join: () => {}, emit: () => {} };
    const p2Socket: any = { id: 's-p2', join: () => {}, emit: () => {} };

    (io.sockets.sockets as any) = new Map([
      ['s-host', hostSocket],
      ['s-p2', p2Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice');
    roomManager.updateSettings('s-host', { startingTileRule: 'host-selects' });
    const p2 = roomManager.joinRoom(p2Socket, created.roomId!, 'Bob');

    // Manager starts game -> enters selecting_starter phase
    const startRes = roomManager.startGame('s-host');
    expect(startRes.success).toBe(true);

    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.phase).toBe('selecting_starter');

    // Bob volunteers to start
    const volunteerRes = roomManager.volunteerStarter('s-p2');
    expect(volunteerRes.success).toBe(true);
    expect(session.state.starterRequest).toEqual({
      playerId: p2.playerId,
      playerNickname: 'Bob',
    });

    // Bob tries to approve himself -> fails (not host)
    const illegalApprove = roomManager.respondStarterRequest('s-p2', true);
    expect(illegalApprove.success).toBe(false);

    // Host refuses Bob's request
    const refuseRes = roomManager.respondStarterRequest('s-host', false);
    expect(refuseRes.success).toBe(true);
    expect(session.state.starterRequest).toBeNull();
    expect(session.state.phase).toBe('selecting_starter');

    // Bob volunteers again
    roomManager.volunteerStarter('s-p2');
    expect(session.state.starterRequest?.playerId).toBe(p2.playerId);

    // Host agrees to let Bob start!
    const agreeRes = roomManager.respondStarterRequest('s-host', true);
    expect(agreeRes.success).toBe(true);
    expect(session.state.starterRequest).toBeNull();
    expect(session.state.phase).toBe('playing');
    expect(session.state.currentTurnPlayerId).toBe(p2.playerId);
  });

  it('allows manager to set double-7 with 6 players and 6 tiles, and deals 6 tiles to all 6 players without starvation', () => {
    const sockets: any[] = [];
    const playerMap = new Map();
    for (let i = 0; i < 6; i++) {
      const s = { id: `s-p${i}`, join: () => {}, emit: () => {} };
      sockets.push(s);
      playerMap.set(s.id, s);
    }
    (io.sockets.sockets as any) = playerMap;

    // 1. Host creates room with maxPlayers 6
    const created = roomManager.createRoom(sockets[0], 'Player 0', {
      dominoSet: 'double-7',
      maxPlayers: 6,
      tilesPerPlayer: 6,
    });

    // 2. 5 more players join
    for (let i = 1; i < 6; i++) {
      const joinRes = roomManager.joinRoom(sockets[i], created.roomId!, `Player ${i}`);
      expect(joinRes.success).toBe(true);
    }

    // 3. Manager can also update/confirm settings to double-7, 6 max players, 6 tiles per player
    const updateRes = roomManager.updateSettings('s-p0', {
      dominoSet: 'double-7',
      maxPlayers: 6,
      tilesPerPlayer: 6,
    });
    expect(updateRes.success).toBe(true);

    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.settings.dominoSet).toBe('double-7');
    expect(session.state.settings.tilesPerPlayer).toBe(6);

    // 4. Manager starts game
    const startRes = roomManager.startGame('s-p0');
    expect(startRes.success).toBe(true);

    const activeSession = (roomManager as any).sessions.get(created.roomId!);

    // 5. Verify every single player has exactly 6 tiles (not 7 and 1)
    for (let i = 0; i < 6; i++) {
      const player = activeSession.state.players[i];
      const hand = activeSession.privateHands[player.id];
      expect(hand.length).toBe(6);
      expect(player.tileCount).toBe(6);
    }
    expect(activeSession.boneyard.length).toBe(0);
  });

  it('handles default free-starter flow: anyone can place first tile, turn advances clockwise, starter can change move', () => {
    const hostSocket: any = { id: 's-host-fs', join: () => {}, emit: () => {} };
    const p2Socket: any = { id: 's-p2-fs', join: () => {}, emit: () => {} };

    (io.sockets.sockets as any) = new Map([
      ['s-host-fs', hostSocket],
      ['s-p2-fs', p2Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice');
    const p2 = roomManager.joinRoom(p2Socket, created.roomId!, 'Bob');

    // Default settings startingTileRule is 'free-starter'
    const session = (roomManager as any).sessions.get(created.roomId!);
    expect(session.state.settings.startingTileRule).toBe('free-starter');

    // Manager starts game -> enters playing phase directly without selecting_starter modal!
    const startRes = roomManager.startGame('s-host-fs');
    expect(startRes.success).toBe(true);

    const activeSession = (roomManager as any).sessions.get(created.roomId!);
    expect(activeSession.state.phase).toBe('playing');
    expect(activeSession.state.currentTurnPlayerId).toBeNull();
    expect(activeSession.state.board.length).toBe(0);

    // Bob (Player 2) has the tile he wants to open with
    const bobTile = activeSession.privateHands[p2.playerId!][0];
    const placeRes = roomManager.placeTile('s-p2-fs', bobTile.id, 0, 0, 0, 'free');
    expect(placeRes.success).toBe(true);
    expect(activeSession.state.pendingPlacements.length).toBe(1);

    // Bob confirms placing the first tile
    const confirmRes = roomManager.confirmTurn('s-p2-fs');
    expect(confirmRes.success).toBe(true);
    expect(activeSession.state.board.length).toBe(1);
    expect(activeSession.state.board[0].id).toBe(bobTile.id);

    // Turn immediately advances to next player clockwise (Alice, Host)
    const hostPlayer = activeSession.state.players.find((p: any) => p.isHost);
    expect(activeSession.state.currentTurnPlayerId).toBe(hostPlayer.id);

    // Bob can change his move before Alice plays
    const changeRes = roomManager.changeLastMove('s-p2-fs');
    expect(changeRes.success).toBe(true);
    expect(activeSession.state.board.length).toBe(0);
    expect(activeSession.state.pendingPlacements.length).toBe(1);
  });
});
