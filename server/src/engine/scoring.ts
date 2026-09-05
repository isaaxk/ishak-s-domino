import { PlacedTile, DominoTile, OpenEndInfo, calculateOpenEnds } from '../shared/types.js';

export { calculateOpenEnds };

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
