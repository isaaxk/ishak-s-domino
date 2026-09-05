import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DominoDatabase } from '../src/db/database.js';
import { RoomManager } from '../src/sockets/room-manager.js';
import { placeTileOnBoard, TILE_GAP } from '../src/engine/board.js';
import { DominoTile, PlacedTile, DEFAULT_SETTINGS } from '../src/shared/types.js';
import { Server } from 'socket.io';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

describe('Mid-Game Settings & Domino Snake/Corner Placement', () => {
  let db: DominoDatabase;
  let roomManager: RoomManager;
  let server: http.Server;
  let io: Server;
  const testDbPath = path.resolve(process.cwd(), 'test-midgame-snake.db');

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

  it('verifies DEFAULT_SETTINGS contains showTileCounts enabled by default', () => {
    expect(DEFAULT_SETTINGS.showTileCounts).toBe(true);
  });

  it('allows host to modify settings mid-game while round is running', () => {
    const hostSocket: any = { id: 's-host', join: () => {}, emit: () => {} };
    const p2Socket: any = { id: 's-p2', join: () => {}, emit: () => {} };

    (io.sockets.sockets as any) = new Map([
      ['s-host', hostSocket],
      ['s-p2', p2Socket],
    ]);

    const created = roomManager.createRoom(hostSocket, 'Alice', { maxPlayers: 4, tilesPerPlayer: 7 });
    const roomId = created.roomId!;
    roomManager.joinRoom(p2Socket, roomId, 'Bob');

    // Start game -> enters active 'playing' phase
    const startRes = roomManager.startGame('s-host');
    expect(startRes.success).toBe(true);

    const session = (roomManager as any).sessions.get(roomId);
    expect(session.state.phase).toBe('playing');
    expect(session.state.settings.showTileCounts).toBe(true);

    // Host updates settings mid-game: toggle showTileCounts to false and change targetScore
    const updateRes = roomManager.updateSettings('s-host', {
      showTileCounts: false,
      targetScore: 250,
    });
    expect(updateRes.success).toBe(true);
    expect(session.state.settings.showTileCounts).toBe(false);
    expect(session.state.settings.targetScore).toBe(250);

    // Non-host cannot update settings mid-game
    const p2Update = roomManager.updateSettings('s-p2', { showTileCounts: true });
    expect(p2Update.success).toBe(false);
    expect(p2Update.error).toContain('Only the host');

    // Host toggles showTileCounts back on
    const toggleBack = roomManager.updateSettings('s-host', { showTileCounts: true });
    expect(toggleBack.success).toBe(true);
    expect(session.state.settings.showTileCounts).toBe(true);
  });

  describe('Snake / Corner 90° Turn Geometry', () => {
    const tileRoot: DominoTile = { id: 'tile-6-2', sideA: 6, sideB: 2, totalPips: 8, isDouble: false };
    const tileVertical: DominoTile = { id: 'tile-2-5', sideA: 2, sideB: 5, totalPips: 7, isDouble: false };
    const tileHorizontal: DominoTile = { id: 'tile-5-3', sideA: 5, sideB: 3, totalPips: 8, isDouble: false };

    it('places 90° turn-up at right end of horizontal tile with laser alignment', () => {
      // Root tile at (0, 0), horizontal (width 80, height 40)
      const rootPlacement = placeTileOnBoard([], tileRoot, 'p1', 1, 0, { rotation: 0 });
      const currentBoard = rootPlacement.newBoard;

      // Turn Up at right end of tile-6-2
      const turnUp = placeTileOnBoard(currentBoard, tileVertical, 'p2', 1, 1, {
        placementSide: 'turn-up',
        attachedToId: 'tile-6-2',
      });

      const placed = turnUp.placedTile;
      expect(placed.x).toBe(20);
      expect(placed.y).toBe(-63);
      expect(placed.rotation).toBe(270); // Auto-matched so sideA (2) touches root tile sideB (2) at bottom
      expect(placed.attachedToId).toBe('tile-6-2');

      // Zero overlap: root top edge is -20, placed bottom edge is -63 + 40 = -23
      expect(placed.y + 40).toBe(-20 - TILE_GAP);
    });

    it('places 90° turn-down at right end of horizontal tile with laser alignment', () => {
      const rootPlacement = placeTileOnBoard([], tileRoot, 'p1', 1, 0, { rotation: 0 });
      const currentBoard = rootPlacement.newBoard;

      // Turn Down at right end
      const turnDown = placeTileOnBoard(currentBoard, tileVertical, 'p2', 1, 1, {
        placementSide: 'turn-down',
        attachedToId: 'tile-6-2',
      });

      const placed = turnDown.placedTile;
      expect(placed.x).toBe(20);
      expect(placed.y).toBe(63);
      expect(placed.rotation).toBe(90);

      // Zero overlap: root bottom edge is +20, placed top edge is 63 - 40 = 23
      expect(placed.y - 40).toBe(20 + TILE_GAP);
    });

    it('places 90° turn-up and turn-down at left end of horizontal tile', () => {
      const rootPlacement = placeTileOnBoard([], tileRoot, 'p1', 1, 0, { rotation: 0 });
      const currentBoard = rootPlacement.newBoard;

      const leftEndTile: PlacedTile = {
        id: 'tile-left-end',
        sideA: 6,
        sideB: 1,
        isDouble: false,
        x: -100,
        y: 0,
        rotation: 0,
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
        placementSide: 'left',
      };
      const boardWithLeft = [leftEndTile, ...currentBoard];
      const turnLeftUp = placeTileOnBoard(boardWithLeft, tileVertical, 'p2', 1, 2, {
        placementSide: 'turn-up',
        attachedToId: 'tile-left-end',
      });
      expect(turnLeftUp.placedTile.x).toBe(-120);
      expect(turnLeftUp.placedTile.y).toBe(-63);

      const turnLeftDown = placeTileOnBoard(boardWithLeft, tileVertical, 'p2', 1, 2, {
        placementSide: 'turn-down',
        attachedToId: 'tile-left-end',
      });
      expect(turnLeftDown.placedTile.x).toBe(-120);
      expect(turnLeftDown.placedTile.y).toBe(63);
    });

    it('continues straight top after a turn and can turn left to form a snake serpentine line', () => {
      // 1. Root at (0, 0)
      const root = placeTileOnBoard([], tileRoot, 'p1', 1, 0, { rotation: 0 });
      // 2. Turn Up at (20, -63)
      const turnUp = placeTileOnBoard(root.newBoard, tileVertical, 'p2', 1, 1, {
        placementSide: 'turn-up',
        attachedToId: 'tile-6-2',
      });

      // 3. Continue straight top from tileVertical at (20, -63)
      const continueTopTile: DominoTile = { id: 'tile-top-cont', sideA: 5, sideB: 4, totalPips: 9, isDouble: false };
      const topPlacement = placeTileOnBoard(turnUp.newBoard, continueTopTile, 'p1', 1, 2, {
        placementSide: 'top',
        attachedToId: 'tile-2-5',
      });
      expect(topPlacement.placedTile.x).toBe(20);
      expect(topPlacement.placedTile.y).toBe(-146);
      expect(topPlacement.placedTile.rotation).toBe(270); // Auto-matched so sideA (5) connects to base tile top (5)

      // 4. From the top tile at (20, -146), turn left!
      const snakeLeft = placeTileOnBoard(topPlacement.newBoard, tileHorizontal, 'p2', 1, 3, {
        placementSide: 'turn-left',
        attachedToId: 'tile-top-cont',
      });
      const placedSnake = snakeLeft.placedTile;
      expect(placedSnake.x).toBe(-43);
      expect(placedSnake.y).toBe(-166);
      expect(placedSnake.rotation).toBe(0);

      // Zero overlap: top tile left edge is 0, placed snake right edge is -43 + 40 = -3
      expect(placedSnake.x + 40).toBe(0 - TILE_GAP);
    });

    it('matches pips by default (e.g. 4 with 4) when placing domino 4:3 or 3:4', () => {
      // Table base tile has 4 on the exposed right side
      const baseTile: PlacedTile = {
        id: 'base-tile',
        sideA: 6,
        sideB: 4,
        totalPips: 10,
        isDouble: false,
        x: 0,
        y: 0,
        rotation: 0, // sideA (6) left, sideB (4) right
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
        placementSide: 'free',
      };

      const tile43: DominoTile = { id: 't-4-3', sideA: 4, sideB: 3, totalPips: 7, isDouble: false };
      const tile34: DominoTile = { id: 't-3-4', sideA: 3, sideB: 4, totalPips: 7, isDouble: false };

      // Connecting to right: touching half is left.
      // tile43 (sideA=4) touching side should be 4 -> rot 0
      const res43 = placeTileOnBoard([baseTile], tile43, 'p2', 1, 1, {
        placementSide: 'right',
        attachedToId: 'base-tile',
      });
      expect(res43.placedTile.rotation).toBe(0);

      // tile34 (sideB=4) touching side should be 4 -> rot 180 (so sideB is left)
      const res34 = placeTileOnBoard([baseTile], tile34, 'p2', 1, 1, {
        placementSide: 'right',
        attachedToId: 'base-tile',
      });
      expect(res34.placedTile.rotation).toBe(180);

      // Connecting to left (baseTile sideA is 6):
      const tile65: DominoTile = { id: 't-6-5', sideA: 6, sideB: 5, totalPips: 11, isDouble: false };
      const tile56: DominoTile = { id: 't-5-6', sideA: 5, sideB: 6, totalPips: 11, isDouble: false };
      // tile65: sideA is 6, touching half is right -> rot 180 (so sideA is right)
      const res65 = placeTileOnBoard([baseTile], tile65, 'p2', 1, 1, {
        placementSide: 'left',
        attachedToId: 'base-tile',
      });
      expect(res65.placedTile.rotation).toBe(180);

      // tile56: sideB is 6, touching half is right -> rot 0 (so sideB is right)
      const res56 = placeTileOnBoard([baseTile], tile56, 'p2', 1, 1, {
        placementSide: 'left',
        attachedToId: 'base-tile',
      });
      expect(res56.placedTile.rotation).toBe(0);
    });

    it('defaults double tiles to vertical (rotation: 90) by default', () => {
      const double4: DominoTile = { id: 't-4-4', sideA: 4, sideB: 4, totalPips: 8, isDouble: true };

      // 1. First tile on empty board
      const firstPlacement = placeTileOnBoard([], double4, 'p1', 1, 0);
      expect(firstPlacement.placedTile.rotation).toBe(90);

      // 2. Attached to right of an existing tile
      const baseTile: PlacedTile = {
        id: 'base-tile',
        sideA: 6,
        sideB: 4,
        totalPips: 10,
        isDouble: false,
        x: 0,
        y: 0,
        rotation: 0,
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
        placementSide: 'free',
      };
      const doublePlacementRight = placeTileOnBoard([baseTile], double4, 'p2', 1, 1, {
        placementSide: 'right',
        attachedToId: 'base-tile',
      });
      expect(doublePlacementRight.placedTile.rotation).toBe(90);

      // 3. Attached to left
      const doublePlacementLeft = placeTileOnBoard([baseTile], double4, 'p2', 1, 1, {
        placementSide: 'left',
        attachedToId: 'base-tile',
      });
      expect(doublePlacementLeft.placedTile.rotation).toBe(90);
    });
  });
});
