import { DominoTile, PlacedTile, PlacementSide, OpenEndInfo, getMatchingRotation } from '../shared/types.js';

export { getMatchingRotation };

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
 * or free placement.
 * Guarantees that tiles on the horizontal road stay laser-aligned along Y=spineY,
 * and tiles on the vertical road stay laser-aligned along X=spineX.
 * Never allows any tile to be out of place or overlap.
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

  // First tile on an empty board: always centered at origin (0, 0)
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

  // Spine baselines (initial tile is at (0, 0))
  const spineY = currentBoard[0]?.y ?? 0;
  const spineX = currentBoard[0]?.x ?? 0;

  // If explicit free placement mode: snap to 10px grid so it never looks crooked
  if (placementSide === 'free' && x !== undefined && y !== undefined) {
    const snappedX = Math.round(x / 10) * 10;
    const snappedY = Math.round(y / 10) * 10;

    const placedTile: PlacedTile = {
      id: tile.id,
      sideA: tile.sideA,
      sideB: tile.sideB,
      isDouble: tile.isDouble,
      x: snappedX,
      y: snappedY,
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

  // Find board extremities
  const leftMost = currentBoard.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), currentBoard[0]);
  const rightMost = currentBoard.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), currentBoard[0]);
  const topMost = currentBoard.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), currentBoard[0]);
  const bottomMost = currentBoard.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), currentBoard[0]);

  // Determine base attachment tile: use attachedToId if specified, or pick corresponding extremity
  let baseTile: PlacedTile;
  if (options.attachedToId) {
    baseTile = currentBoard.find((t) => t.id === options.attachedToId) || rightMost;
  } else {
    switch (placementSide) {
      case 'left':
        baseTile = leftMost;
        break;
      case 'top':
      case 'turn-left':
      case 'turn-right':
        baseTile = topMost;
        break;
      case 'bottom':
        baseTile = bottomMost;
        break;
      case 'turn-up':
      case 'turn-down':
        baseTile = rightMost;
        break;
      case 'right':
      default:
        baseTile = rightMost;
        break;
    }
  }

  const isBaseVertical = baseTile.rotation === 90 || baseTile.rotation === 270;
  const baseDim = getTileDimensions(baseTile.rotation);

  let targetX = baseTile.x;
  let targetY = baseTile.y;
  let rot = rotation;

  if (placementSide === 'left') {
    if (rot === undefined) {
      rot = getMatchingRotation(tile, 'left', baseTile);
    }
    const targetDim = getTileDimensions(rot);
    targetX = baseTile.x - (baseDim.width / 2) - TILE_GAP - (targetDim.width / 2);
    targetY = baseTile.y;
  } else if (placementSide === 'right') {
    if (rot === undefined) {
      rot = getMatchingRotation(tile, 'right', baseTile);
    }
    const targetDim = getTileDimensions(rot);
    targetX = baseTile.x + (baseDim.width / 2) + TILE_GAP + (targetDim.width / 2);
    targetY = baseTile.y;
  } else if (placementSide === 'top') {
    if (rot === undefined) {
      rot = getMatchingRotation(tile, 'top', baseTile);
    }
    const targetDim = getTileDimensions(rot);
    targetX = baseTile.x;
    targetY = baseTile.y - (baseDim.height / 2) - TILE_GAP - (targetDim.height / 2);
  } else if (placementSide === 'bottom') {
    if (rot === undefined) {
      rot = getMatchingRotation(tile, 'bottom', baseTile);
    }
    const targetDim = getTileDimensions(rot);
    targetX = baseTile.x;
    targetY = baseTile.y + (baseDim.height / 2) + TILE_GAP + (targetDim.height / 2);
  } else if (placementSide === 'turn-up') {
    // 90° Turn Upwards (Snake / Corner)
    if (!isBaseVertical) {
      // Base tile is horizontal: align new vertical tile above the exposed half
      let isLeftEnd = false;
      if (leftMost.id !== rightMost.id) {
        isLeftEnd = baseTile.id === leftMost.id;
      } else if (options.x !== undefined && options.x < baseTile.x) {
        isLeftEnd = true;
      }
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'turn-up', baseTile, isLeftEnd);
      }
      const targetDim = getTileDimensions(rot);
      targetX = isLeftEnd ? baseTile.x - 20 : baseTile.x + 20;
      targetY = baseTile.y - (baseDim.height / 2) - TILE_GAP - (targetDim.height / 2);
    } else {
      // Base tile is already vertical: continue straight up
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'top', baseTile);
      }
      const targetDim = getTileDimensions(rot);
      targetX = baseTile.x;
      targetY = baseTile.y - (baseDim.height / 2) - TILE_GAP - (targetDim.height / 2);
    }
  } else if (placementSide === 'turn-down') {
    // 90° Turn Downwards (Snake / Corner)
    if (!isBaseVertical) {
      // Base tile is horizontal: align new vertical tile below the exposed half
      let isLeftEnd = false;
      if (leftMost.id !== rightMost.id) {
        isLeftEnd = baseTile.id === leftMost.id;
      } else if (options.x !== undefined && options.x < baseTile.x) {
        isLeftEnd = true;
      }
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'turn-down', baseTile, isLeftEnd);
      }
      const targetDim = getTileDimensions(rot);
      targetX = isLeftEnd ? baseTile.x - 20 : baseTile.x + 20;
      targetY = baseTile.y + (baseDim.height / 2) + TILE_GAP + (targetDim.height / 2);
    } else {
      // Base tile is already vertical: continue straight down
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'bottom', baseTile);
      }
      const targetDim = getTileDimensions(rot);
      targetX = baseTile.x;
      targetY = baseTile.y + (baseDim.height / 2) + TILE_GAP + (targetDim.height / 2);
    }
  } else if (placementSide === 'turn-left') {
    // 90° Turn Leftwards (Snake / Corner from vertical road)
    if (isBaseVertical) {
      // Base tile is vertical: align new horizontal tile to the left of the exposed half
      let isBottomEnd = false;
      if (topMost.id !== bottomMost.id) {
        isBottomEnd = baseTile.id === bottomMost.id;
      } else if (options.y !== undefined && options.y > baseTile.y) {
        isBottomEnd = true;
      }
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'turn-left', baseTile, !isBottomEnd);
      }
      const targetDim = getTileDimensions(rot);
      targetY = isBottomEnd ? baseTile.y + 20 : baseTile.y - 20;
      targetX = baseTile.x - (baseDim.width / 2) - TILE_GAP - (targetDim.width / 2);
    } else {
      // Base tile is already horizontal: continue straight left
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'left', baseTile);
      }
      const targetDim = getTileDimensions(rot);
      targetX = baseTile.x - (baseDim.width / 2) - TILE_GAP - (targetDim.width / 2);
      targetY = baseTile.y;
    }
  } else if (placementSide === 'turn-right') {
    // 90° Turn Rightwards (Snake / Corner from vertical road)
    if (isBaseVertical) {
      // Base tile is vertical: align new horizontal tile to the right of the exposed half
      let isBottomEnd = false;
      if (topMost.id !== bottomMost.id) {
        isBottomEnd = baseTile.id === bottomMost.id;
      } else if (options.y !== undefined && options.y > baseTile.y) {
        isBottomEnd = true;
      }
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'turn-right', baseTile, !isBottomEnd);
      }
      const targetDim = getTileDimensions(rot);
      targetY = isBottomEnd ? baseTile.y + 20 : baseTile.y - 20;
      targetX = baseTile.x + (baseDim.width / 2) + TILE_GAP + (targetDim.width / 2);
    } else {
      // Base tile is already horizontal: continue straight right
      if (rot === undefined) {
        rot = getMatchingRotation(tile, 'right', baseTile);
      }
      const targetDim = getTileDimensions(rot);
      targetX = baseTile.x + (baseDim.width / 2) + TILE_GAP + (targetDim.width / 2);
      targetY = baseTile.y;
    }
  } else {
    // Default right attachment
    if (rot === undefined) {
      rot = getMatchingRotation(tile, 'right', baseTile);
    }
    const targetDim = getTileDimensions(rot);
    targetX = baseTile.x + (baseDim.width / 2) + TILE_GAP + (targetDim.width / 2);
    targetY = baseTile.y;
  }

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
    placementSide,
    attachedToId: baseTile.id,
  };

  return {
    placedTile,
    newBoard: [...currentBoard, placedTile],
  };
}
