import {
  GameState,
  GameSettings,
  PlayerState,
  DominoTile,
  PlacedTile,
  PlacementSide,
} from '../shared/types.js';
import { generateDominoSet } from './domino-set.js';
import { dealTiles, drawFromBoneyard } from './boneyard.js';
import { placeTileOnBoard } from './board.js';
import {
  calculateAllFivesTurnScore,
  calculateClassicRoundScore,
  evaluateBlockedRound,
  calculateOpenEnds,
} from './scoring.js';

export interface LastConfirmedMove {
  playerId: string;
  tiles: PlacedTile[];
  pointsScored: number;
  previousRoundOver: boolean;
  roundBonus: number;
}

export interface EngineSession {
  state: GameState;
  privateHands: Record<string, DominoTile[]>;
  boneyard: DominoTile[];
  lastConfirmedMove?: LastConfirmedMove | null;
}

/**
 * Finds which player holds the highest double (or highest pip tile) to determine starting player.
 */
export function determineStartingPlayer(
  playerIds: string[],
  hands: Record<string, DominoTile[]>,
  rule: string,
  specificTileId?: string
): { startingPlayerId: string; startingTile?: DominoTile } {
  // 1. Specific tile (e.g. tile-0-0)
  if (rule === 'specific-tile' && specificTileId) {
    for (const pid of playerIds) {
      const found = (hands[pid] || []).find((t) => t.id === specificTileId);
      if (found) return { startingPlayerId: pid, startingTile: found };
    }
  }

  // 2. Highest double
  let highestDoubleVal = -1;
  let highestDoublePid = playerIds[0];
  let highestDoubleTile: DominoTile | undefined;

  for (const pid of playerIds) {
    for (const tile of hands[pid] || []) {
      if (tile.isDouble && tile.sideA > highestDoubleVal) {
        highestDoubleVal = tile.sideA;
        highestDoublePid = pid;
        highestDoubleTile = tile;
      }
    }
  }

  if (highestDoubleTile) {
    return { startingPlayerId: highestDoublePid, startingTile: highestDoubleTile };
  }

  // 3. Highest tile total pips fallback
  let highestPips = -1;
  let highestPipPid = playerIds[0];
  let highestPipTile: DominoTile | undefined;

  for (const pid of playerIds) {
    for (const tile of hands[pid] || []) {
      if (tile.totalPips > highestPips) {
        highestPips = tile.totalPips;
        highestPipPid = pid;
        highestPipTile = tile;
      }
    }
  }

  return { startingPlayerId: highestPipPid, startingTile: highestPipTile };
}

/**
 * Initializes a new round for the room.
 */
export function startNewRound(
  roomId: string,
  settings: GameSettings,
  players: PlayerState[],
  currentRoundNumber: number = 1,
  previousWinnerId?: string
): EngineSession {
  const fullSet = generateDominoSet(settings.dominoSet);
  const playerIds = players.map((p) => p.id);

  // Prepare deal
  const deal = dealTiles(fullSet, playerIds, settings.tilesPerPlayer, {
    protectedTileIds: settings.protectedTiles,
    startingTileId: settings.startingTileRule === 'specific-tile' ? settings.specificStartingTile : undefined,
    startingPlayerId: previousWinnerId,
  });

  // Determine starting player
  let startingPlayerId = playerIds[0];
  let startingTile: DominoTile | undefined;

  if (settings.startingTileRule === 'previous-winner' && previousWinnerId && playerIds.includes(previousWinnerId)) {
    startingPlayerId = previousWinnerId;
  } else if (settings.startingTileRule === 'random') {
    startingPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
  } else {
    const starter = determineStartingPlayer(
      playerIds,
      deal.playerHands,
      settings.startingTileRule,
      settings.specificStartingTile
    );
    startingPlayerId = starter.startingPlayerId;
    startingTile = starter.startingTile;
  }

  const updatedPlayers: PlayerState[] = players.map((p) => ({
    ...p,
    tileCount: (deal.playerHands[p.id] || []).length,
    isReady: true,
  }));

  const state: GameState = {
    roomId,
    phase: 'playing',
    roundNumber: currentRoundNumber,
    currentTurnPlayerId: startingPlayerId,
    turnStartTime: Date.now(),
    board: [],
    boneyardCount: deal.boneyard.length,
    protectedBoneyardCount: settings.protectedBoneyardTiles,
    consecutivePasses: 0,
    pendingPlacements: [],
    roundWinnerId: null,
    roundPointsWon: 0,
    gameWinnerId: null,
    settings,
    players: updatedPlayers,
    openEnds: [],
    currentOpenEndsSum: 0,
  };

  return {
    state,
    privateHands: deal.playerHands,
    boneyard: deal.boneyard,
  };
}

