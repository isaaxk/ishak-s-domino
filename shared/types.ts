export type DominoSetType = 'double-6' | 'double-7' | 'double-8' | 'double-9';
export type GameType = 'classic' | 'all-fives';
export type StartingTileRule = 'free-starter' | 'random' | 'host-selects' | 'specific-tile' | 'highest-double' | 'highest-tile' | 'previous-winner';
export type EndGameCondition = 'target-score' | 'rounds-limit';
export type PlacementSide =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'turn-up'
  | 'turn-down'
  | 'turn-left'
  | 'turn-right'
  | 'free';

export interface GameSettings {
  dominoSet: DominoSetType;
  gameType: GameType;
  maxPlayers: number;
  tilesPerPlayer: number;
  tilesPerTurn: number; // 1 or 999 for unlimited
  allowDrawing: boolean;
  startingTileRule: StartingTileRule;
  specificStartingTile: string; // e.g. "tile-0-0"
  protectedTiles: string[]; // List of tile IDs that MUST NOT be placed in boneyard (e.g. ["tile-0-0", "tile-6-6"])
  protectedBoneyardTiles: number; // minimum tiles left in boneyard that cannot be drawn (traditional draw rule, e.g. 2 or 0)
  allowFreePlacement: boolean; // Simulates physical domino table freedom (e.g. [6|2] [5|5] [1|4])
  allowMultipleTilesPerTurn: boolean;
  showTileCounts: boolean; // Controls whether remaining domino counts for each player are visible
  targetScore: number; // e.g. 100 or 150 points
  endGameCondition: EndGameCondition;
  maxRounds: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  dominoSet: 'double-6',
  gameType: 'all-fives',
  maxPlayers: 4,
  tilesPerPlayer: 7,
  tilesPerTurn: 1,
  allowDrawing: true,
  startingTileRule: 'free-starter',
  specificStartingTile: 'tile-0-0',
  protectedTiles: [],
  protectedBoneyardTiles: 0, // 0 = draw until empty (stops at 0 tiles in draw pile)
  allowFreePlacement: true, // Physical table freedom enabled
  allowMultipleTilesPerTurn: false,
  showTileCounts: true, // Activated by default
  targetScore: 100,
  endGameCondition: 'target-score',
  maxRounds: 5,
};

export interface DominoTile {
  id: string; // e.g. "tile-6-6"
  sideA: number;
  sideB: number;
  totalPips: number;
  isDouble: boolean;
}

export interface PlacedTile {
  id: string;
  sideA: number;
  sideB: number;
  isDouble: boolean;
  x: number; // Grid / canvas X coordinate
  y: number; // Grid / canvas Y coordinate
  rotation: number; // 0, 90, 180, 270 degrees
  placedBy: string; // playerId
  turnNumber: number;
  stepIndex: number;
  placementSide?: PlacementSide; // 'left' | 'right' | 'free'
  attachedToId?: string;
  openPipsA?: boolean; // whether sideA is an exposed open endpoint
  openPipsB?: boolean; // whether sideB is an exposed open endpoint
}

export interface OpenEndInfo {
  tileId: string;
  side: 'A' | 'B';
  pipValue: number;
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  seatIndex: number;
  connected: boolean;
  tileCount: number;
  // Hand is ONLY present in the private state sent to this player!
  hand?: DominoTile[];
}

export type GamePhase =
  | 'waiting_players'
  | 'waiting_ready'
  | 'selecting_starter'
  | 'playing'
  | 'round_finished'
  | 'game_finished';

export type UserClearState =
  | 'Waiting for players'
  | 'Waiting for ready'
  | 'Choose starting player'
  | 'Waiting for host to choose starter'
  | 'Your turn'
  | "Opponent's turn"
  | 'Drawing'
  | 'Tile selected'
  | 'Placement mode'
  | 'Turn pending confirmation'
  | 'Round finished'
  | 'Game finished';

