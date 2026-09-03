import { DominoTile, PlacedTile, PlacementSide, OpenEndInfo } from '../shared/types.js';

// Visual tile units on the coordinate plane
export const TILE_LENGTH = 80;
export const TILE_WIDTH = 40;
export const TILE_GAP = 6;

/**
 * Calculates board bounding box.
 */
export function getBoardBounds(board: PlacedTile[]) {
  if (board.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const tile of board) {
    const isRotated = tile.rotation === 90 || tile.rotation === 270;
    const w = isRotated ? TILE_WIDTH : TILE_LENGTH;
    const h = isRotated ? TILE_LENGTH : TILE_WIDTH;

    minX = Math.min(minX, tile.x - w / 2);
    maxX = Math.max(maxX, tile.x + w / 2);
    minY = Math.min(minY, tile.y - h / 2);
    maxY = Math.max(maxY, tile.y + h / 2);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Places a tile on the board, supporting left attachment, right attachment,
 * or free placement at (x, y).
 */
export function placeTileOnBoard(
  currentBoard: PlacedTile[],
  tile: DominoTile,
  playerId: string,
  turnNumber: number,
  stepIndex: number,
  options: {
    placementSide?: PlacementSide;
    x?: number;
    y?: number;
    rotation?: number;
    attachedToId?: string;
  } = {}
): { placedTile: PlacedTile; newBoard: PlacedTile[] } {
  let { placementSide = 'right', x, y, rotation } = options;

  if (currentBoard.length === 0) {
    // First tile placed in center of board
    const firstRotation = tile.isDouble ? 90 : 0;
    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: 0,
      y: 0,
      rotation: rotation !== undefined ? rotation : firstRotation,
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'free',
      openPipsA: true,
      openPipsB: true,
    };

    return {
      placedTile,
      newBoard: [placedTile],
    };
  }

  // If explicit coordinates given in free placement
  if (x !== undefined && y !== undefined) {
    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x,
      y,
      rotation: rotation || 0,
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: placementSide || 'free',
      attachedToId: options.attachedToId,
    };

    return {
      placedTile,
      newBoard: [...currentBoard, placedTile],
    };
  }

  // Automatic Left / Right / Top / Bottom placement adjacent to chain
  if (placementSide === 'left') {
    const leftMost = currentBoard.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), currentBoard[0]);
    const isRotated = leftMost.rotation === 90 || leftMost.rotation === 270;
    const leftMostW = isRotated ? TILE_WIDTH : TILE_LENGTH;

    const tileRotated = (rotation !== undefined) ? (rotation === 90 || rotation === 270) : tile.isDouble;
    const targetW = tileRotated ? TILE_WIDTH : TILE_LENGTH;

    const targetX = leftMost.x - leftMostW / 2 - TILE_GAP - targetW / 2;
    const targetY = leftMost.y;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rotation !== undefined ? rotation : (tile.isDouble ? 90 : 0),
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'left',
      attachedToId: leftMost.id,
    };

    return {
      placedTile,
      newBoard: [placedTile, ...currentBoard],
    };
  } else if (placementSide === 'top') {
    const topMost = currentBoard.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), currentBoard[0]);
    const isRotated = topMost.rotation === 90 || topMost.rotation === 270;
    const topMostH = isRotated ? TILE_LENGTH : TILE_WIDTH;

    const tileRotated = (rotation !== undefined) ? (rotation === 90 || rotation === 270) : true;
    const targetH = tileRotated ? TILE_LENGTH : TILE_WIDTH;

    const targetX = topMost.x;
    const targetY = topMost.y - topMostH / 2 - TILE_GAP - targetH / 2;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rotation !== undefined ? rotation : 90,
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'top',
      attachedToId: topMost.id,
    };

    return {
      placedTile,
      newBoard: [...currentBoard, placedTile],
    };
  } else if (placementSide === 'bottom') {
    const bottomMost = currentBoard.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), currentBoard[0]);
    const isRotated = bottomMost.rotation === 90 || bottomMost.rotation === 270;
    const bottomMostH = isRotated ? TILE_LENGTH : TILE_WIDTH;

    const tileRotated = (rotation !== undefined) ? (rotation === 90 || rotation === 270) : true;
    const targetH = tileRotated ? TILE_LENGTH : TILE_WIDTH;

    const targetX = bottomMost.x;
    const targetY = bottomMost.y + bottomMostH / 2 + TILE_GAP + targetH / 2;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rotation !== undefined ? rotation : 90,
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'bottom',
      attachedToId: bottomMost.id,
    };

    return {
      placedTile,
      newBoard: [...currentBoard, placedTile],
    };
  } else {
    // Default right attachment
    const rightMost = currentBoard.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), currentBoard[0]);
    const isRotated = rightMost.rotation === 90 || rightMost.rotation === 270;
    const rightMostW = isRotated ? TILE_WIDTH : TILE_LENGTH;

    const tileRotated = (rotation !== undefined) ? (rotation === 90 || rotation === 270) : tile.isDouble;
    const targetW = tileRotated ? TILE_WIDTH : TILE_LENGTH;

    const targetX = rightMost.x + rightMostW / 2 + TILE_GAP + targetW / 2;
    const targetY = rightMost.y;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rotation !== undefined ? rotation : (tile.isDouble ? 90 : 0),
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'right',
      attachedToId: rightMost.id,
    };

    return {
      placedTile,
      newBoard: [...currentBoard, placedTile],
    };
  }
}