/**
 * Stages a tile placement during the active player's turn (pending confirmation).
 */
export function stageTilePlacement(
  session: EngineSession,
  playerId: string,
  tileId: string,
  options: {
    placementSide?: PlacementSide;
    x?: number;
    y?: number;
    rotation?: number;
    attachedToId?: string;
  } = {}
): { success: boolean; error?: string } {
  const { state, privateHands } = session;

  if (state.phase !== 'playing') {
    return { success: false, error: 'Game is not in active playing phase' };
  }

  if (state.currentTurnPlayerId !== playerId) {
    return { success: false, error: "Not your turn" };
  }

  const hand = privateHands[playerId] || [];
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) {
    return { success: false, error: 'Tile is not in your hand' };
  }

  // Check if tile is already staged in pendingPlacements -> update its rotation or position!
  const existingIndex = state.pendingPlacements.findIndex((p) => p.id === tileId);
  if (existingIndex !== -1) {
    const current = state.pendingPlacements[existingIndex];
    const newRot = options.rotation !== undefined ? options.rotation : current.rotation;
    const side = options.placementSide !== undefined ? options.placementSide : current.placementSide;

    current.rotation = newRot;
    current.placementSide = side;

    if (side !== 'free' && state.board.length > 0) {
      // Re-calculate non-overlapping snapped coordinates based on new orientation
      const recalculated = placeTileOnBoard(state.board, tile, playerId, 0, 0, {
        placementSide: side,
        rotation: newRot,
      });
      current.x = recalculated.placedTile.x;
      current.y = recalculated.placedTile.y;
    } else if (options.x !== undefined && options.y !== undefined) {
      current.x = options.x;
      current.y = options.y;
    }

    const endsInfo = calculateOpenEnds([...state.board, ...state.pendingPlacements]);
    state.openEnds = endsInfo.openEnds;
    state.currentOpenEndsSum = endsInfo.sum;
    return { success: true };
  }

  // Check if multiple placements are permitted
  if (state.pendingPlacements.length >= 1 && !state.settings.allowMultipleTilesPerTurn) {
    return { success: false, error: 'Only one tile per turn allowed by current room settings' };
  }

  const combinedBoard = [...state.board, ...state.pendingPlacements];
  const { placedTile } = placeTileOnBoard(
    combinedBoard,
    tile,
    playerId,
    state.roundNumber,
    state.pendingPlacements.length,
    options
  );

  state.pendingPlacements.push(placedTile);

  // Update open ends preview
  const endsInfo = calculateOpenEnds([...state.board, ...state.pendingPlacements]);
  state.openEnds = endsInfo.openEnds;
  state.currentOpenEndsSum = endsInfo.sum;

  return { success: true };
}

/**
 * Undoes all staged pending placements for the current turn.
 */
export function undoStagedTurn(session: EngineSession, playerId: string): { success: boolean; error?: string } {
  const { state } = session;

  if (state.currentTurnPlayerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }

  state.pendingPlacements = [];
  const endsInfo = calculateOpenEnds(state.board);
  state.openEnds = endsInfo.openEnds;
  state.currentOpenEndsSum = endsInfo.sum;

  return { success: true };
}

/**
 * Confirms the turn: commits pending placements, removes tiles from hand,
 * calculates scores, checks round/game end, and advances turn.
 */
