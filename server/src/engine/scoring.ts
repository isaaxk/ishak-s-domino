import { PlacedTile, DominoTile, OpenEndInfo } from '../shared/types.js';
import { getTileDimensions } from './board.js';

/**
 * Checks if two placed tiles are adjacent/connected on the table grid.
 */
function areTilesConnected(a: PlacedTile, b: PlacedTile): boolean {
  if (a.id === b.id) return false;
  if (a.attachedToId === b.id || b.attachedToId === a.id) return true;

  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  if (dist > 95) return false;

  const dimA = getTileDimensions(a.rotation);
  const dimB = getTileDimensions(b.rotation);

  const xOverlap = Math.min(a.x + dimA.width / 2, b.x + dimB.width / 2) -
                   Math.max(a.x - dimA.width / 2, b.x - dimB.width / 2);
  const yOverlap = Math.min(a.y + dimA.height / 2, b.y + dimB.height / 2) -
                   Math.max(a.y - dimA.height / 2, b.y - dimB.height / 2);

  return (yOverlap >= 5 && Math.abs(a.x - b.x) <= 95) ||
         (xOverlap >= 5 && Math.abs(a.y - b.y) <= 95);
}

/**
 * Evaluates an open end on an exposed leaf tile at the tip of a branch.
 */
function evaluateLeaf(leaf: PlacedTile, parent?: PlacedTile, board?: PlacedTile[]): OpenEndInfo {
  // If parent is undefined but other tiles exist on board, use their center of mass as effective parent
  let effectiveParent: { x: number; y: number } | undefined = parent;
  if (!effectiveParent && board && board.length > 1) {
    const others = board.filter((t) => t.id !== leaf.id);
    if (others.length > 0) {
      const avgX = others.reduce((acc, t) => acc + t.x, 0) / others.length;
      const avgY = others.reduce((acc, t) => acc + t.y, 0) / others.length;
      effectiveParent = { x: avgX, y: avgY };
    }
  }

  // 1. Double tile at leaf
  if (leaf.isDouble) {
    let isCrosswise = true;
    if (effectiveParent) {
      const isParentVertical = Math.abs(leaf.y - effectiveParent.y) > Math.abs(leaf.x - effectiveParent.x);
      const isLeafVertical = leaf.rotation === 90 || leaf.rotation === 270;
      if (isParentVertical === isLeafVertical) {
        isCrosswise = false; // Inline double
      }
    }

    if (isCrosswise) {
      // Both ends count: sideA + sideB
      let badgeX = leaf.x;
      let badgeY = leaf.y;
      if (effectiveParent) {
        const dx = leaf.x - effectiveParent.x;
        const dy = leaf.y - effectiveParent.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          badgeX = leaf.x + (dx > 0 ? 25 : -25);
        } else {
          badgeY = leaf.y + (dy > 0 ? 25 : -25);
        }
      } else {
        badgeX = leaf.x + 25;
      }

      return {
        tileId: leaf.id,
        side: 'A',
        pipValue: leaf.sideA + leaf.sideB,
        x: badgeX,
        y: badgeY,
      };
    } else {
      // Inline double: only exposed outer end counts
      let exposedSide: 'A' | 'B' = 'B';
      let badgeX = leaf.x;
      let badgeY = leaf.y;

      const isLeafVertical = leaf.rotation === 90 || leaf.rotation === 270;
      if (isLeafVertical) {
        const sideAY = leaf.rotation === 90 ? leaf.y - 20 : leaf.y + 20;
        const sideBY = leaf.rotation === 90 ? leaf.y + 20 : leaf.y - 20;
        if (effectiveParent) {
          const distA = Math.abs(sideAY - effectiveParent.y);
          const distB = Math.abs(sideBY - effectiveParent.y);
          exposedSide = distA > distB ? 'A' : 'B';
        }
        const exposedY = exposedSide === 'A' ? sideAY : sideBY;
        badgeY = exposedY < leaf.y ? leaf.y - 42 : leaf.y + 42;
        badgeX = leaf.x;
      } else {
        const sideAX = leaf.rotation === 0 ? leaf.x - 20 : leaf.x + 20;
        const sideBX = leaf.rotation === 0 ? leaf.x + 20 : leaf.x - 20;
        if (effectiveParent) {
          const distA = Math.abs(sideAX - effectiveParent.x);
          const distB = Math.abs(sideBX - effectiveParent.x);
          exposedSide = distA > distB ? 'A' : 'B';
        }
        const exposedX = exposedSide === 'A' ? sideAX : sideBX;
        badgeX = exposedX < leaf.x ? leaf.x - 42 : leaf.x + 42;
        badgeY = leaf.y;
      }

      const pipValue = exposedSide === 'A' ? leaf.sideA : leaf.sideB;
      return {
        tileId: leaf.id,
        side: exposedSide,
        pipValue,
        x: badgeX,
        y: badgeY,
      };
    }
  }

  // 2. Non-double leaf: one half is connected to parent, the other half is exposed
  let exposedSide: 'A' | 'B' = 'A';
  let badgeX = leaf.x;
  let badgeY = leaf.y;

  const isLeafVertical = leaf.rotation === 90 || leaf.rotation === 270;
  if (isLeafVertical) {
    // rotation 90: sideA Top (y - 20), sideB Bottom (y + 20)
    // rotation 270: sideB Top (y - 20), sideA Bottom (y + 20)
    const sideAY = leaf.rotation === 90 ? leaf.y - 20 : leaf.y + 20;
    const sideBY = leaf.rotation === 90 ? leaf.y + 20 : leaf.y - 20;

    if (effectiveParent) {
      const distA = Math.abs(sideAY - effectiveParent.y);
      const distB = Math.abs(sideBY - effectiveParent.y);
      exposedSide = distA > distB ? 'A' : 'B';
    } else {
      exposedSide = 'A';
    }

    const exposedY = exposedSide === 'A' ? sideAY : sideBY;
    badgeY = exposedY < leaf.y ? leaf.y - 42 : leaf.y + 42;
    badgeX = leaf.x;
  } else {
    // rotation 0: sideA Left (x - 20), sideB Right (x + 20)
    // rotation 180: sideB Left (x - 20), sideA Right (x + 20)
    const sideAX = leaf.rotation === 0 ? leaf.x - 20 : leaf.x + 20;
    const sideBX = leaf.rotation === 0 ? leaf.x + 20 : leaf.x - 20;

    if (effectiveParent) {
      const distA = Math.abs(sideAX - effectiveParent.x);
      const distB = Math.abs(sideBX - effectiveParent.x);
      exposedSide = distA > distB ? 'A' : 'B';
    } else {
      exposedSide = 'A';
    }

    const exposedX = exposedSide === 'A' ? sideAX : sideBX;
    badgeX = exposedX < leaf.x ? leaf.x - 42 : leaf.x + 42;
    badgeY = leaf.y;
  }

  const pipValue = exposedSide === 'A' ? leaf.sideA : leaf.sideB;
  return {
    tileId: leaf.id,
    side: exposedSide,
    pipValue,
    x: badgeX,
    y: badgeY,
  };
}

