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
});
