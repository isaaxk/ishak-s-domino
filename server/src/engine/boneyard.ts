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

  if (playerIds.length === 0) {
    return {
      playerHands,
      boneyard: availableTiles,
    };
  }

  // Ensure tilesPerPlayer cannot exceed the equal distribution of available tiles
  const maxPossiblePerPlayer = Math.floor(allTiles.length / playerIds.length);
  const targetHandSize = Math.max(1, Math.min(tilesPerPlayer, maxPossiblePerPlayer));

  // 1. If there is a designated starting tile (e.g., when startingTileRule === 'specific-tile'),
  // assign it to the starting player if specified, or pick a random player (never hardcoded to host).
  let assignedStartingTile: DominoTile | undefined;
  if (startingTileId) {
    const tileIndex = availableTiles.findIndex((t) => t.id === startingTileId);
    if (tileIndex !== -1) {
      const tile = availableTiles.splice(tileIndex, 1)[0];
      assignedStartingTile = tile;
      const recipient = startingPlayerId && playerHands[startingPlayerId]
        ? startingPlayerId
        : playerIds[Math.floor(Math.random() * playerIds.length)];
      playerHands[recipient].push(tile);
    }
  }

  // 2. Identify protected tiles (tiles host decided must NOT remain in boneyard)
  // Ensure they get distributed to some player at random so host is never biased.
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

  // Distribute protected tiles to random eligible players who still need tiles
  const shuffledProtected = shuffleTiles(protectedTilesToDeal);
  for (const protTile of shuffledProtected) {
    const eligible = playerIds.filter((pid) => playerHands[pid].length < targetHandSize);
    if (eligible.length > 0) {
      const randomPlayer = eligible[Math.floor(Math.random() * eligible.length)];
      playerHands[randomPlayer].push(protTile);
    } else {
      // If hands are full, put back in shuffled pool
      shuffledPool.push(protTile);
    }
  }

  // 3. Deal round-robin with random starting offset so tiles are distributed 1-by-1 randomly
  const dealOrder = [...playerIds];
  const startOffset = Math.floor(Math.random() * dealOrder.length);
  for (let round = 0; round < targetHandSize; round++) {
    for (let i = 0; i < dealOrder.length; i++) {
      const pid = dealOrder[(i + startOffset) % dealOrder.length];
      if (playerHands[pid].length < targetHandSize && shuffledPool.length > 0) {
        const drawn = shuffledPool.pop();
        if (drawn) {
          playerHands[pid].push(drawn);
        }
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
  if (boneyard.length === 0) {
    return {
      tile: null,
      remainingBoneyard: boneyard,
      error: 'Boneyard empty (0 tiles remaining in draw pile)',
    };
  }

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