/**
 * Returns the open end info on an uncovered port of the spinner.
 */
function getSpinnerOpenEnd(spinner: PlacedTile, dir: 'left' | 'right' | 'top' | 'bottom'): OpenEndInfo {
  if (dir === 'top') {
    return {
      tileId: spinner.id,
      side: 'A',
      pipValue: spinner.sideA,
      x: spinner.x,
      y: spinner.y - 25,
    };
  } else if (dir === 'bottom') {
    return {
      tileId: spinner.id,
      side: 'B',
      pipValue: spinner.sideB,
      x: spinner.x,
      y: spinner.y + 25,
    };
  } else if (dir === 'left') {
    return {
      tileId: spinner.id,
      side: 'A',
      pipValue: spinner.sideA,
      x: spinner.x - 25,
      y: spinner.y,
    };
  } else {
    return {
      tileId: spinner.id,
      side: 'B',
      pipValue: spinner.sideB,
      x: spinner.x + 25,
      y: spinner.y,
    };
  }
}

/**
 * Determines open exposed ends of the domino chain and calculates their sum.
 * In All Fives, when tiles branch into 4 directions (Left, Right, Top, Bottom)
 * from the spinner, all 4 branch ends/uncovered ports are evaluated and added together.
 */
export function calculateOpenEnds(board: PlacedTile[]): { openEnds: OpenEndInfo[]; sum: number } {
  if (board.length === 0) {
    return { openEnds: [], sum: 0 };
  }

  // 1. Single Solitary Tile on Board
  if (board.length === 1) {
    const tile = board[0];
    if (tile.isDouble) {
      // For a solitary double in All Fives, both ends are open (e.g. [5|5] -> 5 + 5 = 10)
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x, y: tile.y - 25 },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x, y: tile.y + 25 },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    } else {
      // Non-double solitary tile: both ends open
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x - 42, y: tile.y },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x + 42, y: tile.y },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    }
  }

  // 2. Build adjacency map
  const adj = new Map<string, PlacedTile[]>();
  for (const tile of board) {
    adj.set(tile.id, []);
  }

  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      if (areTilesConnected(board[i], board[j])) {
        adj.get(board[i].id)!.push(board[j]);
        adj.get(board[j].id)!.push(board[i]);
      }
    }
  }

  // 3. Find the Spinner (first double played in the round)
  const doubles = board.filter((t) => t.isDouble);
  const spinner = doubles.length > 0
    ? [...doubles].sort((a, b) => {
        const turnA = a.turnNumber ?? 0;
        const turnB = b.turnNumber ?? 0;
        if (turnA !== turnB) return turnA - turnB;
        const stepA = a.stepIndex ?? 0;
        const stepB = b.stepIndex ?? 0;
        if (stepA !== stepB) return stepA - stepB;
        return board.indexOf(a) - board.indexOf(b);
      })[0]
    : undefined;

  const spinnerNeighbors = spinner ? (adj.get(spinner.id) || []) : [];
  const isSpinnerActive = spinner && (spinner.id === board[0]?.id || spinnerNeighbors.length >= 2);

  const openEnds: OpenEndInfo[] = [];

  if (isSpinnerActive && spinner) {
    // Spinner is active: evaluate up to 4 branches (left, right, top, bottom)
    const branchStarts = new Map<'left' | 'right' | 'top' | 'bottom', PlacedTile>();

    for (const neighbor of spinnerNeighbors) {
      const dx = neighbor.x - spinner.x;
      const dy = neighbor.y - spinner.y;

      let dir: 'left' | 'right' | 'top' | 'bottom';
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx < 0 ? 'left' : 'right';
      } else {
        dir = dy < 0 ? 'top' : 'bottom';
      }

      if (!branchStarts.has(dir)) {
        branchStarts.set(dir, neighbor);
      } else {
        const existing = branchStarts.get(dir)!;
        if (Math.hypot(dx, dy) < Math.hypot(existing.x - spinner.x, existing.y - spinner.y)) {
          branchStarts.set(dir, neighbor);
        }
      }
    }

    // Evaluate each of the 4 directions
    for (const dir of ['left', 'right', 'top', 'bottom'] as const) {
      if (branchStarts.has(dir)) {
        const startNode = branchStarts.get(dir)!;
        let current = startNode;
        let prev = spinner;
        const visited = new Set<string>([spinner.id, current.id]);

        while (true) {
          const nextNeighbors = (adj.get(current.id) || []).filter((n) => !visited.has(n.id));
          if (nextNeighbors.length === 0) break;
          prev = current;
          current = nextNeighbors[0];
          visited.add(current.id);
        }

        openEnds.push(evaluateLeaf(current, prev));
      } else {
        // Port on spinner is uncovered/open
        openEnds.push(getSpinnerOpenEnd(spinner, dir));
      }
    }
  } else {
    // No active spinner: single chain with 2 open ends (leaves of the chain)
    const leaves = board.filter((t) => (adj.get(t.id) || []).length <= 1);

    if (leaves.length >= 2) {
      // Pick the two ends
      for (const leaf of leaves.slice(0, 2)) {
        const parent = (adj.get(leaf.id) || [])[0];
        openEnds.push(evaluateLeaf(leaf, parent, board));
      }
    } else if (leaves.length === 1) {
      const leaf = leaves[0];
      const parent = (adj.get(leaf.id) || [])[0];
      openEnds.push(evaluateLeaf(leaf, parent, board));
    } else {
      // Fallback: extremities along main axis
      const leftMost = board.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), board[0]);
      const rightMost = board.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), board[0]);
      openEnds.push(evaluateLeaf(leftMost, undefined, board));
      if (rightMost.id !== leftMost.id) {
        openEnds.push(evaluateLeaf(rightMost, undefined, board));
      }
    }
  }

  // Total sum of all open ends
  const sum = openEnds.reduce((acc, end) => acc + end.pipValue, 0);
  return { openEnds, sum };
}

