import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';
import { DominoDatabase } from '../src/db/database.js';
import { RoomManager } from '../src/sockets/room-manager.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  DominoTile,
} from '../../shared/types.js';

describe('Multi-Client WebSocket Simulated Integration', () => {
  let server: http.Server;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let db: DominoDatabase;
  let roomManager: RoomManager;
  let port: number;
  const dbPath = path.resolve(process.cwd(), 'sim-domino.db');

  beforeAll(async () => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const app = express();
    server = http.createServer(app);
    io = new Server<ClientToServerEvents, ServerToClientEvents>(server);
    db = new DominoDatabase(dbPath);
    roomManager = new RoomManager(io, db);

    // Bind event routing
    io.on('connection', (socket) => {
      socket.on('room:create', ({ nickname, settings }, cb) => {
        try {
          const res = roomManager.createRoom(socket, nickname, settings);
          cb({ success: true, ...res });
        } catch (err: any) {
          cb({ success: false, error: err.message });
        }
      });

      socket.on('room:join', ({ roomId, nickname, sessionToken }, cb) => {
        try {
          const res = roomManager.joinRoom(socket, roomId, nickname, sessionToken);
          cb(res);
        } catch (err: any) {
          cb({ success: false, error: err.message });
        }
      });

      socket.on('player:ready', ({ isReady }, cb) => {
        cb(roomManager.toggleReady(socket.id, isReady));
      });

      socket.on('game:start', (cb) => {
        cb(roomManager.startGame(socket.id));
      });

      socket.on('game:select_starter', ({ playerId }, cb) => {
        cb(roomManager.selectStarter(socket.id, playerId));
      });

      socket.on('game:place_tile', (p, cb) => {
        cb(roomManager.placeTile(socket.id, p.tileId, p.x, p.y, p.rotation, p.placementSide));
      });

      socket.on('game:confirm_turn', (cb) => {
        cb(roomManager.confirmTurn(socket.id));
      });

      socket.on('game:draw_tile', (cb) => {
        cb(roomManager.drawTile(socket.id));
      });

      socket.on('disconnect', () => {
        roomManager.handleDisconnect(socket.id);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('runs complete multiplayer flow between Phone 1 (Host) and Phone 2 (Player)', async () => {
    // 1. Connect Phone 1 (Host: Ali)
    const phone1: ClientSocket<ServerToClientEvents, ClientToServerEvents> = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    let phone1State: GameState | null = null;
    let phone1Hand: DominoTile[] = [];

    phone1.on('room:state', (s) => (phone1State = s));
    phone1.on('game:hand_sync', (h) => (phone1Hand = h.hand));

    const hostCreateRes: any = await new Promise((res) => {
      phone1.emit('room:create', { nickname: 'Ali', settings: { gameType: 'all-fives', startingTileRule: 'host-selects' } }, res);
    });

    expect(hostCreateRes.success).toBe(true);
    const roomId = hostCreateRes.roomId;
    expect(roomId).toBeDefined();

    // 2. Connect Phone 2 (Player: Sara)
    const phone2: ClientSocket<ServerToClientEvents, ClientToServerEvents> = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    let phone2State: GameState | null = null;
    let phone2Hand: DominoTile[] = [];

    phone2.on('room:state', (s) => (phone2State = s));
    phone2.on('game:hand_sync', (h) => (phone2Hand = h.hand));

    const playerJoinRes: any = await new Promise((res) => {
      phone2.emit('room:join', { roomId, nickname: 'Sara' }, res);
    });

    expect(playerJoinRes.success).toBe(true);

    // Allow socket states to settle
    await new Promise((r) => setTimeout(r, 100));

    // Both players should see 2 players in lobby
    expect(phone1State?.players.length).toBe(2);
    expect(phone2State?.players.length).toBe(2);

    // 3. Start Game
    const startRes: any = await new Promise((res) => {
      phone1.emit('game:start', res);
    });
    expect(startRes.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // Game is in selecting_starter phase on table, manager chooses who starts Round 1
    expect(phone1State?.phase).toBe('selecting_starter');

    const selectRes: any = await new Promise((res) => {
      phone1.emit('game:select_starter', { playerId: hostCreateRes.playerId }, res);
    });
    expect(selectRes.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));
    expect(phone1State?.phase).toBe('playing');

    // 4. Verify Privacy Isolation:
    // Phone 1 has 7 tiles
    expect(phone1Hand.length).toBe(7);
    // Phone 2 has 7 tiles
    expect(phone2Hand.length).toBe(7);

    // Phone 1 must NOT see Phone 2's hand in gameState.players
    const p2OnPhone1 = phone1State?.players.find((p) => p.nickname === 'Sara');
    expect(p2OnPhone1?.hand).toBeUndefined(); // Hand stripped for privacy!
    expect(p2OnPhone1?.tileCount).toBe(7);

    // Phone 2 must NOT see Phone 1's hand
    const p1OnPhone2 = phone2State?.players.find((p) => p.nickname === 'Ali');
    expect(p1OnPhone2?.hand).toBeUndefined(); // Hand stripped!
    expect(p1OnPhone2?.tileCount).toBe(7);

    // 5. Active Player makes a turn
    const activePlayerId = phone1State?.currentTurnPlayerId;
    const activePhone = activePlayerId === hostCreateRes.playerId ? phone1 : phone2;
    const activeHand = activePlayerId === hostCreateRes.playerId ? phone1Hand : phone2Hand;

    const tileToPlay = activeHand[0];

    // Stage placement
    const placeRes: any = await new Promise((res) => {
      activePhone.emit(
        'game:place_tile',
        {
          tileId: tileToPlay.id,
          x: 0,
          y: 0,
          rotation: 0,
          placementSide: 'free',
        },
        res
      );
    });
    expect(placeRes.success).toBe(true);

    // Confirm turn
    const confirmRes: any = await new Promise((res) => {
      activePhone.emit('game:confirm_turn', res);
    });
    expect(confirmRes.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // 6. Both phones must observe the placed tile on board!
    expect(phone1State?.board.length).toBe(1);
    expect(phone2State?.board.length).toBe(1);
    expect(phone1State?.board[0].id).toBe(tileToPlay.id);
    expect(phone2State?.board[0].id).toBe(tileToPlay.id);

    // Cleanup client sockets
    phone1.disconnect();
    phone2.disconnect();
  });
});
