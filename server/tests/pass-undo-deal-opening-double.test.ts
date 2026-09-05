import { describe, it, expect } from 'vitest';
import { calculateOpenEnds, DEFAULT_SETTINGS, type PlacedTile, type PlayerState } from '../src/shared/types.js';
import { generateDominoSet } from '../src/engine/domino-set.js';
import { dealTiles } from '../src/engine/boneyard.js';
import {
  startNewRound,
  passTurnAction,
  undoPassAction,
  drawTileAction,
} from '../src/engine/game-engine.js';

describe('New Mechanics: Opening Double, Pass/Undo Pass, and Deal Randomization', () => {
  it('Opening Double on table produces 4 open ends (top, bottom, left, right)', () => {
    const openingDouble: PlacedTile = {
      id: 'tile-6-6',
      sideA: 6,
      sideB: 6,
      isDouble: true,
      x: 0,
      y: 0,
      rotation: 90,
      placedBy: 'p1',
      roundPlaced: 1,
      placementSide: 'first',
    };

    const { openEnds } = calculateOpenEnds([openingDouble]);
    expect(openEnds).toHaveLength(4);
    
    // Check that there is an open end in each of top (y < 0), bottom (y > 0), left (x < 0), right (x > 0)
    const hasTop = openEnds.some((e) => e.y < openingDouble.y && e.x === openingDouble.x);
    const hasBottom = openEnds.some((e) => e.y > openingDouble.y && e.x === openingDouble.x);
    const hasLeft = openEnds.some((e) => e.x < openingDouble.x && e.y === openingDouble.y);
    const hasRight = openEnds.some((e) => e.x > openingDouble.x && e.y === openingDouble.y);

    expect(hasTop).toBe(true);
    expect(hasBottom).toBe(true);
    expect(hasLeft).toBe(true);
    expect(hasRight).toBe(true);

    // All 4 open ends match value 6
    openEnds.forEach((e) => {
      expect(e.pipValue).toBe(6);
    });
  });

  it('Deal tiles is random and does not automatically give double 0 to host when protectedTiles is empty', () => {
    const allTiles = generateDominoSet('double-6');
    const players = ['host-id', 'player-2', 'player-3', 'player-4'];

    let hostGotDoubleZeroCount = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const deal = dealTiles(allTiles, players, 7, { protectedTileIds: [] });
      const hostHand = deal.playerHands['host-id'];
      if (hostHand.some((t) => t.id === 'tile-0-0')) {
        hostGotDoubleZeroCount++;
      }
    }

    // In a 4 player game with 7 tiles each, host has a 7/28 = 25% chance of getting double-0.
    // It should definitely NOT be 100% (previously it was 100% due to hardcoded find).
    expect(hostGotDoubleZeroCount).toBeLessThan(runs);
  });

  it('Protected tile is always assigned to some player hand and never left in boneyard', () => {
    const allTiles = generateDominoSet('double-6');
    const players = ['p1', 'p2', 'p3'];
    const runs = 20;

    for (let i = 0; i < runs; i++) {
      const deal = dealTiles(allTiles, players, 5, { protectedTileIds: ['tile-6-6'] });
      // Verify tile-6-6 is in one of the players' hands
      const playerWithTile = players.find((p) =>
        deal.playerHands[p].some((t) => t.id === 'tile-6-6')
      );
      expect(playerWithTile).toBeDefined();

      // Verify tile-6-6 is not in boneyard
      const inBoneyard = deal.boneyard.some((t) => t.id === 'tile-6-6');
      expect(inBoneyard).toBe(false);
    }
  });

  it('Pass action announces pass and allows the player to undo pass if no one played after', () => {
    const players: PlayerState[] = [
      { id: 'p1', nickname: 'Alice', isHost: true, isReady: true, score: 0, roundsWon: 0, connected: true, tileCount: 7, seatIndex: 0 },
      { id: 'p2', nickname: 'Bob', isHost: false, isReady: true, score: 0, roundsWon: 0, connected: true, tileCount: 7, seatIndex: 1 },
    ];
    const session = startNewRound('test-room', { ...DEFAULT_SETTINGS, startingTileRule: 'random' }, players, 1);
    session.state.phase = 'playing';
    session.state.currentTurnPlayerId = 'p1';

    // Alice passes
    const passResult = passTurnAction(session, 'p1');
    expect(passResult.success).toBe(true);
    expect(session.state.canUndoPass).toBe(true);
    expect(session.state.lastPassPlayerId).toBe('p1');
    expect(session.state.currentTurnPlayerId).toBe('p2');
    expect(session.state.lastMoveSummary?.description).toBe('Alice passed');
    expect(session.state.lastMoveSummary?.moveType).toBe('pass');

    // Alice undoes pass
    const undoResult = undoPassAction(session, 'p1');
    expect(undoResult.success).toBe(true);
    expect(session.state.currentTurnPlayerId).toBe('p1');
    expect(session.state.canUndoPass).toBe(false);
    expect(session.state.lastMoveSummary?.moveType).toBe('undo_pass');
    expect(session.state.lastMoveSummary?.description).toBe('Alice undid their pass');
  });

  it('Drawing a tile announces to everyone and cannot be undone', () => {
    const players: PlayerState[] = [
      { id: 'p1', nickname: 'Alice', isHost: true, isReady: true, score: 0, roundsWon: 0, connected: true, tileCount: 7, seatIndex: 0 },
      { id: 'p2', nickname: 'Bob', isHost: false, isReady: true, score: 0, roundsWon: 0, connected: true, tileCount: 7, seatIndex: 1 },
    ];
    const session = startNewRound('test-room-2', { ...DEFAULT_SETTINGS, startingTileRule: 'random', allowDrawing: true, protectedBoneyardTiles: 0 }, players, 1);
    session.state.phase = 'playing';
    session.state.currentTurnPlayerId = 'p1';

    const drawRes = drawTileAction(session, 'p1');
    expect(drawRes.success).toBe(true);
    expect(session.state.lastMoveSummary?.description).toBe('Alice took a tile from the draw');
    expect(session.state.lastMoveSummary?.moveType).toBe('draw');

    // Drawing cannot be undone
    expect(session.state.canChangeLastMove).toBe(false);
    expect(session.state.canUndoPass).toBe(false);

    // If Alice tries to undo pass, it should fail
    const undoRes = undoPassAction(session, 'p1');
    expect(undoRes.success).toBe(false);
  });
});
