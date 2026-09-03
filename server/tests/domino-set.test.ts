import { describe, it, expect } from 'vitest';
import {
  generateDominoSet,
  getSetTileCount,
  validateGameConfig,
  getMaxPips,
} from '../src/engine/domino-set.js';

describe('Domino Set Generation & Validation', () => {
  it('generates the exact count of tiles for Double-6 (28 tiles)', () => {
    const tiles = generateDominoSet('double-6');
    expect(tiles.length).toBe(28);
    expect(getSetTileCount('double-6')).toBe(28);
    expect(getMaxPips('double-6')).toBe(6);
  });

  it('generates the exact count of tiles for Double-7 (36 tiles)', () => {
    const tiles = generateDominoSet('double-7');
    expect(tiles.length).toBe(36);
    expect(getSetTileCount('double-7')).toBe(36);
  });

  it('generates the exact count of tiles for Double-8 (45 tiles)', () => {
    const tiles = generateDominoSet('double-8');
    expect(tiles.length).toBe(45);
    expect(getSetTileCount('double-8')).toBe(45);
  });

  it('generates the exact count of tiles for Double-9 (55 tiles)', () => {
    const tiles = generateDominoSet('double-9');
    expect(tiles.length).toBe(55);
    expect(getSetTileCount('double-9')).toBe(55);
  });

  it('has zero duplicate tiles in any generated set', () => {
    const sets = ['double-6', 'double-7', 'double-8', 'double-9'] as const;
    for (const setType of sets) {
      const tiles = generateDominoSet(setType);
      const ids = new Set(tiles.map((t) => t.id));
      expect(ids.size).toBe(tiles.length);

      // Verify sideA <= sideB and unique pair
      const pairSet = new Set();
      for (const t of tiles) {
        expect(t.sideA).toBeLessThanOrEqual(t.sideB);
        pairSet.add(`${t.sideA}-${t.sideB}`);
      }
      expect(pairSet.size).toBe(tiles.length);
    }
  });

  it('validates game configuration mathematical compatibility', () => {
    // 4 players with 7 tiles in Double-6 = 28 tiles (exact fit)
    const validFit = validateGameConfig('double-6', 4, 7, 0);
    expect(validFit.valid).toBe(true);

    // 4 players with 8 tiles in Double-6 = 32 tiles (fails)
    const invalidFit = validateGameConfig('double-6', 4, 8, 0);
    expect(invalidFit.valid).toBe(false);
    expect(invalidFit.error).toContain('Not enough tiles');

    // 4 players with 7 tiles and 2 protected tiles in Double-6 = 30 tiles (fails)
    const invalidProtected = validateGameConfig('double-6', 4, 7, 2);
    expect(invalidProtected.valid).toBe(false);

    // 4 players with 7 tiles in Double-7 (36 tiles) = fits with 8 tiles for boneyard
    const validD7 = validateGameConfig('double-7', 4, 7, 2);
    expect(validD7.valid).toBe(true);
  });
});
