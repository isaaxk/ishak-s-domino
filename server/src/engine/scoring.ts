import { PlacedTile, DominoTile, OpenEndInfo } from '../shared/types.js';

/**
 * Determines open exposed ends of the domino chain and calculates their sum.
 * In All Fives, when tiles branch into 4 directions (Left, Right, Top, Bottom),
 * all 4 ends are evaluated and added together.
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

  // 2. Multiple Tiles: Calculate up to 4 open ends (Left, Right, Top, Bottom)
  const openEnds: OpenEndInfo[] = [];

  // Extremity tiles along both axes
  const leftMost = board.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), board[0]);
  const rightMost = board.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), board[0]);
  const topMost = board.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), board[0]);
  const bottomMost = board.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), board[0]);

  // Baseline horizontal spine level (average Y between leftMost and rightMost)
  const baselineY = (leftMost.y + rightMost.y) / 2;

  // --- 1. LEFT EXTREMITY END ---
  if (leftMost.isDouble && (leftMost.rotation === 90 || leftMost.rotation === 270)) {
    // Crosswise double at extremity counts both ends of the double: sideA + sideB
    openEnds.push({
      tileId: leftMost.id,
      side: 'A',
      pipValue: leftMost.sideA + leftMost.sideB,
      x: leftMost.x - 25,
      y: leftMost.y,
    });
  } else {
    // Horizontal tile:
    // Rotation 0: Side A is outer left, Side B is right
    // Rotation 180: Side B is outer left, Side A is right
    const exposedPip = leftMost.rotation === 180 ? leftMost.sideB : leftMost.sideA;
    openEnds.push({
      tileId: leftMost.id,
      side: leftMost.rotation === 180 ? 'B' : 'A',
      pipValue: exposedPip,
      x: leftMost.x - 42,
      y: leftMost.y,
    });
  }

  // --- 2. RIGHT EXTREMITY END (if distinct from left-most) ---
  if (rightMost.id !== leftMost.id) {
    if (rightMost.isDouble && (rightMost.rotation === 90 || rightMost.rotation === 270)) {
      openEnds.push({
        tileId: rightMost.id,
        side: 'B',
        pipValue: rightMost.sideA + rightMost.sideB,
        x: rightMost.x + 25,
        y: rightMost.y,
      });
    } else {
      // Rotation 0: Side B is outer right, Side A is left
      // Rotation 180: Side A is outer right, Side B is left
      const exposedPip = rightMost.rotation === 180 ? rightMost.sideA : rightMost.sideB;
      openEnds.push({
        tileId: rightMost.id,
        side: rightMost.rotation === 180 ? 'A' : 'B',
        pipValue: exposedPip,
        x: rightMost.x + 42,
        y: rightMost.y,
      });
    }
  }

  // --- 3. TOP EXTREMITY END (North road) ---
  // Active vertical branch when topMost is significantly above baseline
  if (topMost.y < baselineY - 20) {
    const isVertical = topMost.rotation === 90 || topMost.rotation === 270;
    if (isVertical) {
      // Rotation 90: Side A is at top, Side B is at bottom
      // Rotation 270: Side B is at top, Side A is at bottom
      const exposedPip = topMost.rotation === 90 ? topMost.sideA : topMost.sideB;
      openEnds.push({
        tileId: topMost.id,
        side: topMost.rotation === 90 ? 'A' : 'B',
        pipValue: exposedPip,
        x: topMost.x,
        y: topMost.y - 42,
      });
    } else {
      // Horizontal double at top extremity
      const pipVal = topMost.isDouble ? (topMost.sideA + topMost.sideB) : topMost.sideA;
      openEnds.push({
        tileId: topMost.id,
        side: 'A',
        pipValue: pipVal,
        x: topMost.x,
        y: topMost.y - 25,
      });
    }
  } else {
    // If no vertical branch yet, check if there is an active crosswise spinner double on the baseline
    // whose top is open (no tile placed above it)
    const spinners = board.filter(
      (t) => t.isDouble && (t.rotation === 90 || t.rotation === 270) && Math.abs(t.y - baselineY) < 15
    );
    for (const sp of spinners) {
      const hasTileAbove = board.some((t) => t.id !== sp.id && Math.abs(t.x - sp.x) < 30 && t.y < sp.y - 10);
      if (!hasTileAbove && !openEnds.some((e) => e.tileId === sp.id && e.side === 'A')) {
        openEnds.push({
          tileId: sp.id,
          side: 'A',
          pipValue: sp.sideA,
          x: sp.x,
          y: sp.y - 25,
        });
        break;
      }
    }
  }

  // --- 4. BOTTOM EXTREMITY END (South road) ---
  // Active vertical branch when bottomMost is significantly below baseline
  if (bottomMost.y > baselineY + 20) {
    const isVertical = bottomMost.rotation === 90 || bottomMost.rotation === 270;
    if (isVertical) {
      // Rotation 90: Side B is at bottom
      // Rotation 270: Side A is at bottom
      const exposedPip = bottomMost.rotation === 90 ? bottomMost.sideB : bottomMost.sideA;
      openEnds.push({
        tileId: bottomMost.id,
        side: bottomMost.rotation === 90 ? 'B' : 'A',
        pipValue: exposedPip,
        x: bottomMost.x,
        y: bottomMost.y + 42,
      });
    } else {
      // Horizontal double at bottom extremity
      const pipVal = bottomMost.isDouble ? (bottomMost.sideA + bottomMost.sideB) : bottomMost.sideB;
      openEnds.push({
        tileId: bottomMost.id,
        side: 'B',
        pipValue: pipVal,
        x: bottomMost.x,
        y: bottomMost.y + 25,
      });
    }
  } else {
    // Check if there is an active crosswise spinner double on the baseline
    // whose bottom is open (no tile placed below it)
    const spinners = board.filter(
      (t) => t.isDouble && (t.rotation === 90 || t.rotation === 270) && Math.abs(t.y - baselineY) < 15
    );
    for (const sp of spinners) {
      const hasTileBelow = board.some((t) => t.id !== sp.id && Math.abs(t.x - sp.x) < 30 && t.y > sp.y + 10);
      if (!hasTileBelow && !openEnds.some((e) => e.tileId === sp.id && e.side === 'B')) {
        openEnds.push({
          tileId: sp.id,
          side: 'B',
          pipValue: sp.sideB,
          x: sp.x,
          y: sp.y + 25,
        });
        break;
      }
    }
  }

  // Total sum of all open ends (addition of all 4 ends)
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
