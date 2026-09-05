import { describe, it, expect } from 'vitest';
import {
  startNewRound,
  stageTilePlacement,
  confirmTurnAction,
  passTurnAction,
  finishGameAction,
  updatePlayerScoresAction,
  checkBoardBlocked,
  drawTileAction,
} from '../src/engine/game-engine.js';
import { DEFAULT_SETTINGS, PlayerState, DominoTile, PlacedTile, OpenEndInfo } from '../../shared/types.js';

describe('Manager Game Controls & Classic Blocked Game Flow', () => {
  const createTestPlayers = (): PlayerState[] => [
    {
      id: 'player-1',
      nickname: 'Alice',
      isHost: true,
      isReady: true,
      score: 45,
      seatIndex: 0,
      connected: true,
      tileCount: 0,
    },
    {
      id: 'player-2',
      nickname: 'Bob',
      isHost: false,
      isReady: true,
      score: 80,
      seatIndex: 1,
      connected: true,
      tileCount: 0,
    },
  ];

  describe('finishGameAction', () => {
    it('allows manager to finish the match at any time and sets winner with highest score', () => {
      const players = createTestPlayers();
      const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1);

      // Non-manager attempts to finish match -> should fail
      const nonHostRes = finishGameAction(session, 'player-2');
      expect(nonHostRes.success).toBe(false);
      expect(nonHostRes.error).toContain('Only the room manager');

      // Manager finishes match -> success
      const hostRes = finishGameAction(session, 'player-1');
      expect(hostRes.success).toBe(true);
      expect(session.state.phase).toBe('game_finished');
      expect(session.state.gameWinnerId).toBe('player-2'); // Bob had 80 pts vs Alice 45 pts
      expect(session.state.revealedHands).toBeDefined();
      expect(session.state.lastMoveSummary?.description).toContain('finished the match');
    });
  });

  describe('updatePlayerScoresAction', () => {
    it('allows manager to edit player scores and updates winner if game is finished', () => {
      const players = createTestPlayers();
      const session = startNewRound('ROOM-1', DEFAULT_SETTINGS, players, 1);

      // Non-host attempts to edit scores -> should fail
      const nonHostRes = updatePlayerScoresAction(session, 'player-2', { 'player-1': 100 });
      expect(nonHostRes.success).toBe(false);
      expect(nonHostRes.error).toContain('Only the room manager');

      // Host edits scores
      const hostRes = updatePlayerScoresAction(session, 'player-1', {
        'player-1': 120,
        'player-2': 50,
      });
      expect(hostRes.success).toBe(true);
      expect(session.state.players.find((p) => p.id === 'player-1')?.score).toBe(120);
      expect(session.state.players.find((p) => p.id === 'player-2')?.score).toBe(50);

      // If game is finished, gameWinnerId reflects updated scores
      finishGameAction(session, 'player-1');
      expect(session.state.gameWinnerId).toBe('player-1');

      // Manager modifies score again after game is finished
      updatePlayerScoresAction(session, 'player-1', { 'player-2': 150 });
      expect(session.state.gameWinnerId).toBe('player-2');
    });
  });

  describe('checkBoardBlocked & Blocked Round Flow', () => {
    it('identifies blocked board when all open ends share a number and all tiles with that number are placed', () => {
      // All open ends are 6
      const openEnds: OpenEndInfo[] = [
        { endId: 'end-1', tileId: 't1', pipValue: 6, position: { x: 0, y: 0 }, orientation: 'horizontal', side: 'left' },
        { endId: 'end-2', tileId: 't2', pipValue: 6, position: { x: 10, y: 0 }, orientation: 'horizontal', side: 'right' },
      ];

      const board: PlacedTile[] = [
        { id: 't1', sideA: 6, sideB: 6, isDouble: true, x: 0, y: 0, rotation: 0, placedBy: 'p1' },
      ];

      // Hands have only non-6 tiles
      const privateHands: Record<string, DominoTile[]> = {
        'player-1': [{ id: 't3', sideA: 1, sideB: 2, isDouble: false }],
        'player-2': [{ id: 't4', sideA: 3, sideB: 4, isDouble: false }],
      };

      // Boneyard has no 6
      const boneyard: DominoTile[] = [
        { id: 't5', sideA: 0, sideB: 1, isDouble: false },
      ];

      const result = checkBoardBlocked(board, openEnds, privateHands, boneyard, true);
      expect(result.isBlocked).toBe(true);
      expect(result.reason).toContain('All endings require 6, and all matching dominoes are on the table');
    });

    it('identifies general blocked game when neither hands nor boneyard can match any open end', () => {
      const openEnds: OpenEndInfo[] = [
        { endId: 'end-1', tileId: 't1', pipValue: 1, position: { x: 0, y: 0 }, orientation: 'horizontal', side: 'left' },
        { endId: 'end-2', tileId: 't2', pipValue: 5, position: { x: 10, y: 0 }, orientation: 'horizontal', side: 'right' },
      ];

      const board: PlacedTile[] = [
        { id: 't1', sideA: 1, sideB: 5, isDouble: false, x: 0, y: 0, rotation: 0, placedBy: 'p1' },
      ];

      // Hands have [2, 3] and [4, 4] -> neither 1 nor 5
      const privateHands: Record<string, DominoTile[]> = {
        'player-1': [{ id: 't3', sideA: 2, sideB: 3, isDouble: false }],
        'player-2': [{ id: 't4', sideA: 4, sideB: 4, isDouble: true }],
      };

      // Boneyard empty or has only [0, 0]
      const boneyard: DominoTile[] = [
        { id: 't5', sideA: 0, sideB: 0, isDouble: true },
      ];

      const result = checkBoardBlocked(board, openEnds, privateHands, boneyard, true);
      expect(result.isBlocked).toBe(true);
      expect(result.reason).toContain('No player can put a correct tile on any ending');
    });

    it('identifies blocked game in All Fives with 4 endings when no player has a matching tile', () => {
      // 4 open endings: 0, 2, 4, 5 on 4 branches
      const board: PlacedTile[] = [
        { id: 't-spinner', sideA: 6, sideB: 6, isDouble: true, x: 0, y: 0, rotation: 0, placedBy: 'p1' },
        { id: 't-leaf-0', sideA: 6, sideB: 0, isDouble: false, x: 0, y: -80, rotation: 90, placedBy: 'p1' },
        { id: 't-leaf-2', sideA: 6, sideB: 2, isDouble: false, x: 0, y: 80, rotation: 90, placedBy: 'p1' },
        { id: 't-leaf-4', sideA: 6, sideB: 4, isDouble: false, x: -80, y: 0, rotation: 0, placedBy: 'p1' },
        { id: 't-leaf-5', sideA: 6, sideB: 5, isDouble: false, x: 80, y: 0, rotation: 0, placedBy: 'p1' },
      ];

      const openEnds: OpenEndInfo[] = [
        { tileId: 't-leaf-0', side: 'B', pipValue: 0, x: 0, y: -105 },
        { tileId: 't-leaf-2', side: 'B', pipValue: 2, x: 0, y: 105 },
        { tileId: 't-leaf-4', side: 'B', pipValue: 4, x: -105, y: 0 },
        { tileId: 't-leaf-5', side: 'B', pipValue: 5, x: 105, y: 0 },
      ];

      // Players have tiles [1:3] and [3:3] -> cannot match 0, 2, 4, 5
      const privateHands: Record<string, DominoTile[]> = {
        'player-1': [{ id: 't-1-3', sideA: 1, sideB: 3, totalPips: 4, isDouble: false }],
        'player-2': [{ id: 't-3-3', sideA: 3, sideB: 3, totalPips: 6, isDouble: true }],
      };

      // Boneyard empty (0 tiles left)
      const boneyard: DominoTile[] = [];

      const result = checkBoardBlocked(board, openEnds, privateHands, boneyard, true);
      expect(result.isBlocked).toBe(true);
      expect(result.reason).toContain('Game blocked in all 4 endings!');
      expect(result.reason).toContain('No player can put a correct tile on any ending');
    });

    it('allows drawing from boneyard until 0 tiles remain in the draw pile', () => {
      const players = createTestPlayers();
      const session = startNewRound(
        'ROOM-DRAW-TEST',
        { ...DEFAULT_SETTINGS, allowDrawing: true, protectedBoneyardTiles: 0 },
        players,
        1,
        undefined,
        'player-1'
      );

      // Set boneyard to exactly 2 tiles to test drawing down through 1 to 0
      session.boneyard = [
        { id: 'b1', sideA: 0, sideB: 1, totalPips: 1, isDouble: false },
        { id: 'b2', sideA: 2, sideB: 2, totalPips: 4, isDouble: true },
      ];
      session.state.boneyardCount = 2;
      session.state.protectedBoneyardCount = 0;

      // First draw -> 1 tile left
      const draw1 = drawTileAction(session, 'player-1');
      expect(draw1.success).toBe(true);
      expect(session.state.boneyardCount).toBe(1);

      // Second draw -> 0 tiles left in draw pile
      const draw2 = drawTileAction(session, 'player-1');
      expect(draw2.success).toBe(true);
      expect(session.state.boneyardCount).toBe(0);

      // Third draw -> should fail because draw pile is at 0
      const draw3 = drawTileAction(session, 'player-1');
      expect(draw3.success).toBe(false);
      expect(draw3.error).toContain('Boneyard empty');
    });

    it('sets isBlocked and reveals hands when round is blocked via confirmTurnAction', () => {
      const players = createTestPlayers();
      const session = startNewRound(
        'ROOM-1',
        { ...DEFAULT_SETTINGS, gameType: 'classic', allowDrawing: false },
        players,
        1,
        undefined,
        'player-1'
      );
      const p1 = 'player-1';
      const p2 = 'player-2';

      // Setup a blocked scenario: P1 has [6:6] and [1:2], P2 has [3:4]
      // P1 plays [6:6]
      const tile66: DominoTile = { id: 'tile-6-6', sideA: 6, sideB: 6, totalPips: 12, isDouble: true };
      const tile12: DominoTile = { id: 'tile-1-2', sideA: 1, sideB: 2, totalPips: 3, isDouble: false };
      const tile34: DominoTile = { id: 'tile-3-4', sideA: 3, sideB: 4, totalPips: 7, isDouble: false };

      session.privateHands[p1] = [tile66, tile12];
      session.privateHands[p2] = [tile34];
      session.state.players.find((p) => p.id === p1)!.tileCount = 2;
      session.state.players.find((p) => p.id === p2)!.tileCount = 1;
      session.boneyard = [];

      stageTilePlacement(session, p1, 'tile-6-6', { x: 0, y: 0 });
      const res = confirmTurnAction(session, p1);

      expect(res.success).toBe(true);
      expect(res.isRoundOver).toBe(true);
      expect(session.state.isBlocked).toBe(true);
      expect(session.state.phase).toBe('round_finished');
      expect(session.state.blockedReason).toBeDefined();
      expect(session.state.revealedHands).toBeDefined();
      // P1 has 3 pips remaining ([1:2]), P2 has 7 pips ([3:4]) -> P1 has lowest pips!
      expect(session.state.roundWinnerId).toBe(p1);
    });

    it('marks round blocked when all players pass consecutively', () => {
      const players = createTestPlayers();
      players[0].score = 0;
      players[1].score = 0;
      const session = startNewRound(
        'ROOM-1',
        { ...DEFAULT_SETTINGS, allowDrawing: false },
        players,
        1,
        undefined,
        'player-1'
      );
      const p1 = 'player-1';
      const p2 = 'player-2';

      passTurnAction(session, p1);
      expect(session.state.isBlocked).toBe(false);

      // Second player passes -> consecutive passes equals player count -> blocked!
      passTurnAction(session, p2);
      expect(session.state.phase).toBe('round_finished');
      expect(session.state.isBlocked).toBe(true);
      expect(session.state.blockedReason).toContain('All players passed consecutively');
      expect(session.state.revealedHands).toBeDefined();
    });
  });
});