export interface MoveSummary {
  playerId: string;
  playerNickname: string;
  moveType: 'play' | 'draw' | 'pass' | 'undo_pass';
  pointsAwarded: number;
  description: string;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  roundNumber: number;
  currentTurnPlayerId: string | null;
  turnStartTime?: number;
  board: PlacedTile[];
  boneyardCount: number;
  protectedBoneyardCount: number;
  consecutivePasses: number;
  pendingPlacements: PlacedTile[];
  lastMoveSummary?: MoveSummary;
  roundWinnerId?: string | null;
  roundPointsWon?: number;
  revealedHands?: Record<string, DominoTile[]>;
  gameWinnerId?: string | null;
  settings: GameSettings;
  players: PlayerState[];
  openEnds?: OpenEndInfo[];
  currentOpenEndsSum?: number;
  canChangeLastMove?: boolean;
  lastMovePlayerId?: string | null;
  canUndoPass?: boolean;
  lastPassPlayerId?: string | null;
  isBlocked?: boolean;
  blockedReason?: string;
  starterRequest?: {
    playerId: string;
    playerNickname: string;
  } | null;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: { nickname: string; settings?: Partial<GameSettings> },
    callback: (res: { success: boolean; roomId?: string; sessionToken?: string; playerId?: string; error?: string }) => void
  ) => void;

  'room:join': (
    payload: { roomId: string; nickname: string; sessionToken?: string },
    callback: (res: { success: boolean; isHost?: boolean; sessionToken?: string; playerId?: string; error?: string }) => void
  ) => void;

  'room:update_settings': (
    payload: { settings: Partial<GameSettings> },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:reorder_players': (
    payload: { playerIds: string[] },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'player:ready': (
    payload: { isReady: boolean },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:start': (
    payload: { startingPlayerId?: string } | ((res: { success: boolean; error?: string }) => void),
    callback?: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:next_round': (
    payload: { startingPlayerId?: string } | ((res: { success: boolean; error?: string }) => void),
    callback?: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:select_starter': (
    payload: { playerId: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:place_tile': (
    payload: { tileId: string; x: number; y: number; rotation: number; placementSide?: PlacementSide; attachedToId?: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:rotate_tile': (
    payload: { tileId: string; rotation: number },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:undo_turn': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:confirm_turn': (
    callback: (res: { success: boolean; pointsScored?: number; error?: string }) => void
  ) => void;

  'game:change_last_move': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:draw_tile': (
    callback: (res: { success: boolean; tile?: DominoTile; error?: string }) => void
  ) => void;

  'game:pass': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:undo_pass': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:finish_round': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:finish_game': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:update_scores': (
    payload: { scores: Record<string, number> },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:leave': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:kick_player': (
    payload: { playerId: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:assign_seat': (
    payload: { playerId: string; seatIndex: number },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:volunteer_starter': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:respond_starter_request': (
    payload: { approved: boolean },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:restart': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: GameState) => void;
  'game:hand_sync': (payload: { hand: DominoTile[] }) => void;
  'game:turn_change': (payload: { currentTurnPlayerId: string; playerNickname: string }) => void;
  'game:score_change': (payload: { playerId: string; delta: number; newScore: number; reason: string }) => void;
  'game:tile_placed': (payload: { playerId: string; tile: PlacedTile }) => void;
  'game:tile_drawn': (payload: { playerId: string; remainingBoneyard: number }) => void;
  'game:player_pass': (payload: { playerId: string; consecutivePasses: number }) => void;
  'game:round_over': (payload: { winnerId: string | null; pointsWon: number; reason: string; revealedHands: Record<string, DominoTile[]> }) => void;
  'game:game_over': (payload: { winnerId: string; finalScores: Record<string, number> }) => void;
  'player:kicked': (payload: { reason: string }) => void;
  'error:notification': (payload: { message: string }) => void;
}

/**
 * Calculates the default matching rotation for a domino tile when placed
 * against a base tile on the board.
 * - Double tiles always default to vertical (90°)
 * - Non-double tiles are oriented so the touching half matches the exposed pip value
 *   of the base tile (e.g. if table end has 4, tile [4|3] connects 4 to 4).
 */
export function getMatchingRotation(
  tile: DominoTile,
  placementSide: PlacementSide,
  baseTile?: PlacedTile,
  isLeftOrTopEnd?: boolean,
  overrideExposedPip?: number
): number {
  // 1. Double tiles: always placed opposite of the tile that is before it.
  // When the road is vertical (placement direction is top/bottom/turn-up/turn-down or baseTile is vertical),
  // the double must be placed horizontally (0°).
  // When the road is horizontal (placement direction is left/right/turn-left/turn-right or baseTile is horizontal),
  // the double must be placed vertically (90°).
  if (tile.isDouble) {
    if (
      placementSide === 'top' ||
      placementSide === 'bottom' ||
      placementSide === 'turn-up' ||
      placementSide === 'turn-down'
    ) {
      return 0;
    }
    if (
      placementSide === 'left' ||
      placementSide === 'right' ||
      placementSide === 'turn-left' ||
      placementSide === 'turn-right'
    ) {
      return 90;
    }
    if (!baseTile) {
      return 90; // Opening double on empty table is vertical
    }
    const isBaseVertical = baseTile.rotation === 90 || baseTile.rotation === 270;
    return isBaseVertical ? 0 : 90;
  }

  if (!baseTile && overrideExposedPip === undefined) {
    return 0;
  }

  const isBaseVertical = baseTile ? (baseTile.rotation === 90 || baseTile.rotation === 270) : false;

  // 2. Determine the exposed pip on the baseTile at the connection point
  let exposedPip = overrideExposedPip !== undefined ? overrideExposedPip : (baseTile ? baseTile.sideA : 0);
  if (overrideExposedPip === undefined && baseTile) {
    if (!isBaseVertical) {
      const connectingToLeft = placementSide === 'left' || isLeftOrTopEnd;
      if (connectingToLeft) {
        exposedPip = baseTile.rotation === 180 ? baseTile.sideB : baseTile.sideA;
      } else {
        exposedPip = baseTile.rotation === 180 ? baseTile.sideA : baseTile.sideB;
      }
    } else {
      const connectingToTop = placementSide === 'top' || isLeftOrTopEnd;
      if (connectingToTop) {
        exposedPip = baseTile.rotation === 270 ? baseTile.sideB : baseTile.sideA;
      } else {
        exposedPip = baseTile.rotation === 270 ? baseTile.sideA : baseTile.sideB;
      }
    }
  }

  // 3. Determine which rotation makes the touching half of the new tile match exposedPip
  switch (placementSide) {
    case 'right': {
      // Touching half is LEFT
      if (tile.sideA === exposedPip) return 0;
      if (tile.sideB === exposedPip) return 180;
      return 0;
    }
    case 'left': {
      // Touching half is RIGHT
      if (tile.sideB === exposedPip) return 0;
      if (tile.sideA === exposedPip) return 180;
      return 0;
    }
    case 'turn-up': {
      // Touching half is BOTTOM
      if (tile.sideB === exposedPip) return 90;
      if (tile.sideA === exposedPip) return 270;
      return 90;
    }
    case 'turn-down': {
      // Touching half is TOP
      if (tile.sideA === exposedPip) return 90;
      if (tile.sideB === exposedPip) return 270;
      return 90;
    }
    case 'top': {
      // Touching half is BOTTOM
      if (tile.sideB === exposedPip) return 90;
      if (tile.sideA === exposedPip) return 270;
      return 90;
    }
    case 'bottom': {
      // Touching half is TOP
      if (tile.sideA === exposedPip) return 90;
      if (tile.sideB === exposedPip) return 270;
      return 90;
    }
    case 'turn-left': {
      // Touching half is RIGHT
      if (tile.sideB === exposedPip) return 0;
      if (tile.sideA === exposedPip) return 180;
      return 0;
    }
    case 'turn-right': {
      // Touching half is LEFT
      if (tile.sideA === exposedPip) return 0;
      if (tile.sideB === exposedPip) return 180;
      return 0;
    }
    default:
      return 0;
  }
}

/**
 * Returns exact bounding box width and height for a domino at a given rotation.
 */
export function getTileDimensions(rotation: number): { width: number; height: number } {
  const isVertical = rotation === 90 || rotation === 270;
  return {
    width: isVertical ? 40 : 80,
    height: isVertical ? 80 : 40,
  };
}

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

function evaluateLeaf(leaf: PlacedTile, parent?: PlacedTile, board?: PlacedTile[]): OpenEndInfo {
  let effectiveParent: { x: number; y: number } | undefined = parent;
  if (!effectiveParent && board && board.length > 1) {
    const others = board.filter((t) => t.id !== leaf.id);
    if (others.length > 0) {
      const avgX = others.reduce((acc, t) => acc + t.x, 0) / others.length;
      const avgY = others.reduce((acc, t) => acc + t.y, 0) / others.length;
      effectiveParent = { x: avgX, y: avgY };
    }
  }

  if (leaf.isDouble) {
    let isCrosswise = true;
    if (effectiveParent) {
      const isParentVertical = Math.abs(leaf.y - effectiveParent.y) > Math.abs(leaf.x - effectiveParent.x);
      const isLeafVertical = leaf.rotation === 90 || leaf.rotation === 270;
      if (isParentVertical === isLeafVertical) {
        isCrosswise = false;
      }
    }

    if (isCrosswise) {
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

  let exposedSide: 'A' | 'B' = 'A';
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
    } else {
      exposedSide = 'A';
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

  if (board.length === 1) {
    const tile = board[0];
    if (tile.isDouble) {
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x, y: tile.y - 25 },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x, y: tile.y + 25 },
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x - 25, y: tile.y },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x + 25, y: tile.y },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    } else {
      const openEnds: OpenEndInfo[] = [
        { tileId: tile.id, side: 'A', pipValue: tile.sideA, x: tile.x - 42, y: tile.y },
        { tileId: tile.id, side: 'B', pipValue: tile.sideB, x: tile.x + 42, y: tile.y },
      ];
      return { openEnds, sum: tile.sideA + tile.sideB };
    }
  }

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

        openEnds.push(evaluateLeaf(current, prev, board));
      } else {
        openEnds.push(getSpinnerOpenEnd(spinner, dir));
      }
    }
  } else {
    const leaves = board.filter((t) => (adj.get(t.id) || []).length <= 1);

    if (leaves.length >= 2) {
      for (const leaf of leaves.slice(0, 2)) {
        const parent = (adj.get(leaf.id) || [])[0];
        openEnds.push(evaluateLeaf(leaf, parent, board));
      }
    } else if (leaves.length === 1) {
      const leaf = leaves[0];
      const parent = (adj.get(leaf.id) || [])[0];
      openEnds.push(evaluateLeaf(leaf, parent, board));
    } else {
      const leftMost = board.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), board[0]);
      const rightMost = board.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), board[0]);
      openEnds.push(evaluateLeaf(leftMost, undefined, board));
      if (rightMost.id !== leftMost.id) {
        openEnds.push(evaluateLeaf(rightMost, undefined, board));
      }
    }
  }

  const sum = openEnds.reduce((acc, end) => acc + end.pipValue, 0);
  return { openEnds, sum };
}

