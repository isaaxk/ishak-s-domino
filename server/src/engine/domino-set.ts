import { DominoSetType, DominoTile } from '../shared/types.js';

export function getMaxPips(setType: DominoSetType): number {
  switch (setType) {
    case 'double-6':
      return 6;
    case 'double-7':
      return 7;
    case 'double-8':
      return 8;
    case 'double-9':
      return 9;
    default:
      return 6;
  }
}

export function getSetTileCount(setType: DominoSetType): number {
  const n = getMaxPips(setType);
  // Total tiles formula: (n + 1) * (n + 2) / 2
  return ((n + 1) * (n + 2)) / 2;
}

/**
 * Generates a complete set of unique domino tiles for a given set type.
 * e.g., Double-6 produces 28 tiles (0-0 through 6-6) with no duplicates.
 */
export function generateDominoSet(setType: DominoSetType): DominoTile[] {
  const maxPip = getMaxPips(setType);
  const tiles: DominoTile[] = [];

  for (let a = 0; a <= maxPip; a++) {
    for (let b = a; b <= maxPip; b++) {
      tiles.push({
        id: `tile-${a}-${b}`,
        sideA: a,
        sideB: b,
        totalPips: a + b,
        isDouble: a === b,
      });
    }
  }

  return tiles;
}

/**
 * Validates whether the configured player count and tiles per player
 * are mathematically compatible with the selected domino set.
 */
export function validateGameConfig(
  setType: DominoSetType,
  playerCount: number,
  tilesPerPlayer: number,
  protectedTilesCount: number = 0
): { valid: boolean; totalTiles: number; requiredTiles: number; error?: string } {
  const totalTiles = getSetTileCount(setType);
  const requiredTiles = playerCount * tilesPerPlayer + protectedTilesCount;

  if (playerCount < 2) {
    return { valid: false, totalTiles, requiredTiles, error: 'At least 2 players are required' };
  }

  if (tilesPerPlayer < 1) {
    return { valid: false, totalTiles, requiredTiles, error: 'Each player must receive at least 1 tile' };
  }

  if (requiredTiles > totalTiles) {
    return {
      valid: false,
      totalTiles,
      requiredTiles,
      error: `Not enough tiles in ${setType} (${totalTiles} total) for ${playerCount} players with ${tilesPerPlayer} tiles each (requires ${requiredTiles} tiles)`,
    };
  }

  return { valid: true, totalTiles, requiredTiles };
}
