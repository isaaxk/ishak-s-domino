export type DominoSetType = 'double-6' | 'double-7' | 'double-8' | 'double-9';
export type GameType = 'classic' | 'all-fives';
export type StartingTileRule = 'random' | 'host-selects' | 'specific-tile' | 'highest-double' | 'highest-tile' | 'previous-winner';
export type EndGameCondition = 'target-score' | 'rounds-limit';
export type PlacementSide = 'left' | 'right' | 'top' | 'bottom' | 'free';

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
  startingTileRule: 'host-selects',
  specificStartingTile: 'tile-0-0',
  protectedTiles: ['tile-0-0'],
  protectedBoneyardTiles: 2,
  allowFreePlacement: true, // Physical table freedom enabled
  allowMultipleTilesPerTurn: false,
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
  openPipsA?: boolean;
  openPipsB?: boolean;
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
  moveType: 'play' | 'draw' | 'pass';
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
