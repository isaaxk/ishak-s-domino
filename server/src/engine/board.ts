import { DominoTile, PlacedTile, PlacementSide, OpenEndInfo } from '../shared/types.js';

// Visual tile units on the coordinate plane
export const TILE_LENGTH = 80;
export const TILE_WIDTH = 40;
export const TILE_GAP = 3; // Close to each other without overlapping

/**
 * Returns exact bounding box width and height for a domino at a given rotation.
 */
export function getTileDimensions(rotation: number): { width: number; height: number } {
  const isVertical = rotation === 90 || rotation === 270;
  return {
    width: isVertical ? TILE_WIDTH : TILE_LENGTH, // 40 or 80
    height: isVertical ? TILE_LENGTH : TILE_WIDTH, // 80 or 40
  };
}

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
    const { width, height } = getTileDimensions(tile.rotation);
    minX = Math.min(minX, tile.x - width / 2);
    maxX = Math.max(maxX, tile.x + width / 2);
    minY = Math.min(minY, tile.y - height / 2);
    maxY = Math.max(maxY, tile.y + height / 2);
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
 * Places a tile on the board, supporting left, right, top, bottom attachment,
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

  // First tile on an empty board: centered at origin (0, 0)
  if (currentBoard.length === 0) {
    const defaultRotation = rotation !== undefined ? rotation : (tile.isDouble ? 90 : 0);
    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: 0,
      y: 0,
      rotation: defaultRotation,
      placedBy: playerId,
      turnNumber,
      stepIndex,
      placementSide: 'free',
    };

    return {
      placedTile,
      newBoard: [placedTile],
    };
  }

  // If explicit free placement mode: use given coordinates
  if (placementSide === 'free' && x !== undefined && y !== undefined) {
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
      placementSide: 'free',
      attachedToId: options.attachedToId,
    };

    return {
      placedTile,
      newBoard: [...currentBoard, placedTile],
    };
  }

  // Automatic Left / Right / Top / Bottom placement adjacent to chain without overlapping
  if (placementSide === 'left') {
    const leftMost = currentBoard.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), currentBoard[0]);
    const rot = rotation !== undefined ? rotation : (tile.isDouble ? 90 : 0);
    const baseDim = getTileDimensions(leftMost.rotation);
    const targetDim = getTileDimensions(rot);

    const targetX = leftMost.x - (baseDim.width / 2) - TILE_GAP - (targetDim.width / 2);
    const targetY = leftMost.y;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rot,
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
    const rot = rotation !== undefined ? rotation : 90;
    const baseDim = getTileDimensions(topMost.rotation);
    const targetDim = getTileDimensions(rot);

    const targetX = topMost.x;
    const targetY = topMost.y - (baseDim.height / 2) - TILE_GAP - (targetDim.height / 2);

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rot,
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
    const rot = rotation !== undefined ? rotation : 90;
    const baseDim = getTileDimensions(bottomMost.rotation);
    const targetDim = getTileDimensions(rot);

    const targetX = bottomMost.x;
    const targetY = bottomMost.y + (baseDim.height / 2) + TILE_GAP + (targetDim.height / 2);

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rot,
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
    const rot = rotation !== undefined ? rotation : (tile.isDouble ? 90 : 0);
    const baseDim = getTileDimensions(rightMost.rotation);
    const targetDim = getTileDimensions(rot);

    const targetX = rightMost.x + (baseDim.width / 2) + TILE_GAP + (targetDim.width / 2);
    const targetY = rightMost.y;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: targetX,
      y: targetY,
      rotation: rot,
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
