import { describe, it, expect } from 'vitest';
import { generateDominoSet } from '../src/engine/domino-set.js';
import { dealTiles, drawFromBoneyard, shuffleTiles } from '../src/engine/boneyard.js';

describe('Boneyard, Tile Distribution & Protected Tiles', () => {
  it('deals correct number of tiles to each player and places the remainder in boneyard', () => {
    const fullSet = generateDominoSet('double-6'); // 28 tiles
    const playerIds = ['p1', 'p2'];
    const tilesPerPlayer = 7;

    const result = dealTiles(fullSet, playerIds, tilesPerPlayer);

    expect(result.playerHands['p1'].length).toBe(7);
    expect(result.playerHands['p2'].length).toBe(7);
    expect(result.boneyard.length).toBe(28 - 14); // 14 tiles in boneyard

    // Verify all 28 tiles are uniquely accounted for
    const allAssignedIds = [
      ...result.playerHands['p1'].map((t) => t.id),
      ...result.playerHands['p2'].map((t) => t.id),
      ...result.boneyard.map((t) => t.id),
    ];
    const uniqueIds = new Set(allAssignedIds);
    expect(uniqueIds.size).toBe(28);
  });

  it('guarantees protected tiles (e.g. 0-0, 6-6) do NOT end up in the boneyard', () => {
    const fullSet = generateDominoSet('double-6');
    const playerIds = ['p1', 'p2'];
    const protectedTileIds = ['tile-0-0', 'tile-6-6'];

    const result = dealTiles(fullSet, playerIds, 7, { protectedTileIds });

    // Neither protected tile should be in boneyard
    const boneyardIds = new Set(result.boneyard.map((t) => t.id));
    expect(boneyardIds.has('tile-0-0')).toBe(false);
    expect(boneyardIds.has('tile-6-6')).toBe(false);

    // Both protected tiles must be in player hands
    const playerTiles = [...result.playerHands['p1'], ...result.playerHands['p2']].map((t) => t.id);
    expect(playerTiles.includes('tile-0-0')).toBe(true);
    expect(playerTiles.includes('tile-6-6')).toBe(true);
  });

  it('respects designated starting tile rule for All Fives (e.g. tile-0-0 goes to starter)', () => {
    const fullSet = generateDominoSet('double-6');
    const playerIds = ['alice', 'bob'];

    const result = dealTiles(fullSet, playerIds, 7, {
      startingTileId: 'tile-0-0',
      startingPlayerId: 'alice',
    });

    expect(result.startingTile?.id).toBe('tile-0-0');
    expect(result.playerHands['alice'].some((t) => t.id === 'tile-0-0')).toBe(true);
  });

  it('enforces protected boneyard tiles limit when drawing', () => {
    const fullSet = generateDominoSet('double-6');
    const { boneyard } = dealTiles(fullSet, ['p1', 'p2'], 12); // 24 dealt, 4 in boneyard
    expect(boneyard.length).toBe(4);

    // With protectedCount = 2, can draw down to 2 tiles
    const draw1 = drawFromBoneyard(boneyard, 2);
    expect(draw1.tile).not.toBeNull();
    expect(draw1.remainingBoneyard.length).toBe(3);

    const draw2 = drawFromBoneyard(draw1.remainingBoneyard, 2);
    expect(draw2.tile).not.toBeNull();
    expect(draw2.remainingBoneyard.length).toBe(2);

    // Boneyard now has 2 tiles left which equals protected limit -> drawing must fail!
    const draw3 = drawFromBoneyard(draw2.remainingBoneyard, 2);
    expect(draw3.tile).toBeNull();
    expect(draw3.error).toContain('minimum protected count');
  });
});
