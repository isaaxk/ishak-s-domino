import { describe, it, expect } from 'vitest';
import {
  calculateOpenEnds,
  calculateAllFivesTurnScore,
  calculateClassicRoundScore,
  evaluateBlockedRound,
} from '../src/engine/scoring.js';
import { PlacedTile, DominoTile } from '../../shared/types.js';

describe('Scoring Engine (Classic & All Fives)', () => {
  it('calculates open ends on a single tile for All Fives', () => {
    // Solitary double [5|5] -> 5 + 5 = 10 -> awards 10 points
    const doubleTile: PlacedTile = {
      id: 'tile-5-5',
      sideA: 5,
      sideB: 5,
      isDouble: true,
      x: 0,
      y: 0,
      rotation: 90,
      placedBy: 'p1',
      turnNumber: 1,
      stepIndex: 0,
    };

    const resDouble = calculateAllFivesTurnScore([doubleTile]);
    expect(resDouble.openEndsSum).toBe(10);
    expect(resDouble.points).toBe(10);

    // Solitary [0|0] -> 0 points
    const blankTile: PlacedTile = {
      id: 'tile-0-0',
      sideA: 0,
      sideB: 0,
      isDouble: true,
      x: 0,
      y: 0,
      rotation: 90,
      placedBy: 'p1',
      turnNumber: 1,
      stepIndex: 0,
    };
    const resBlank = calculateAllFivesTurnScore([blankTile]);
    expect(resBlank.openEndsSum).toBe(0);
    expect(resBlank.points).toBe(0);

    // Solitary [6|4] -> 6 + 4 = 10 points
    const nonDouble: PlacedTile = {
      id: 'tile-4-6',
      sideA: 4,
      sideB: 6,
      isDouble: false,
      x: 0,
      y: 0,
      rotation: 0,
      placedBy: 'p1',
      turnNumber: 1,
      stepIndex: 0,
    };
    const resNonDouble = calculateAllFivesTurnScore([nonDouble]);
    expect(resNonDouble.openEndsSum).toBe(10);
    expect(resNonDouble.points).toBe(10);
  });

  it('calculates open ends sum for multiple connected dominoes in All Fives', () => {
    // Board with two tiles:
    // Left: [3|2] at x = -86 (exposed outer sideA = 3)
    // Right: [2|2] at x = 0 (exposed outer sideB = 2)
    // Total open ends = 3 + 2 = 5 -> awards 5 points!
    const board: PlacedTile[] = [
      {
        id: 'tile-2-3',
        sideA: 3,
        sideB: 2,
        isDouble: false,
        x: -86,
        y: 0,
        rotation: 0,
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
      },
      {
        id: 'tile-2-2',
        sideA: 2,
        sideB: 2,
        isDouble: true,
        x: 0,
        y: 0,
        rotation: 0,
        placedBy: 'p2',
        turnNumber: 1,
        stepIndex: 0,
      },
    ];

    const result = calculateAllFivesTurnScore(board);
    expect(result.openEndsSum).toBe(5);
    expect(result.points).toBe(5);
  });

  it('calculates 10 points for open ends of 6 and 4', () => {
    // Left tile exposes 6, right tile exposes 4
    const board: PlacedTile[] = [
      {
        id: 'tile-2-6',
        sideA: 6,
        sideB: 2,
        isDouble: false,
        x: -86,
        y: 0,
        rotation: 0,
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
      },
      {
        id: 'tile-2-4',
        sideA: 2,
        sideB: 4,
        isDouble: false,
        x: 86,
        y: 0,
        rotation: 0,
        placedBy: 'p2',
        turnNumber: 1,
        stepIndex: 0,
      },
    ];

    const result = calculateAllFivesTurnScore(board);
    expect(result.openEndsSum).toBe(10);
    expect(result.points).toBe(10);
  });

  it('calculates 0 points when open ends sum is not a multiple of 5', () => {
    // Left tile exposes 6, right tile exposes 2 -> sum 8 -> 0 pts
    const board: PlacedTile[] = [
      {
        id: 'tile-1-6',
        sideA: 6,
        sideB: 1,
        isDouble: false,
        x: -86,
        y: 0,
        rotation: 0,
        placedBy: 'p1',
        turnNumber: 1,
        stepIndex: 0,
      },
      {
        id: 'tile-1-2',
        sideA: 1,
        sideB: 2,
        isDouble: false,
        x: 86,
        y: 0,
        rotation: 0,
        placedBy: 'p2',
        turnNumber: 1,
        stepIndex: 0,
      },
    ];

    const result = calculateAllFivesTurnScore(board);
    expect(result.openEndsSum).toBe(8);
    expect(result.points).toBe(0);
  });

  it('calculates Classic round score from opponents remaining hands', () => {
    const hands: Record<string, DominoTile[]> = {
      winner: [],
      p2: [
        { id: 'tile-1-2', sideA: 1, sideB: 2, totalPips: 3, isDouble: false },
        { id: 'tile-6-6', sideA: 6, sideB: 6, totalPips: 12, isDouble: true },
      ],
      p3: [
        { id: 'tile-0-5', sideA: 0, sideB: 5, totalPips: 5, isDouble: false },
      ],
    };

    const score = calculateClassicRoundScore('winner', hands);
    // p2 pips = 3 + 12 = 15; p3 pips = 5 -> total 20 points
    expect(score).toBe(20);
  });

  it('adds all four ends in All Fives when tiles branch into Left, Right, Top, and Bottom', () => {
    // Board with 4 branches:
    // Center: [5|5] at (0, 0)
    // Left: [4|5] at x = -83, y = 0, rot: 0 -> exposed left = 4
    // Right: [5|6] at x = 83, y = 0, rot: 0 -> exposed right = 6
    // Top: [2|5] at x = 0, y = -83, rot: 90 -> exposed top = 2
    // Bottom: [5|3] at x = 0, y = 83, rot: 90 -> exposed bottom = 3
    // Total open ends = 4 + 6 + 2 + 3 = 15 -> awards 15 points!
    const board: PlacedTile[] = [
      { id: 't-center', sideA: 5, sideB: 5, isDouble: true, x: 0, y: 0, rotation: 90, placedBy: 'p1', turnNumber: 1, stepIndex: 0 },
      { id: 't-left', sideA: 4, sideB: 5, isDouble: false, x: -83, y: 0, rotation: 0, placedBy: 'p1', turnNumber: 1, stepIndex: 1 },
      { id: 't-right', sideA: 5, sideB: 6, isDouble: false, x: 83, y: 0, rotation: 0, placedBy: 'p2', turnNumber: 2, stepIndex: 0 },
      { id: 't-top', sideA: 2, sideB: 5, isDouble: false, x: 0, y: -83, rotation: 90, placedBy: 'p1', turnNumber: 3, stepIndex: 0 },
      { id: 't-bottom', sideA: 5, sideB: 3, isDouble: false, x: 0, y: 83, rotation: 90, placedBy: 'p2', turnNumber: 4, stepIndex: 0 },
    ];

    const result = calculateAllFivesTurnScore(board);
    expect(result.openEnds.length).toBe(4);
    expect(result.openEndsSum).toBe(15);
    expect(result.points).toBe(15);
  });

  it('correctly calculates open ends for snake turn layout with spinner [0|0], left [4:2], right [6:6] summing to 16', () => {
    // Board matching user screenshot:
    // Center Spinner: [0|0] at (0, 0), vertical
    // Left branch: [2|0] at (-63, 0), [4|2] turned down at (-83, 63)
    // Right branch: [0|1] at (63, 0), [1|6] turned down at (83, 63), [6|6] crosswise at (83, 126)
    // Expected ends:
    // - Spinner Top: 0
    // - Spinner Bottom: 0
    // - Left branch leaf [4|2]: 4
    // - Right branch leaf [6|6]: 12 (6 + 6)
    // Total sum = 0 + 0 + 4 + 12 = 16!
    const board: PlacedTile[] = [
      { id: 't-0-0', sideA: 0, sideB: 0, isDouble: true, x: 0, y: 0, rotation: 90, placedBy: 'p1', turnNumber: 1, stepIndex: 0 },
      { id: 't-2-0', sideA: 2, sideB: 0, isDouble: false, x: -63, y: 0, rotation: 0, placedBy: 'p2', turnNumber: 2, stepIndex: 0, attachedToId: 't-0-0' },
      { id: 't-0-1', sideA: 0, sideB: 1, isDouble: false, x: 63, y: 0, rotation: 0, placedBy: 'p1', turnNumber: 3, stepIndex: 0, attachedToId: 't-0-0' },
      { id: 't-4-2', sideA: 2, sideB: 4, isDouble: false, x: -83, y: 63, rotation: 90, placedBy: 'p2', turnNumber: 4, stepIndex: 0, attachedToId: 't-2-0' },
      { id: 't-1-6', sideA: 1, sideB: 6, isDouble: false, x: 83, y: 63, rotation: 90, placedBy: 'p1', turnNumber: 5, stepIndex: 0, attachedToId: 't-0-1' },
      { id: 't-6-6', sideA: 6, sideB: 6, isDouble: true, x: 83, y: 126, rotation: 0, placedBy: 'p2', turnNumber: 6, stepIndex: 0, attachedToId: 't-1-6' },
    ];

    const result = calculateOpenEnds(board);
    expect(result.openEnds.length).toBe(4);

    // Verify individual open end values
    const pipValues = result.openEnds.map((e) => e.pipValue).sort((a, b) => a - b);
    expect(pipValues).toEqual([0, 0, 4, 12]);

    // Verify total sum is strictly 16
    expect(result.sum).toBe(16);

    // Verify intermediate tiles like t-1-6 and t-2-0 have NO badges
    const openEndTileIds = result.openEnds.map((e) => e.tileId);
    expect(openEndTileIds).not.toContain('t-1-6');
    expect(openEndTileIds).not.toContain('t-2-0');
    expect(openEndTileIds).not.toContain('t-0-1');
  });

  it('correctly identifies open ends for spinner [0|0] with bottom branch ending in [5|5] and right branch ending in [6|6]', () => {
    // Board matching media_1788633932255.jpg:
    // Center: [0|0] (spinner) at (0, 0)
    // Left branch going down to [5|5]
    // Right branch going up/right to [6|6]
    // Open ends are strictly:
    // 1) Spinner top port (0)
    // 2) Spinner bottom port (0)
    // 3) End of right snake: [6|6]
    // 4) End of bottom snake: [5|5]
    const board: PlacedTile[] = [
      { id: 't-0-0', sideA: 0, sideB: 0, isDouble: true, x: 0, y: 0, rotation: 90, placedBy: 'p1', turnNumber: 1, stepIndex: 0 },
      { id: 't-0-1', sideA: 1, sideB: 0, isDouble: false, x: -63, y: 0, rotation: 0, placedBy: 'p2', turnNumber: 2, stepIndex: 0, attachedToId: 't-0-0' },
      { id: 't-1-5', sideA: 1, sideB: 5, isDouble: false, x: -83, y: 63, rotation: 90, placedBy: 'p1', turnNumber: 3, stepIndex: 0, attachedToId: 't-0-1' },
      { id: 't-5-5', sideA: 5, sideB: 5, isDouble: true, x: -83, y: 126, rotation: 0, placedBy: 'p2', turnNumber: 4, stepIndex: 0, attachedToId: 't-1-5' },
      { id: 't-0-3', sideA: 0, sideB: 3, isDouble: false, x: 63, y: 0, rotation: 0, placedBy: 'p1', turnNumber: 5, stepIndex: 0, attachedToId: 't-0-0' },
      { id: 't-3-6', sideA: 3, sideB: 6, isDouble: false, x: 126, y: 0, rotation: 0, placedBy: 'p2', turnNumber: 6, stepIndex: 0, attachedToId: 't-0-3' },
    ];

    const result = calculateOpenEnds(board);
    expect(result.openEnds.length).toBe(4);

    const endTileIds = result.openEnds.map((e) => e.tileId);
    // Two open ends at the spinner [0|0] (top and bottom ports)
    expect(endTileIds.filter((id) => id === 't-0-0').length).toBe(2);
    // One open end at double 5 [5|5]
    expect(endTileIds).toContain('t-5-5');
    // One open end at [3|6]
    expect(endTileIds).toContain('t-3-6');

    // Intermediate tiles MUST NOT have open ends
    expect(endTileIds).not.toContain('t-0-1');
    expect(endTileIds).not.toContain('t-1-5');
    expect(endTileIds).not.toContain('t-0-3');
  });

  it('evaluates blocked round and identifies winner with lowest pip count', () => {
    const hands: Record<string, DominoTile[]> = {
      p1: [{ id: 'tile-1-1', sideA: 1, sideB: 1, totalPips: 2, isDouble: true }], // 2 pips (winner)
      p2: [{ id: 'tile-2-3', sideA: 2, sideB: 3, totalPips: 5, isDouble: false }], // 5 pips
      p3: [{ id: 'tile-4-4', sideA: 4, sideB: 4, totalPips: 8, isDouble: true }], // 8 pips
    };

    const result = evaluateBlockedRound(['p1', 'p2', 'p3'], hands);
    expect(result.winnerId).toBe('p1');
    expect(result.isTie).toBe(false);
    expect(result.lowestTotal).toBe(2);
  });
});