export function confirmTurnAction(
  session: EngineSession,
  playerId: string
): {
  success: boolean;
  pointsScored: number;
  isRoundOver: boolean;
  isGameOver: boolean;
  error?: string;
} {
  const { state, privateHands } = session;

  if (state.currentTurnPlayerId !== playerId) {
    return { success: false, pointsScored: 0, isRoundOver: false, isGameOver: false, error: 'Not your turn' };
  }

  if (state.pendingPlacements.length === 0) {
    return {
      success: false,
      pointsScored: 0,
      isRoundOver: false,
      isGameOver: false,
      error: 'No dominoes placed yet. Place at least one tile or draw/pass.',
    };
  }

  // 1. Commit pending placements to board
  const placedTilesCopy = [...state.pendingPlacements];
  const placedTileIds = new Set(placedTilesCopy.map((p) => p.id));
  state.board.push(...placedTilesCopy);
  state.pendingPlacements = [];

  // 2. Remove placed tiles from player's hand
  privateHands[playerId] = (privateHands[playerId] || []).filter((t) => !placedTileIds.has(t.id));

  // Update player tileCount
  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.tileCount = privateHands[playerId].length;
  }

  // 3. Reset consecutive passes on valid play
  state.consecutivePasses = 0;

  // 4. Calculate Scoring
  let pointsScored = 0;
  if (state.settings.gameType === 'all-fives') {
    const turnResult = calculateAllFivesTurnScore(state.board);
    pointsScored = turnResult.points;
    state.openEnds = turnResult.openEnds;
    state.currentOpenEndsSum = turnResult.openEndsSum;

    if (pointsScored > 0 && player) {
      player.score += pointsScored;
    }
  } else {
    const endsInfo = calculateOpenEnds(state.board);
    state.openEnds = endsInfo.openEnds;
    state.currentOpenEndsSum = endsInfo.sum;
  }

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'play',
    pointsAwarded: pointsScored,
    description: `${player?.nickname || 'Player'} played ${placedTileIds.size} tile(s)${
      pointsScored > 0 ? ` scoring ${pointsScored} pts!` : ''
    }`,
    timestamp: Date.now(),
  };

  // 5. Check if round won ("Domino!")
  const remainingInHand = privateHands[playerId]?.length || 0;
  let isRoundOver = false;
  let isGameOver = false;

  if (remainingInHand === 0) {
    // Player emptied hand
    isRoundOver = true;
    state.roundWinnerId = playerId;

    let roundBonus = 0;
    if (state.settings.gameType === 'classic') {
      roundBonus = calculateClassicRoundScore(playerId, privateHands);
      if (player) {
        player.score += roundBonus;
      }
    } else {
      // In All Fives, emptying hand gives remaining opponents' pips rounded to nearest 5
      const rawOpponentPips = calculateClassicRoundScore(playerId, privateHands);
      roundBonus = Math.round(rawOpponentPips / 5) * 5;
      if (player) {
        player.score += roundBonus;
      }
    }
    state.roundPointsWon = roundBonus;
    state.phase = 'round_finished';
    state.revealedHands = { ...privateHands };

    // Check game over
    isGameOver = checkGameOver(state);
    return { success: true, pointsScored, isRoundOver, isGameOver };
  }

  // 6. Check game over based on target score during All Fives
  if (player && state.settings.endGameCondition === 'target-score' && player.score >= state.settings.targetScore) {
    isRoundOver = true;
    isGameOver = true;
    state.phase = 'game_finished';
    state.gameWinnerId = playerId;
    state.revealedHands = { ...privateHands };
    return { success: true, pointsScored, isRoundOver, isGameOver };
  }

  // 7. Advance turn to next player
  advanceTurn(state);

  // Record last confirmed move so player can change it if no one has played after them
  session.lastConfirmedMove = {
    playerId,
    tiles: placedTilesCopy,
    pointsScored,
    previousRoundOver: false,
    roundBonus: 0,
  };
  state.canChangeLastMove = true;
  state.lastMovePlayerId = playerId;

  return { success: true, pointsScored, isRoundOver: false, isGameOver: false };
}

/**
 * Draws a tile from the boneyard into the active player's hand.
 */
export function drawTileAction(
  session: EngineSession,
  playerId: string
): { success: boolean; drawnTile?: DominoTile; error?: string } {
  const { state, privateHands, boneyard } = session;

  if (state.currentTurnPlayerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }

  if (!state.settings.allowDrawing) {
    return { success: false, error: 'Drawing from boneyard is disabled in this room' };
  }

  if (state.pendingPlacements.length > 0) {
    return { success: false, error: 'You have staged tiles. Undo them first before drawing' };
  }

  const drawResult = drawFromBoneyard(boneyard, state.settings.protectedBoneyardTiles);
  if (!drawResult.tile) {
    return { success: false, error: drawResult.error || 'Boneyard empty' };
  }

  // Update boneyard
  session.boneyard = drawResult.remainingBoneyard;
  state.boneyardCount = session.boneyard.length;

  // Add tile to private hand
  const hand = privateHands[playerId] || [];
  hand.push(drawResult.tile);
  privateHands[playerId] = hand;

  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.tileCount = hand.length;
  }

  // Clear last confirmed move because an action has been taken
  session.lastConfirmedMove = null;
  state.canChangeLastMove = false;
  state.lastMovePlayerId = null;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'draw',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} drew a tile`,
    timestamp: Date.now(),
  };

  return { success: true, drawnTile: drawResult.tile };
}

/**
 * Passes turn when player cannot or chooses to pass.
 * Checks for blocked game condition.
 */
export function passTurnAction(
  session: EngineSession,
  playerId: string
): { success: boolean; isRoundOver: boolean; isGameOver: boolean; error?: string } {
  const { state, privateHands } = session;

  if (state.currentTurnPlayerId !== playerId) {
    return { success: false, isRoundOver: false, isGameOver: false, error: 'Not your turn' };
  }

  if (state.pendingPlacements.length > 0) {
    return { success: false, isRoundOver: false, isGameOver: false, error: 'Undo staged placements before passing' };
  }

  state.consecutivePasses += 1;
  const player = state.players.find((p) => p.id === playerId);

  // Clear last confirmed move because an action has been taken
  session.lastConfirmedMove = null;
  state.canChangeLastMove = false;
  state.lastMovePlayerId = null;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'pass',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} passed`,
    timestamp: Date.now(),
  };

  // Blocked game condition: every active player passed consecutively
  if (state.consecutivePasses >= state.players.length) {
    const blockedEval = evaluateBlockedRound(
      state.players.map((p) => p.id),
      privateHands
    );

    state.phase = 'round_finished';
    state.roundWinnerId = blockedEval.winnerId;
    state.revealedHands = { ...privateHands };

    let roundBonus = 0;
    if (blockedEval.winnerId) {
      const winner = state.players.find((p) => p.id === blockedEval.winnerId);
      const oppPips = calculateClassicRoundScore(blockedEval.winnerId, privateHands);
      roundBonus = state.settings.gameType === 'all-fives' ? Math.round(oppPips / 5) * 5 : oppPips;
      if (winner) {
        winner.score += roundBonus;
      }
    }
    state.roundPointsWon = roundBonus;

    const isGameOver = checkGameOver(state);
    return { success: true, isRoundOver: true, isGameOver };
  }

  advanceTurn(state);
  return { success: true, isRoundOver: false, isGameOver: false };
}

