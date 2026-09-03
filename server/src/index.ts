import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { DominoDatabase } from './db/database.js';
import { RoomManager } from './sockets/room-manager.js';
import { ClientToServerEvents, ServerToClientEvents } from './shared/types.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const db = new DominoDatabase();
const roomManager = new RoomManager(io, db);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Socket connection handling
io.on('connection', (socket) => {
  // 1. Room Creation
  socket.on('room:create', ({ nickname, settings }, callback) => {
    try {
      const result = roomManager.createRoom(socket, nickname, settings);
      callback({
        success: true,
        roomId: result.roomId,
        sessionToken: result.sessionToken,
        playerId: result.playerId,
      });
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Failed to create room' });
    }
  });

  // 2. Room Joining / Reconnecting
  socket.on('room:join', ({ roomId, nickname, sessionToken }, callback) => {
    try {
      const result = roomManager.joinRoom(socket, roomId, nickname, sessionToken);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Failed to join room' });
    }
  });

  // 3. Settings Update (Host only)
  socket.on('room:update_settings', ({ settings }, callback) => {
    try {
      const result = roomManager.updateSettings(socket.id, settings);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 3b. Reorder Player Positions Around Table (Host only)
  socket.on('room:reorder_players', ({ playerIds }, callback) => {
    try {
      const result = roomManager.reorderPlayers(socket.id, playerIds);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 4. Ready Toggle
  socket.on('player:ready', ({ isReady }, callback) => {
    try {
      const result = roomManager.toggleReady(socket.id, isReady);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 5. Start Game (Host/Creator decides who starts)
  socket.on('game:start', (arg1?: any, arg2?: any) => {
    const callback = typeof arg1 === 'function' ? arg1 : typeof arg2 === 'function' ? arg2 : () => {};
    try {
      const payload = typeof arg1 === 'object' && arg1 !== null ? arg1 : {};
      const result = roomManager.startGame(socket.id, payload.startingPlayerId);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 6. Next Round (Host/Creator decides who starts)
  socket.on('game:next_round', (arg1?: any, arg2?: any) => {
    const callback = typeof arg1 === 'function' ? arg1 : typeof arg2 === 'function' ? arg2 : () => {};
    try {
      const payload = typeof arg1 === 'object' && arg1 !== null ? arg1 : {};
      const result = roomManager.nextRound(socket.id, payload.startingPlayerId);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 7. Place Tile (Turn staged placement)
  socket.on('game:place_tile', ({ tileId, x, y, rotation, placementSide, attachedToId }, callback) => {
    try {
      const result = roomManager.placeTile(socket.id, tileId, x, y, rotation, placementSide, attachedToId);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 7b. Rotate Tile (Rotate staged pending placement)
  socket.on('game:rotate_tile', ({ tileId, rotation }, callback) => {
    try {
      const result = roomManager.rotateTile(socket.id, tileId, rotation);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 8. Undo Turn (Revert unconfirmed placements)
  socket.on('game:undo_turn', (callback) => {
    try {
      const result = roomManager.undoTurn(socket.id);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 9. Confirm Turn (Commit placements, calculate scores, advance turn)
  socket.on('game:confirm_turn', (callback) => {
    try {
      const result = roomManager.confirmTurn(socket.id);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 9b. Change Last Move (Revert last confirmed move if no one played after)
  socket.on('game:change_last_move', (callback) => {
    try {
      const result = roomManager.changeLastMove(socket.id);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 10. Draw Tile
  socket.on('game:draw_tile', (callback) => {
    try {
      const result = roomManager.drawTile(socket.id);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // 11. Pass Turn
  socket.on('game:pass', (callback) => {
    try {
      const result = roomManager.passTurn(socket.id);
      callback(result);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

// Production: Serve static client build if present
const candidatePaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
];
const clientDistPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];

if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static client files from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

server.listen(port, () => {
  console.log(`Domino server listening on http://localhost:${port}`);
});
