import {
  GameState,
  GameSettings,
  PlayerState,
  DominoTile,
  PlacedTile,
  PlacementSide,
  OpenEndInfo,
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
  lastPass?: { playerId: string } | null;
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
  previousWinnerId?: string,
  designatedStartingPlayerId?: string
): EngineSession {
  const fullSet = generateDominoSet(settings.dominoSet);
  const playerIds = players.map((p) => p.id);

  // Prepare deal
  const deal = dealTiles(fullSet, playerIds, settings.tilesPerPlayer, {
    protectedTileIds: settings.protectedTiles,
    startingTileId: settings.startingTileRule === 'specific-tile' ? settings.specificStartingTile : undefined,
    startingPlayerId: designatedStartingPlayerId || previousWinnerId,
  });

  // Determine starting player:
  // In free-starter mode, any player can start once the round begins!
  let startingPlayerId: string | null = playerIds[0];
  let startingTile: DominoTile | undefined;

  if (designatedStartingPlayerId && playerIds.includes(designatedStartingPlayerId)) {
    // Creator or test explicitly selected this player to start
    startingPlayerId = designatedStartingPlayerId;
  } else if (settings.startingTileRule === 'free-starter') {
    startingPlayerId = null;
  } else if (settings.startingTileRule === 'host-selects') {
    // By default, the room creator / host starts the round
    const hostPlayer = players.find((p) => p.isHost);
    startingPlayerId = hostPlayer ? hostPlayer.id : playerIds[0];
  } else if (settings.startingTileRule === 'previous-winner' && previousWinnerId && playerIds.includes(previousWinnerId)) {
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

  const needsStarterSelection = settings.startingTileRule === 'host-selects' && !designatedStartingPlayerId;

  const state: GameState = {
    roomId,
    phase: needsStarterSelection ? 'selecting_starter' : 'playing',
    roundNumber: currentRoundNumber,
    currentTurnPlayerId: needsStarterSelection ? null : startingPlayerId,
    turnStartTime: Date.now(),
    board: [],
    boneyardCount: deal.boneyard.length,
    protectedBoneyardCount: settings.protectedBoneyardTiles ?? 0,
    consecutivePasses: 0,
    pendingPlacements: [],
    roundWinnerId: null,
    roundPointsWon: 0,
    gameWinnerId: null,
    settings,
    players: updatedPlayers,
    openEnds: [],
    currentOpenEndsSum: 0,
    canUndoPass: false,
    lastPassPlayerId: null,
    isBlocked: false,
    blockedReason: undefined,
  };

  return {
    state,
    privateHands: deal.playerHands,
    boneyard: deal.boneyard,
    lastPass: null,
  };
}

/**
 * Resolves the actual face pip value that a new domino must match to connect to this open end.
 * Accounts for crosswise doubles whose pipValue was summed as sideA + sideB for All Fives scoring.
 */
function getOpenEndConnectablePip(end: OpenEndInfo, board: PlacedTile[]): number {
  const tile = board.find((t) => t.id === end.tileId);
  if (tile && tile.isDouble) {
    return tile.sideA;
  }
  return end.pipValue;
}

/**
 * Determines whether the board has become blocked.
 * Handles both classic 2-ended boards and All Fives boards with 4 active endings.
 * Specifically checks:
 * 1. If all open ends require value V and all tiles in the set containing V are already on the board.
 * 2. If no player in the room holds a tile matching ANY open ending, AND the draw pile contains no matching tile.
 */
export function checkBoardBlocked(
  board: PlacedTile[],
  openEnds: OpenEndInfo[],
  privateHands: Record<string, DominoTile[]>,
  boneyard: DominoTile[],
  allowDrawing: boolean
): { isBlocked: boolean; reason?: string } {
  if (board.length === 0 || openEnds.length === 0) {
    return { isBlocked: false };
  }

  // Resolve the connectable domino face value for every open ending (up to 4 in All Fives)
  const connectablePips = openEnds.map((e) => getOpenEndConnectablePip(e, board));
  const openValues = new Set(connectablePips);

  // Case 1: All open ends (e.g. all 4 ends or 2 ends) end with the exact same number V,
  // and all tiles with V are already on the table (e.g. all seven 6s are placed)
  if (openValues.size === 1) {
    const singleVal = Array.from(openValues)[0];
    const existsInHands = Object.values(privateHands).some((hand) =>
      hand.some((t) => t.sideA === singleVal || t.sideB === singleVal)
    );
    const existsInBoneyard = boneyard.some(
      (t) => t.sideA === singleVal || t.sideB === singleVal
    );

    if (!existsInHands && !existsInBoneyard) {
      return {
        isBlocked: true,
        reason: `Game blocked in all ${openEnds.length} ends! All endings require ${singleVal}, and all matching dominoes are on the table.`,
      };
    }
  }

  // Case 2: General block: No playable tile in ANY player's hand for ANY of the endings,
  // and the draw pile cannot provide a playable tile (either empty with 0 tiles or contains no matching tiles)
  const playableInHand = Object.values(privateHands).some((hand) =>
    hand.some((t) => openValues.has(t.sideA) || openValues.has(t.sideB))
  );

  if (!playableInHand) {
    const playableInBoneyard =
      allowDrawing &&
      boneyard.some((t) => openValues.has(t.sideA) || openValues.has(t.sideB));

    if (!playableInBoneyard) {
      const endsStr = Array.from(openValues).sort((a, b) => a - b).join(', ');
      return {
        isBlocked: true,
        reason: `Game blocked in all ${openEnds.length} endings! No player can put a correct tile on any ending (${endsStr}), and the draw pile has no matching dominoes.`,
      };
    }
  }

  return { isBlocked: false };
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

  const isFreeStarterOpening = state.settings.startingTileRule === 'free-starter' && state.board.length === 0;

  if (!isFreeStarterOpening && state.currentTurnPlayerId !== playerId) {
    return { success: false, error: "Not your turn" };
  }

  const hand = privateHands[playerId] || [];
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) {
    return { success: false, error: 'Tile is not in your hand' };
  }

  // If opening in free-starter mode, clear any unconfirmed pending tile staged by another player
  if (isFreeStarterOpening && state.pendingPlacements.length > 0 && state.pendingPlacements[0].placedBy !== playerId) {
    state.pendingPlacements = [];
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
      const attachedToId = options.attachedToId || current.attachedToId;
      const recalculated = placeTileOnBoard(state.board, tile, playerId, 0, 0, {
        placementSide: side,
        rotation: newRot,
        attachedToId,
      });
      current.x = recalculated.placedTile.x;
      current.y = recalculated.placedTile.y;
      current.attachedToId = recalculated.placedTile.attachedToId;
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
  const isFreeStarterOpening = state.settings.startingTileRule === 'free-starter' && state.board.length === 0;

  if (!isFreeStarterOpening && state.currentTurnPlayerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }

  if (isFreeStarterOpening && state.pendingPlacements.some((p) => p.placedBy !== playerId)) {
    return { success: false, error: 'Cannot undo a tile staged by another player' };
  }

  state.pendingPlacements = [];
  if (state.board.length === 0 && state.settings.startingTileRule === 'free-starter') {
    state.currentTurnPlayerId = null;
  }
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
  const isFreeStarterOpening = state.settings.startingTileRule === 'free-starter' && state.board.length === 0;

  if (!isFreeStarterOpening && state.currentTurnPlayerId !== playerId) {
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

  if (isFreeStarterOpening && state.pendingPlacements.some((p) => p.placedBy !== playerId)) {
    return {
      success: false,
      pointsScored: 0,
      isRoundOver: false,
      isGameOver: false,
      error: 'Cannot confirm: another player has staged a tile. Stage your own tile to start.',
    };
  }

  // In free-starter opening, the player who confirmed becomes the designated starter for turn advancement
  if (isFreeStarterOpening) {
    state.currentTurnPlayerId = playerId;
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

  // 6b. Check if the board has become blocked after this placement
  const blockCheck = checkBoardBlocked(
    state.board,
    state.openEnds || [],
    privateHands,
    session.boneyard,
    state.settings.allowDrawing
  );

  if (blockCheck.isBlocked) {
    isRoundOver = true;
    state.isBlocked = true;
    state.blockedReason = blockCheck.reason;
    state.phase = 'round_finished';
    state.revealedHands = { ...privateHands };
    session.lastPass = null;
    state.canUndoPass = false;
    state.lastPassPlayerId = null;

    // Evaluate lowest hand pip total
    const blockedEval = evaluateBlockedRound(
      state.players.map((p) => p.id),
      privateHands
    );
    state.roundWinnerId = blockedEval.winnerId;

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

    isGameOver = checkGameOver(state);
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

  // Playing a tile invalidates any previous pass undo
  session.lastPass = null;
  state.canUndoPass = false;
  state.lastPassPlayerId = null;

  return { success: true, pointsScored, isRoundOver: false, isGameOver: false };
}

/**
 * Draws a tile from the boneyard into the active player's hand.
 * Cannot be undone, and invalidates any previous pass undo.
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

  const drawResult = drawFromBoneyard(boneyard, state.settings.protectedBoneyardTiles ?? 0);
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

  // Drawing CANNOT be undone, and invalidates previous confirmed move and pass undo
  session.lastConfirmedMove = null;
  state.canChangeLastMove = false;
  state.lastMovePlayerId = null;
  session.lastPass = null;
  state.canUndoPass = false;
  state.lastPassPlayerId = null;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'draw',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} took a tile from the draw`,
    timestamp: Date.now(),
  };

  return { success: true, drawnTile: drawResult.tile };
}

/**
 * Passes turn when player cannot or chooses to pass.
 * Checks for blocked game condition.
 * Allows the passing player to undo the pass as long as no one plays after him.
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

  // Record this pass so the player can undo it if no one plays after them
  session.lastPass = { playerId };
  state.canUndoPass = true;
  state.lastPassPlayerId = playerId;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'pass',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} passed`,
    timestamp: Date.now(),
  };

  // Blocked game condition: every active player passed consecutively, OR no player can move/draw
  const blockCheck = checkBoardBlocked(
    state.board,
    state.openEnds || [],
    privateHands,
    session.boneyard,
    state.settings.allowDrawing
  );

  if (state.consecutivePasses >= state.players.length || blockCheck.isBlocked) {
    const blockedEval = evaluateBlockedRound(
      state.players.map((p) => p.id),
      privateHands
    );

    state.phase = 'round_finished';
    state.isBlocked = true;
    state.blockedReason = blockCheck.isBlocked
      ? blockCheck.reason
      : 'All players passed consecutively — round blocked.';
    state.roundWinnerId = blockedEval.winnerId;
    state.revealedHands = { ...privateHands };
    session.lastPass = null;
    state.canUndoPass = false;
    state.lastPassPlayerId = null;

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

/**
 * Allows a player who passed to undo their pass, provided no player has taken an action
 * (played a tile or drawn from boneyard) after them.
 */
export function undoPassAction(
  session: EngineSession,
  playerId: string
): { success: boolean; error?: string } {
  const { state } = session;

  if (state.phase !== 'playing') {
    return { success: false, error: 'Cannot undo pass: round is not in active playing state' };
  }

  if (!session.lastPass || session.lastPass.playerId !== playerId) {
    return {
      success: false,
      error: 'Cannot undo pass: another player has already played after you, or you did not pass.',
    };
  }

  const player = state.players.find((p) => p.id === playerId);

  // Revert consecutivePasses
  state.consecutivePasses = Math.max(0, state.consecutivePasses - 1);

  // Return turn to this player
  state.currentTurnPlayerId = playerId;
  state.turnStartTime = Date.now();

  // Clear lastPass
  session.lastPass = null;
  state.canUndoPass = false;
  state.lastPassPlayerId = null;

  state.lastMoveSummary = {
    playerId,
    playerNickname: player ? player.nickname : 'Player',
    moveType: 'undo_pass',
    pointsAwarded: 0,
    description: `${player?.nickname || 'Player'} undid their pass`,
    timestamp: Date.now(),
  };

  return { success: true };
}

function advanceTurn(state: GameState) {
  // Advance turn clockwise according to seatIndex ordering around the table
  const sortedPlayers = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const currentIndex = sortedPlayers.findIndex((p) => p.id === state.currentTurnPlayerId);
  const nextIndex = (currentIndex + 1) % sortedPlayers.length;
  state.currentTurnPlayerId = sortedPlayers[nextIndex].id;
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
  session.lastPass = null;
  state.canUndoPass = false;
  state.lastPassPlayerId = null;

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

/**
 * Allows the room manager/creator to decide who starts the round after the game/round starts.
 */
export function selectStartingPlayerAction(
  session: EngineSession,
  callerPlayerId: string,
  selectedPlayerId: string
): { success: boolean; error?: string } {
  const { state } = session;
  const caller = state.players.find((p) => p.id === callerPlayerId);
  if (!caller || !caller.isHost) {
    return { success: false, error: 'Only the room manager can choose who starts the round' };
  }

  if (state.phase !== 'selecting_starter') {
    return { success: false, error: 'Starting player has already been selected for this round' };
  }

  const chosenPlayer = state.players.find((p) => p.id === selectedPlayerId);
  if (!chosenPlayer) {
    return { success: false, error: 'Selected player is not in this room' };
  }

  state.currentTurnPlayerId = selectedPlayerId;
  state.phase = 'playing';
  state.turnStartTime = Date.now();

  state.lastMoveSummary = {
    playerId: selectedPlayerId,
    playerNickname: chosenPlayer.nickname,
    moveType: 'play',
    pointsAwarded: 0,
    description: `${caller.nickname} chose ${chosenPlayer.nickname} to start Round ${state.roundNumber}`,
    timestamp: Date.now(),
  };

  return { success: true };
}

/**
 * Allows the room manager (host) to finish just the current round ("la partie") at any time.
 * Reveals all players' hands and exact dot counts, marks the round as finished,
 * and allows the manager to edit each player's score points.
 */
export function finishRoundAction(
  session: EngineSession,
  callerPlayerId: string
): { success: boolean; error?: string } {
  const { state } = session;
  const caller = state.players.find((p) => p.id === callerPlayerId);
  if (!caller || !caller.isHost) {
    return { success: false, error: 'Only the room manager can end the round' };
  }

  if (state.phase !== 'playing' && state.phase !== 'selecting_starter') {
    return { success: false, error: 'Cannot end round: round is not active' };
  }

  // Clear any unconfirmed staged tiles
  state.pendingPlacements = [];

  // Reveal all hands
  state.revealedHands = { ...session.privateHands };

  // Evaluate lowest pip holder
  const blockedEval = evaluateBlockedRound(
    state.players.map((p) => p.id),
    session.privateHands
  );
  state.roundWinnerId = blockedEval.winnerId;

  state.phase = 'round_finished';
  state.isBlocked = true;
  state.blockedReason = `${caller.nickname} (Manager) ended Round ${state.roundNumber}.`;

  // Reset pass and last move controls
  session.lastPass = null;
  state.canUndoPass = false;
  state.lastPassPlayerId = null;
  session.lastConfirmedMove = null;
  state.canChangeLastMove = false;

  state.lastMoveSummary = {
    playerId: callerPlayerId,
    playerNickname: caller.nickname,
    moveType: 'play',
    pointsAwarded: 0,
    description: `${caller.nickname} (Manager) ended Round ${state.roundNumber}`,
    timestamp: Date.now(),
  };

  return { success: true };
}

/**
 * Allows the room manager (host) to finish the match at any time via a dedicated button.
 */
export function finishGameAction(
  session: EngineSession,
  callerPlayerId: string
): { success: boolean; error?: string } {
  const { state } = session;
  const caller = state.players.find((p) => p.id === callerPlayerId);
  if (!caller || !caller.isHost) {
    return { success: false, error: 'Only the room manager can finish the match' };
  }

  // Find player with highest score
  let maxScore = -1;
  let leaderId: string | null = null;
  for (const p of state.players) {
    if (p.score > maxScore) {
      maxScore = p.score;
      leaderId = p.id;
    }
  }

  state.phase = 'game_finished';
  state.gameWinnerId = leaderId;
  state.revealedHands = { ...session.privateHands };

  state.lastMoveSummary = {
    playerId: callerPlayerId,
    playerNickname: caller.nickname,
    moveType: 'play',
    pointsAwarded: 0,
    description: `${caller.nickname} (Manager) finished the match!`,
    timestamp: Date.now(),
  };

  return { success: true };
}

/**
 * Allows the room manager (host) to edit/adjust any player's score at any time.
 */
export function updatePlayerScoresAction(
  session: EngineSession,
  callerPlayerId: string,
  scores: Record<string, number>
): { success: boolean; error?: string } {
  const { state } = session;
  const caller = state.players.find((p) => p.id === callerPlayerId);
  if (!caller || !caller.isHost) {
    return { success: false, error: 'Only the room manager can edit player scores' };
  }

  for (const [pid, newScore] of Object.entries(scores)) {
    const player = state.players.find((p) => p.id === pid);
    if (player && typeof newScore === 'number' && !isNaN(newScore)) {
      player.score = Math.max(0, Math.round(newScore));
    }
  }

  // If game is in game_finished, update gameWinnerId to leader with new scores
  if (state.phase === 'game_finished') {
    let maxScore = -1;
    let leaderId: string | null = null;
    for (const p of state.players) {
      if (p.score > maxScore) {
        maxScore = p.score;
        leaderId = p.id;
      }
    }
    state.gameWinnerId = leaderId;
  }

  state.lastMoveSummary = {
    playerId: callerPlayerId,
    playerNickname: caller.nickname,
    moveType: 'play',
    pointsAwarded: 0,
    description: `Manager updated player scores`,
    timestamp: Date.now(),
  };

  return { success: true };
}