/**
 * Evaluates All Fives scoring:
 * Sums all open ends (all four ends when active).
 * If the total sum is a multiple of 5 (5, 10, 15, 20, 25...),
 * the player scores that exact sum. Otherwise scores 0.
 */
export function calculateAllFivesTurnScore(board: PlacedTile[]): {
  points: number;
  openEndsSum: number;
  openEnds: OpenEndInfo[];
} {
  const { openEnds, sum } = calculateOpenEnds(board);
  const points = sum > 0 && sum % 5 === 0 ? sum : 0;
  return {
    points,
    openEndsSum: sum,
    openEnds,
  };
}

/**
 * Calculates sum of pips for an array of tiles.
 */
export function calculatePipsSum(tiles: DominoTile[]): number {
  return tiles.reduce((acc, t) => acc + t.totalPips, 0);
}

/**
 * Calculates Classic round end score awarded to the round winner.
 * The winner scores the total sum of pips remaining in all opponents' hands.
 */
export function calculateClassicRoundScore(
  winnerId: string,
  allHands: Record<string, DominoTile[]>
): number {
  let totalScore = 0;
  for (const [pid, hand] of Object.entries(allHands)) {
    if (pid !== winnerId) {
      totalScore += calculatePipsSum(hand);
    }
  }
  return totalScore;
}

/**
 * In case of a blocked game (no player can move or draw),
 * determines the winner by lowest hand pip total.
 */
export function evaluateBlockedRound(
  playerIds: string[],
  allHands: Record<string, DominoTile[]>
): {
  winnerId: string | null;
  lowestPipCount: number;
  lowestTotal: number;
  isTie: boolean;
} {
  let minPips = Infinity;
  let winnerId: string | null = null;
  let isTie = false;

  for (const pid of playerIds) {
    const hand = allHands[pid] || [];
    const pips = calculatePipsSum(hand);

    if (pips < minPips) {
      minPips = pips;
      winnerId = pid;
      isTie = false;
    } else if (pips === minPips) {
      isTie = true;
    }
  }

  return { winnerId: isTie ? null : winnerId, lowestPipCount: minPips, lowestTotal: minPips, isTie };
}
