import crypto from 'node:crypto';
import { DominoTile } from '../shared/types.js';

/**
 * Performs a cryptographically secure Fisher-Yates shuffle on an array of domino tiles.
 */
export function shuffleTiles(tiles: DominoTile[]): DominoTile[] {
  const array = [...tiles];
  for (let i = array.length - 1; i > 0; i--) {
    const randomBuffer = crypto.randomBytes(4);
    const randomIndex = randomBuffer.readUInt32LE(0) % (i + 1);
    [array[i], array[randomIndex]] = [array[randomIndex], array[i]];
  }
  return array;
}

export interface DealResult {
  playerHands: Record<string, DominoTile[]>;
  boneyard: DominoTile[];
  startingPlayerId?: string;
  startingTile?: DominoTile;
}

/**
 * Prepares the deal, separating protected tiles so they do not get trapped in the boneyard,
 * and deals the configured number of tiles to each player.
 */
export function dealTiles(
  allTiles: DominoTile[],
  playerIds: string[],
  tilesPerPlayer: number,
  options: {
    protectedTileIds?: string[];
    startingTileId?: string;
    startingPlayerId?: string;
  } = {}
): DealResult {
  const { protectedTileIds = [], startingTileId, startingPlayerId } = options;

  // Clone tiles
  let availableTiles = [...allTiles];

  // Initialize empty hands
  const playerHands: Record<string, DominoTile[]> = {};
  for (const pid of playerIds) {
    playerHands[pid] = [];
  }

  // 1. If there is a designated starting tile (e.g., tile-0-0 for All Fives),
  // assign it to the starting player (or first player) so they can start the game.
  let assignedStartingTile: DominoTile | undefined;
  if (startingTileId) {
    const tileIndex = availableTiles.findIndex((t) => t.id === startingTileId);
    if (tileIndex !== -1) {
      const tile = availableTiles.splice(tileIndex, 1)[0];
      assignedStartingTile = tile;
      const recipient = startingPlayerId && playerHands[startingPlayerId]
        ? startingPlayerId
        : playerIds[0];
      playerHands[recipient].push(tile);
    }
  }

  // 2. Identify protected tiles (tiles that must NOT remain in the boneyard)
  // Ensure they get prioritized into player hands during deal.
  const protectedTilesToDeal: DominoTile[] = [];
  for (const protId of protectedTileIds) {
    // If it was already dealt as starting tile, skip
    if (protId === startingTileId) continue;
    const idx = availableTiles.findIndex((t) => t.id === protId);
    if (idx !== -1) {
      protectedTilesToDeal.push(availableTiles.splice(idx, 1)[0]);
    }
  }

  // Shuffle remaining pool
  let shuffledPool = shuffleTiles(availableTiles);

  // Distribute protected tiles first to players who still need tiles
  for (const protTile of protectedTilesToDeal) {
    const eligiblePlayer = playerIds.find((pid) => playerHands[pid].length < tilesPerPlayer);
    if (eligiblePlayer) {
      playerHands[eligiblePlayer].push(protTile);
    } else {
      // If hands are somehow full, put back in shuffled pool
      shuffledPool.push(protTile);
    }
  }

  // Fill up each player's hand until they have `tilesPerPlayer`
  for (const pid of playerIds) {
    while (playerHands[pid].length < tilesPerPlayer && shuffledPool.length > 0) {
      const drawn = shuffledPool.pop();
      if (drawn) {
        playerHands[pid].push(drawn);
      }
    }
  }

  // Remaining tiles become the boneyard
  const boneyard = shuffledPool;

  return {
    playerHands,
    boneyard,
    startingPlayerId: startingPlayerId || playerIds[0],
    startingTile: assignedStartingTile,
  };
}

/**
 * Draws a single tile from the boneyard, strictly checking protected boneyard count limit.
 */
export function drawFromBoneyard(
  boneyard: DominoTile[],
  protectedCount: number = 0
): { tile: DominoTile | null; remainingBoneyard: DominoTile[]; error?: string } {
  if (boneyard.length <= protectedCount) {
    return {
      tile: null,
      remainingBoneyard: boneyard,
      error: `Cannot draw: boneyard has reached minimum protected count (${protectedCount} tiles)`,
    };
  }

  const nextBoneyard = [...boneyard];
  const tile = nextBoneyard.pop() || null;

  return {
    tile,
    remainingBoneyard: nextBoneyard,
  };
}