function advanceTurn(state: GameState) {
  const currentIndex = state.players.findIndex((p) => p.id === state.currentTurnPlayerId);
  const nextIndex = (currentIndex + 1) % state.players.length;
  state.currentTurnPlayerId = state.players[nextIndex].id;
  state.turnStartTime = Date.now();
}

function checkGameOver(state: GameState): boolean {
  if (state.settings.endGameCondition === 'rounds-limit') {
    if (state.roundNumber >= state.settings.maxRounds) {
      state.phase = 'game_finished';
      const sorted = [...state.players].sort((a, b) => b.score - a.score);
      state.gameWinnerId = sorted[0]?.id || null;
      return true;
    }
  } else {
    const winner = state.players.find((p) => p.score >= state.settings.targetScore);
    if (winner) {
      state.phase = 'game_finished';
      state.gameWinnerId = winner.id;
      return true;
    }
  }
  return false;
}

/**
 * Allows the player who made the last confirmed move to revert and change it,
 * provided that no other player has taken an action (drawn, passed, or played) after them.
 */
export function changeLastMoveAction(
  session: EngineSession,
  playerId: string
): { success: boolean; error?: string } {
  const { state, privateHands } = session;

  if (state.phase !== 'playing') {
    return { success: false, error: 'Cannot change move: round is not in active playing state' };
  }

  if (!session.lastConfirmedMove || session.lastConfirmedMove.playerId !== playerId) {
    return {
      success: false,
      error: 'Cannot change move: another player has already played after you, or no confirmed move exists.',
    };
  }

  const { tiles, pointsScored } = session.lastConfirmedMove;
  const tileIds = new Set(tiles.map((t) => t.id));

  // 1. Remove tiles from confirmed board
  state.board = state.board.filter((t) => !tileIds.has(t.id));

  // 2. Add tiles back to player's private hand
  const playerHand = privateHands[playerId] || [];
  for (const t of tiles) {
    playerHand.push({
      id: t.id,
      sideA: t.sideA,
      sideB: t.sideB,
      totalPips: t.sideA + t.sideB,
      isDouble: t.isDouble,
    });
  }
  privateHands[playerId] = playerHand;

  // Update player tileCount & revert points
  const player = state.players.find((p) => p.id === playerId);
  if (player) {
    player.tileCount = playerHand.length;
    if (pointsScored > 0) {
      player.score = Math.max(0, player.score - pointsScored);
    }
  }

  // 3. Put the tiles back into pendingPlacements so they remain on table ready for rotation or repositioning!
  state.pendingPlacements = [...tiles];

  // 4. Return turn to this player
  state.currentTurnPlayerId = playerId;
  state.turnStartTime = Date.now();

  // 5. Clear lastConfirmedMove
  session.lastConfirmedMove = null;
  state.canChangeLastMove = false;
  state.lastMovePlayerId = null;

  // 6. Recalculate open ends
  const endsInfo = calculateOpenEnds([...state.board, ...state.pendingPlacements]);
  state.openEnds = endsInfo.openEnds;
  state.currentOpenEndsSum = endsInfo.sum;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'play',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} is modifying their move`,
    timestamp: Date.now(),
  };

  return { success: true };
}
