import { PlacedTile, DominoTile, OpenEndInfo } from '../shared/types.js';

/**
 * Determines open exposed ends of the domino chain and calculates their sum.
 * Designed to work seamlessly even with free physical placement.
 */
export function calculateOpenEnds(board: PlacedTile[]): { openEnds: OpenEndInfo[]; sum: number } {
  if (board.length === 0) {
    return { openEnds: [], sum: 0 };
  }

  if (board.length === 1) {
    const tile = board[0];
    if (tile.isDouble) {
      // For a double tile as the solitary domino, both ends are open (e.g. [5|5] -> 5 + 5 = 10)
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x - 20, y: tile.y },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x + 20, y: tile.y },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    } else {
      // Non-double solitary tile: both ends open
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x - 40, y: tile.y },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x + 40, y: tile.y },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    }
  }

  // Identify left-most and right-most extremity tiles
  const leftMost = board.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), board[0]);
  const rightMost = board.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), board[0]);

  const openEnds: OpenEndInfo[] = [];

  // 1. Left extremity exposed end
  if (leftMost.isDouble && (leftMost.rotation === 90 || leftMost.rotation === 270)) {
    // Crosswise double at the end counts both ends of the double: sideA + sideB
    openEnds.push({
      tileId: leftMost.id,
      side: 'A',
      pipValue: leftMost.sideA + leftMost.sideB,
      x: leftMost.x,
      y: leftMost.y,
    });
  } else {
    // Oriented horizontally
    // Rotation 0: sideA is left (outer/exposed), sideB is right (connected)
    // Rotation 180: sideB is left (outer/exposed), sideA is right
    const exposedPip = leftMost.rotation === 180 ? leftMost.sideB : leftMost.sideA;
    openEnds.push({
      tileId: leftMost.id,
      side: leftMost.rotation === 180 ? 'B' : 'A',
      pipValue: exposedPip,
      x: leftMost.x - 40,
      y: leftMost.y,
    });
  }

  // 2. Right extremity exposed end (if distinct from left-most)
  if (rightMost.id !== leftMost.id) {
    if (rightMost.isDouble && (rightMost.rotation === 90 || rightMost.rotation === 270)) {
      openEnds.push({
        tileId: rightMost.id,
        side: 'B',
        pipValue: rightMost.sideA + rightMost.sideB,
        x: rightMost.x,
        y: rightMost.y,
      });
    } else {
      // Rotation 0: sideB is right (outer/exposed)
      // Rotation 180: sideA is right (outer/exposed)
      const exposedPip = rightMost.rotation === 180 ? rightMost.sideA : rightMost.sideB;
      openEnds.push({
        tileId: rightMost.id,
        side: rightMost.rotation === 180 ? 'A' : 'B',
        pipValue: exposedPip,
        x: rightMost.x + 40,
        y: rightMost.y,
      });
    }
  }

  const sum = openEnds.reduce((acc, end) => acc + end.pipValue, 0);
  return { openEnds, sum };
}

/**
 * Evaluates All Fives scoring:
 * If the sum of open ends is a multiple of 5 (5, 10, 15, 20, 25...),
 * the player scores that sum. Otherwise scores 0.
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
  isTie: boolean;
  lowestTotal: number;
  playerTotals: Record<string, number>;
} {
  const playerTotals: Record<string, number> = {};
  let lowestTotal = Infinity;
  let winnerId: string | null = null;
  let isTie = false;

  for (const pid of playerIds) {
    const total = calculatePipsSum(allHands[pid] || []);
    playerTotals[pid] = total;

    if (total < lowestTotal) {
      lowestTotal = total;
      winnerId = pid;
      isTie = false;
    } else if (total === lowestTotal) {
      isTie = true;
    }
  }

  return {
    winnerId: isTie ? null : winnerId,
    isTie,
    lowestTotal: lowestTotal === Infinity ? 0 : lowestTotal,
    playerTotals,
  };
}
