import { describe, it, expect } from 'vitest';
import { sanitizeStateForPlayer } from '../src/sockets/sanitize.js';
import { GameState, DominoTile } from '../../shared/types.js';

describe('Multiplayer Security & Hand Masking', () => {
  const privateHands: Record<string, DominoTile[]> = {
    'player-A': [
      { id: 'tile-6-6', sideA: 6, sideB: 6, totalPips: 12, isDouble: true },
      { id: 'tile-5-5', sideA: 5, sideB: 5, totalPips: 10, isDouble: true },
    ],
    'player-B': [
      { id: 'tile-1-2', sideA: 1, sideB: 2, totalPips: 3, isDouble: false },
      { id: 'tile-3-4', sideA: 3, sideB: 4, totalPips: 7, isDouble: false },
    ],
  };

  const baseGameState: GameState = {
    roomId: 'SEC-101',
    phase: 'playing',
    roundNumber: 1,
    currentTurnPlayerId: 'player-A',
    board: [],
    boneyardCount: 14,
    protectedBoneyardCount: 2,
    consecutivePasses: 0,
    pendingPlacements: [],
    settings: {
      dominoSet: 'double-6',
      gameType: 'all-fives',
      maxPlayers: 2,
      tilesPerPlayer: 2,
      tilesPerTurn: 1,
      allowDrawing: true,
      startingTileRule: 'highest-double',
      specificStartingTile: 'tile-0-0',
      protectedTiles: [],
      protectedBoneyardTiles: 2,
      allowFreePlacement: true,
      allowMultipleTilesPerTurn: false,
      targetScore: 100,
      endGameCondition: 'target-score',
      maxRounds: 5,
    },
    players: [
      {
        id: 'player-A',
        nickname: 'Alice',
        isHost: true,
        isReady: true,
        score: 0,
        seatIndex: 0,
        connected: true,
        tileCount: 2,
      },
      {
        id: 'player-B',
        nickname: 'Bob',
        isHost: false,
        isReady: true,
        score: 0,
        seatIndex: 1,
        connected: true,
        tileCount: 2,
      },
    ],
  };

  it('delivers hand only to recipient player and masks opponents hand', () => {
    // Sanitize state for Player A
    const sanitizedForA = sanitizeStateForPlayer(baseGameState, 'player-A', privateHands);

    const playerA = sanitizedForA.players.find((p) => p.id === 'player-A')!;
    const playerB = sanitizedForA.players.find((p) => p.id === 'player-B')!;

    // Player A receives their own tiles
    expect(playerA.hand).toBeDefined();
    expect(playerA.hand?.length).toBe(2);
    expect(playerA.hand?.[0].id).toBe('tile-6-6');

    // Player A must NOT see Player B's tiles
    expect(playerB.hand).toBeUndefined();
    // But sees the tile count
    expect(playerB.tileCount).toBe(2);

    // Sanitize state for Player B
    const sanitizedForB = sanitizeStateForPlayer(baseGameState, 'player-B', privateHands);
    const bForPlayerA = sanitizedForB.players.find((p) => p.id === 'player-A')!;
    const bForPlayerB = sanitizedForB.players.find((p) => p.id === 'player-B')!;

    // Player B does not see A's tiles
    expect(bForPlayerA.hand).toBeUndefined();
    expect(bForPlayerA.tileCount).toBe(2);

    // Player B sees their own tiles
    expect(bForPlayerB.hand).toBeDefined();
    expect(bForPlayerB.hand?.[0].id).toBe('tile-1-2');
  });

  it('never leaks revealed hands until round or game is finished', () => {
    const playingState = {
      ...baseGameState,
      phase: 'playing' as const,
      revealedHands: privateHands,
    };

    const sanitizedPlaying = sanitizeStateForPlayer(playingState, 'player-A', privateHands);
    expect(sanitizedPlaying.revealedHands).toBeUndefined();

    const finishedState = {
      ...baseGameState,
      phase: 'round_finished' as const,
      revealedHands: privateHands,
    };

    const sanitizedFinished = sanitizeStateForPlayer(finishedState, 'player-A', privateHands);
    expect(sanitizedFinished.revealedHands).toBeDefined();
    expect(sanitizedFinished.revealedHands?.['player-B']).toBeDefined();
  });
});
