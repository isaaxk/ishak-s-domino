import { describe, it, expect } from 'vitest';
import {
  startNewRound,
  stageTilePlacement,
  undoStagedTurn,
  confirmTurnAction,
  changeLastMoveAction,
  passTurnAction,
  drawTileAction,
  selectStartingPlayerAction,
} from '../src/engine/game-engine.js';
import { DEFAULT_SETTINGS, PlayerState } from '../../shared/types.js';

describe('Game Engine State Machine & Physical Freedom', () => {
  const createTestPlayers = (): PlayerState[] => [
    {
      id: 'player-1',
      nickname: 'Alice',
      isHost: true,
      isReady: true,
      score: 0,
      seatIndex: 0,
      connected: true,
      tileCount: 0,
    },
    {
      id: 'player-2',
      nickname: 'Bob',
      isHost: false,
      isReady: true,
      score: 0,
      seatIndex: 1,
      connected: true,
      tileCount: 0,
    },
  ];

  it('starts a new round in selecting_starter phase when rule is host-selects, deals tiles, and allows manager to choose who starts', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', { ...DEFAULT_SETTINGS, startingTileRule: 'host-selects' }, players, 1);

    expect(session.state.phase).toBe('selecting_starter');
    expect(session.state.currentTurnPlayerId).toBeNull();
    expect(session.state.roundNumber).toBe(1);
    expect(session.state.players[0].tileCount).toBe(7);
    expect(session.state.players[1].tileCount).toBe(7);
    expect(session.boneyard.length).toBe(28 - 14);

    // Non-manager cannot choose starter
    const invalidSelect = selectStartingPlayerAction(session, 'player-2', 'player-2');
    expect(invalidSelect.success).toBe(false);
    expect(invalidSelect.error).toContain('Only the room manager can choose');

    // Manager selects player-1 to start
    const select = selectStartingPlayerAction(session, 'player-1', 'player-1');
    expect(select.success).toBe(true);
    expect(session.state.phase).toBe('playing');
    expect(session.state.currentTurnPlayerId).toBe('player-1');
  });

  it('lets the creator choose the player who will start and put the first domino after the game starts when rule is host-selects', () => {
    const players = createTestPlayers();

    // Round 1 starts: in selecting_starter phase, manager selects Bob (player-2)
    const session1 = startNewRound('ROOM-1', { ...DEFAULT_SETTINGS, startingTileRule: 'host-selects' }, players, 1);
    expect(session1.state.phase).toBe('selecting_starter');
    const selectBob = selectStartingPlayerAction(session1, 'player-1', 'player-2');
    expect(selectBob.success).toBe(true);
    expect(session1.state.phase).toBe('playing');
    expect(session1.state.currentTurnPlayerId).toBe('player-2');

    // Round 2 starts: in selecting_starter phase, manager selects Alice (player-1)
    const session2 = startNewRound('ROOM-1', { ...DEFAULT_SETTINGS, startingTileRule: 'host-selects' }, players, 2);
    expect(session2.state.phase).toBe('selecting_starter');
    const selectAlice = selectStartingPlayerAction(session2, 'player-1', 'player-1');
    expect(selectAlice.success).toBe(true);
    expect(session2.state.phase).toBe('playing');
    expect(session2.state.currentTurnPlayerId).toBe('player-1');
  });

  it('starts directly in playing phase with free-starter (real life): all players see hands, any player can place the first domino, turn advances clockwise', () => {
    const players = createTestPlayers();
    // DEFAULT_SETTINGS uses startingTileRule: 'free-starter'
    const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1);

    expect(session.state.phase).toBe('playing');
    expect(session.state.currentTurnPlayerId).toBeNull();
    expect(session.state.board.length).toBe(0);
    expect(session.state.players[0].tileCount).toBe(7);
    expect(session.state.players[1].tileCount).toBe(7);

    // Player 2 (Bob) decides to start the round with a tile from his hand
    const bobHand = session.privateHands['player-2'];
    const bobTile = bobHand[0];
    const stageBob = stageTilePlacement(session, 'player-2', bobTile.id);
    expect(stageBob.success).toBe(true);
    expect(session.state.pendingPlacements.length).toBe(1);

    // Player 1 cannot confirm Bob's staged tile
    const aliceConfirmBob = confirmTurnAction(session, 'player-1');
    expect(aliceConfirmBob.success).toBe(false);

    // Bob confirms opening the round!
    const confirmBob = confirmTurnAction(session, 'player-2');
    expect(confirmBob.success).toBe(true);
    expect(session.state.board.length).toBe(1);
    expect(session.state.board[0].id).toBe(bobTile.id);

    // Turn immediately advances to the next player clockwise (Alice, player-1)
    expect(session.state.currentTurnPlayerId).toBe('player-1');

    // Bob can change his move before Alice plays
    expect(session.state.canChangeLastMove).toBe(true);
    expect(session.state.lastMovePlayerId).toBe('player-2');
  });

  it('allows free physical placement (e.g. [6|2] [5|5] [1|4] without rejection)', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', { ...DEFAULT_SETTINGS, allowFreePlacement: true }, players, 1, undefined, 'player-1');
    const activePlayerId = session.state.currentTurnPlayerId!;

    // Set custom hand for testing free placement
    session.privateHands[activePlayerId] = [
      { id: 'tile-2-6', sideA: 6, sideB: 2, totalPips: 8, isDouble: false },
      { id: 'tile-5-5', sideA: 5, sideB: 5, totalPips: 10, isDouble: true },
      { id: 'tile-1-4', sideA: 1, sideB: 4, totalPips: 5, isDouble: false },
    ];

    // 1. Place first tile [6|2]
    const stage1 = stageTilePlacement(session, activePlayerId, 'tile-2-6');
    expect(stage1.success).toBe(true);
    expect(session.state.pendingPlacements.length).toBe(1);

    const confirm1 = confirmTurnAction(session, activePlayerId);
    expect(confirm1.success).toBe(true);
    expect(session.state.board.length).toBe(1);

    // 2. Next player turn: place non-matching [5|5] adjacent to right
    const nextPlayerId = session.state.currentTurnPlayerId!;
    session.privateHands[nextPlayerId] = [
      { id: 'tile-5-5', sideA: 5, sideB: 5, totalPips: 10, isDouble: true },
      { id: 'tile-0-1', sideA: 0, sideB: 1, totalPips: 1, isDouble: false },
    ];
    const stage2 = stageTilePlacement(session, nextPlayerId, 'tile-5-5', { placementSide: 'right' });
    expect(stage2.success).toBe(true); // Must NOT reject!

    const confirm2 = confirmTurnAction(session, nextPlayerId);
    expect(confirm2.success).toBe(true);
    expect(session.state.board.length).toBe(2);

    // 3. Third placement: non-matching [1|4] adjacent to right
    const thirdPlayerId = session.state.currentTurnPlayerId!;
    session.privateHands[thirdPlayerId] = [
      { id: 'tile-1-4', sideA: 1, sideB: 4, totalPips: 5, isDouble: false },
    ];
    const stage3 = stageTilePlacement(session, thirdPlayerId, 'tile-1-4', { placementSide: 'right' });
    expect(stage3.success).toBe(true); // Must NOT reject!

    const confirm3 = confirmTurnAction(session, thirdPlayerId);
    expect(confirm3.success).toBe(true);
    expect(session.state.board.length).toBe(3);
    // Board successfully contains [6|2] [5|5] [1|4]!
    expect(session.state.board.map((t) => t.id)).toEqual(['tile-2-6', 'tile-5-5', 'tile-1-4']);
  });

  it('supports multiple tiles placement per turn when enabled', () => {
    const players = createTestPlayers();
    const session = startNewRound(
      'ROOM-1',
      { ...DEFAULT_SETTINGS, allowMultipleTilesPerTurn: true },
      players,
      1,
      undefined,
      'player-1'
    );
    const activePlayerId = session.state.currentTurnPlayerId!;

    session.privateHands[activePlayerId] = [
      { id: 'tile-1-2', sideA: 1, sideB: 2, totalPips: 3, isDouble: false },
      { id: 'tile-3-4', sideA: 3, sideB: 4, totalPips: 7, isDouble: false },
    ];

    // Stage first tile
    const stage1 = stageTilePlacement(session, activePlayerId, 'tile-1-2');
    expect(stage1.success).toBe(true);

    // Stage second tile in the same turn
    const stage2 = stageTilePlacement(session, activePlayerId, 'tile-3-4');
    expect(stage2.success).toBe(true);
    expect(session.state.pendingPlacements.length).toBe(2);

    // Confirm turn commits both tiles
    const confirm = confirmTurnAction(session, activePlayerId);
    expect(confirm.success).toBe(true);
    expect(session.state.board.length).toBe(2);
    expect(session.privateHands[activePlayerId].length).toBe(0);
  });

  it('supports undoing staged unconfirmed turn', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1, undefined, 'player-1');
    const activePlayerId = session.state.currentTurnPlayerId!;
    const tileToPlay = session.privateHands[activePlayerId][0].id;

    // Stage tile
    stageTilePlacement(session, activePlayerId, tileToPlay);
    expect(session.state.pendingPlacements.length).toBe(1);

    // Undo turn
    const undo = undoStagedTurn(session, activePlayerId);
    expect(undo.success).toBe(true);
    expect(session.state.pendingPlacements.length).toBe(0);
    // Tile was not removed from hand
    expect(session.privateHands[activePlayerId].some((t) => t.id === tileToPlay)).toBe(true);
  });

  it('ends round when a player empties their hand ("Domino!") and awards points', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', { ...DEFAULT_SETTINGS, gameType: 'classic' }, players, 1, undefined, 'player-1');
    const activePlayerId = session.state.currentTurnPlayerId!;

    // Set player to have only 1 tile left
    session.privateHands[activePlayerId] = [
      { id: 'tile-0-1', sideA: 0, sideB: 1, totalPips: 1, isDouble: false },
    ];

    stageTilePlacement(session, activePlayerId, 'tile-0-1');
    const result = confirmTurnAction(session, activePlayerId);

    expect(result.success).toBe(true);
    expect(result.isRoundOver).toBe(true);
    expect(session.state.phase).toBe('round_finished');
    expect(session.state.roundWinnerId).toBe(activePlayerId);
    expect(session.state.roundPointsWon).toBeGreaterThan(0);
  });

  it('ends round as blocked when all players pass consecutively', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1, undefined, 'player-1');

    const p1 = session.state.currentTurnPlayerId!;
    const pass1 = passTurnAction(session, p1);
    expect(pass1.success).toBe(true);
    expect(pass1.isRoundOver).toBe(false);

    const p2 = session.state.currentTurnPlayerId!;
    const pass2 = passTurnAction(session, p2);
    expect(pass2.success).toBe(true);
    expect(pass2.isRoundOver).toBe(true);
    expect(session.state.phase).toBe('round_finished');
  });

  it('allows player to change confirmed move if no one has played after them, and blocks change once someone acts', () => {
    const players = createTestPlayers();
    const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1, undefined, 'player-1');
    const p1 = session.state.currentTurnPlayerId!;
    const tile1 = session.privateHands[p1][0].id;

    // 1. P1 places and confirms move
    stageTilePlacement(session, p1, tile1);
    const confirm = confirmTurnAction(session, p1);
    expect(confirm.success).toBe(true);
    expect(session.state.board.length).toBe(1);
    expect(session.state.canChangeLastMove).toBe(true);
    expect(session.state.lastMovePlayerId).toBe(p1);

    // 2. P1 changes their move before P2 acts
    const change = changeLastMoveAction(session, p1);
    expect(change.success).toBe(true);
    // Board is reverted and tile is staged in pendingPlacements
    expect(session.state.board.length).toBe(0);
    expect(session.state.pendingPlacements.length).toBe(1);
    expect(session.state.pendingPlacements[0].id).toBe(tile1);
    // Turn is back with P1
    expect(session.state.currentTurnPlayerId).toBe(p1);

    // 3. P1 confirms again
    const confirm2 = confirmTurnAction(session, p1);
    expect(confirm2.success).toBe(true);
    expect(session.state.board.length).toBe(1);

    // 4. Next player (P2) acts (draws from boneyard)
    const p2 = session.state.currentTurnPlayerId!;
    expect(p2).not.toBe(p1);
    const draw = drawTileAction(session, p2);
    expect(draw.success).toBe(true);
    expect(session.state.canChangeLastMove).toBe(false);

    // 5. P1 now attempts to change move -> blocked!
    const blockedChange = changeLastMoveAction(session, p1);
    expect(blockedChange.success).toBe(false);
    expect(blockedChange.error).toContain('another player has already played after you');
  });

  it('follows player seating order established by the room creator', () => {
    const players = createTestPlayers();
    // Creator swaps seating: Bob (player-2) is Seat 0, Alice (player-1) is Seat 1
    players[0].seatIndex = 1;
    players[1].seatIndex = 0;
    players.sort((a, b) => a.seatIndex - b.seatIndex);

    const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1, undefined, 'player-2');
    expect(session.state.currentTurnPlayerId).toBe('player-2');

    // Bob plays tile and confirms
    const bobTile = session.privateHands['player-2'][0].id;
    stageTilePlacement(session, 'player-2', bobTile);
    confirmTurnAction(session, 'player-2');

    // Turn advances in seat order to Alice (Seat 1)
    expect(session.state.currentTurnPlayerId).toBe('player-1');
  });
});
