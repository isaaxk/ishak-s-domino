# 🀱 Domino Table — Physical-Freedom Real-Time Multiplayer Dominoes

A production-ready, mobile-first real-time multiplayer Domino web application that simulates the tactile freedom of a physical domino table. Players can freely arrange tiles in 2D space without arbitrary rigid matching restrictions, while scoring engines (Classic Block/Draw and All Fives / Muggins) evaluate open chain ends dynamically.

---

## 1. Project Structure

```
domino-table/
├── package.json                 # Monorepo scripts (install:all, dev, build, test, start)
├── README.md                    # Complete setup, architecture, and deployment guide
├── shared/
│   └── types.ts                 # Shared TypeScript models and Socket.IO events
├── server/
│   ├── package.json             # Express, Socket.IO, node:sqlite, vitest
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts             # Express + Socket.IO server entrypoint & static host
│   │   ├── db/
│   │   │   └── database.ts      # SQLite (node:sqlite) WAL-mode persistence layer
│   │   ├── engine/
│   │   │   ├── domino-set.ts    # D6 (28), D7 (36), D8 (45), D9 (55) generator
│   │   │   ├── boneyard.ts      # Fisher-Yates crypto shuffle, draw & protected tiles
│   │   │   ├── board.ts         # 2D table layout, snap targets, free placement
│   │   │   ├── scoring.ts       # Classic (pip sums) & All Fives (ends multiples of 5)
│   │   │   └── game-engine.ts   # Pure state machine (turns, draws, pass, win conditions)
│   │   ├── sockets/
│   │   │   ├── room-manager.ts  # Room lifecycle, session tokens & real-time broadcasts
│   │   │   └── sanitize.ts      # Server-side hand masking & data isolation
│   │   └── shared/
│   │       └── types.ts         # Server-contained types
│   └── tests/
│       ├── domino-set.test.ts   # Tile counts, zero duplicates, config compatibility
│       ├── boneyard.test.ts     # Distribution, protected tiles, draw limits
│       ├── scoring.test.ts      # All Fives open ends calculation & Classic pip sums
│       ├── game-engine.test.ts  # Physical freedom [6|2][5|5][1|4], turn confirmation, domino win
│       ├── security-masking.test.ts # Zero-leakage verification of opponent hands
│       ├── multiplayer-sync.test.ts # Database persistence & session reconnection
│       └── multi-client-simulation.test.ts # End-to-end WebSocket simulation with 2 devices
└── client/
    ├── index.html               # Mobile viewport optimized HTML5 entry
    ├── package.json             # React 19, Vite, Tailwind CSS, Lucide icons, Confetti
    ├── vite.config.ts           # Proxy to backend on port 3001
    ├── tailwind.config.js       # Ivory tiles, felt pattern, brass pins, glow shadows
    └── src/
        ├── socket.ts            # Socket.IO client singleton with auto-reconnect
        ├── main.tsx
        ├── index.css            # Felt texture, no-scrollbar, touch optimization
        ├── App.tsx              # Main UI coordinator, Web Audio pips/chimes, state
        └── components/
            ├── DominoTileView.tsx    # Accurate pips (0-9), ivory bevel, brass spinner
            ├── DominoBoard.tsx       # 2D Pan/Zoom canvas with felt pattern & snap controls
            ├── PlayerHandDock.tsx    # Mobile touch carousel dock, rotate & confirm buttons
            ├── StatusBar.tsx         # Room code copy, round count, player score pills
            ├── LobbyView.tsx         # Shareable code, ready checkmarks, start button
            ├── HostSettingsModal.tsx # Advanced host rules configuration
            ├── RoundOverModal.tsx    # Revealed hands inspection, points breakdown
            ├── GameOverModal.tsx     # Victory podium, standings, confetti
            └── RulesHelpModal.tsx    # How-to-play, physical table philosophy guide
```

---

## 2. Database Schema (SQLite with WAL Mode)

Persistent storage is powered by Node.js built-in `node:sqlite` (`DatabaseSync`):

```sql
PRAGMA journal_mode = WAL;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,               -- 6-character code (e.g. 'A7K9P2')
  host_id TEXT NOT NULL,             -- Player UUID of the room creator
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  settings_json TEXT NOT NULL,       -- JSON serialized GameSettings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,               -- Unique player UUID
  room_id TEXT NOT NULL,             -- Foreign key to rooms(id)
  nickname TEXT NOT NULL,
  session_token TEXT NOT NULL,       -- Secret bearer token stored in client localStorage
  is_host INTEGER DEFAULT 0,
  is_ready INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  seat_index INTEGER DEFAULT 0,
  connected INTEGER DEFAULT 1,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Game states table (authoritative snapshots)
CREATE TABLE IF NOT EXISTS game_states (
  room_id TEXT PRIMARY KEY,
  round_number INTEGER DEFAULT 1,
  state_json TEXT NOT NULL,          -- Public authoritative GameState
  hands_json TEXT NOT NULL,          -- Secret map: { [playerId]: DominoTile[] }
  boneyard_json TEXT NOT NULL,       -- Remaining tiles in draw pile
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Turn and move audit history
CREATE TABLE IF NOT EXISTS moves_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  move_type TEXT NOT NULL,           -- 'play', 'draw', 'pass'
  move_data_json TEXT NOT NULL,
  points_earned INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Server Architecture

- **Runtime**: Node.js v22+ (v26.5.0) with ES Modules.
- **Protocol**: HTTP (Express) + WebSockets (Socket.IO).
- **State Machine**:
  - `RoomManager` maintains in-memory active sessions for sub-millisecond turn latency.
  - Every committed turn or state transition synchronously checkpoints to SQLite (`DatabaseSync`).
  - Graceful degradation: if the server restarts, existing rooms and player tokens are restored from SQLite.
- **Concurrency & Race Conditions**:
  - All mutating actions (`game:place_tile`, `game:confirm_turn`, `game:draw_tile`, `game:pass`) are serialized server-side.
  - Actions verify `currentTurnPlayerId === socketPlayerId` and validate that tiles belong to the player's secret hand.

---

## 4. Real-Time Event Architecture

### Client to Server
| Event | Payload | Description |
| :--- | :--- | :--- |
| `room:create` | `{ nickname, settings? }` | Host creates room, receives `roomId`, `sessionToken`, `playerId` |
| `room:join` | `{ roomId, nickname, sessionToken? }` | Joins room or reconnects an existing session |
| `room:update_settings` | `{ settings }` | Host updates game settings in lobby |
| `player:ready` | `{ isReady }` | Toggles player readiness |
| `game:start` | `()` | Host starts round 1 |
| `game:place_tile` | `{ tileId, x, y, rotation, placementSide? }` | Stages a tile placement on the table |
| `game:undo_turn` | `()` | Reverts unconfirmed placements back to hand |
| `game:confirm_turn` | `()` | Commits staged tiles, evaluates scores, advances turn |
| `game:draw_tile` | `()` | Draws 1 secret tile from boneyard to player's hand |
| `game:pass` | `()` | Passes turn; checks consecutive passes for blocked round |
| `game:next_round` | `()` | Host initiates next round after round completion |

### Server to Client
| Event | Payload | Description |
| :--- | :--- | :--- |
| `room:state` | `GameState` | Public state (masked: private hands stripped for opponents) |
| `game:hand_sync` | `{ hand: DominoTile[] }` | Sent privately only to the tile owner |
| `error:notification` | `{ message }` | Real-time rejection notice for illegal actions |

---

## 5. Game-State Model

```typescript
interface GameState {
  roomId: string;
  phase: 'waiting_players' | 'waiting_ready' | 'playing' | 'round_finished' | 'game_finished';
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
  revealedHands?: Record<string, DominoTile[]>; // Only populated on round end
  gameWinnerId?: string | null;
  settings: GameSettings;
  players: PlayerState[];
  openEnds?: OpenEndInfo[];
  currentOpenEndsSum?: number;
}
```

---

## 6. Game Engine & Scoring Engine

### Physical Table Freedom vs Strict Placement
In traditional digital dominoes, placing a tile is rejected if the connecting pip does not match. Our engine models a physical table:
- **Free Placement (`allowFreePlacement: true`)**: Players can place any domino on the left end, right end, or anywhere on the 2D felt coordinate plane (e.g. `[6|2] [5|5] [1|4]`).
- The board records the physical orientation (`0`, `90`, `180`, `270`) and positions of the dominoes.

### All Fives Scoring Engine (Muggins)
- At any stage, the scoring engine calculates the open exposed ends of the domino chain:
  - Solitary tile `[5|5]`: both ends exposed $\rightarrow 5 + 5 = 10$ ($+10\text{ pts}$).
  - Chain `[3|x] ... [y|2]`: exposed left pip is 3, exposed right pip is 2 $\rightarrow 3 + 2 = 5$ ($+5\text{ pts}$).
  - Chain ends totaling 10, 15, 20, 25, etc. immediately score that point value.
  - Non-multiples of 5 score 0 points for that turn.
- Round End Bonus: When a player empties their hand ("Domino!"), opponents' remaining pips are totaled and rounded to the nearest multiple of 5, then awarded to the round winner.

### Classic Mode Scoring
- Players aim to empty their hands.
- The round winner receives the exact sum of all pips remaining in all opponents' hands.
- In a blocked game (all players pass consecutively), the player with the lowest pip total wins.

---

## 7. Mobile-First UI & Clear UX States

The application adheres to 10 distinct, clear game states:
1. `Waiting for players`: Shareable Room Code, player count counter, host start controls.
2. `Waiting for ready`: Player readiness toggles, settings overview.
3. `Your turn`: Vibrant green turn banner, active hand carousel, draw/pass buttons.
4. `Opponent's turn`: Dark turn banner with active player nickname, hand disabled.
5. `Drawing`: 1-tap secret draw from boneyard.
6. `Tile selected`: Highlighted domino, 90° rotation button, left/right snap guides.
7. `Placement mode`: Interactive target highlights and free 2D tap placement.
8. `Turn pending confirmation`: Temporary unconfirmed placement shown with amber pulse; "Confirm Turn" & "Undo" buttons.
9. `Round finished`: Hands revealed, points awarded, "Next Round" ready check.
10. `Game finished`: Victory podium, final standings table, confetti celebration.

### Responsive Design
- Optimized for **320px, 375px, 390px, 414px**, tablets, and desktop displays.
- Zero horizontal root scrolling (`overflow-x: hidden`).
- 2D Felt Canvas supports:
  - Single-finger drag to pan across the table.
  - Pinch-to-zoom on mobile and mouse wheel on desktop.
  - "Recenter Table" crosshair button to instantly frame all placed tiles.

---

## 8. Multiplayer Security & Hand Masking

- Hand confidentiality is enforced strictly at the transport boundary (`sanitize.ts`).
- When sending `room:state` broadcasts:
  - The recipient socket receives only their own `hand: DominoTile[]`.
  - Opponents' hands are stripped from the payload, exposing only `tileCount: number`.
  - Boneyard tiles are masked (clients only see `boneyardCount: number`).
  - Players cannot view opponents' tiles via browser DevTools or WebSocket inspection.
  - Hands are only revealed publicly in `revealedHands` when the round or game finishes.

---

## 9. Reconnection Handling

- When a player creates or joins a room, the server issues a secret UUID `sessionToken`.
- The client stores `{ roomId, token, playerId, nickname }` in `localStorage`.
- If the browser refreshes, the app automatically reconnects via `room:join` using the `sessionToken`.
- The server recognizes the token, restores player state, re-links the new socket ID, and broadcasts the current state.

---

## 10. Automated Test Suite

Run the automated test suite with:
```bash
npm test
```

### Verified Test Results (26 / 26 passing)
```
 ✓ tests/security-masking.test.ts (2 tests)
 ✓ tests/domino-set.test.ts (6 tests)
 ✓ tests/scoring.test.ts (6 tests)
 ✓ tests/boneyard.test.ts (4 tests)
 ✓ tests/game-engine.test.ts (6 tests)
 ✓ tests/multiplayer-sync.test.ts (1 test)
 ✓ tests/multi-client-simulation.test.ts (1 test)

Test Files  7 passed (7)
     Tests  26 passed (26)
```

---

## 11. Setup & Installation

### Prerequisites
- Node.js v22+ (tested on Node v26.5.0)
- npm v10+

### Installation
From the project root:
```bash
# Install dependencies for both server and client
npm run install:all
```

### Running in Development
```bash
# Terminal 1: Run Server with hot reload
npm run server:dev

# Terminal 2: Run Client with Vite dev server
npm run client:dev
```
Open `http://localhost:3000` in your browser.

### Building for Production
```bash
npm run build
```
This compiles TypeScript for the server and builds the optimized Vite React SPA into `client/dist`.

### Running Production Server
```bash
npm start
```
The server serves both the WebSocket backend and the production frontend on `http://localhost:3001`.

---

## 12. Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | HTTP and WebSocket server port |
| `NODE_ENV` | `development` | Server runtime environment (`development` / `production`) |

---

## 13. Deployment Instructions

### Option A: Docker Deployment (Recommended)
Create a `Dockerfile` at the root:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN npm run build
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
CMD ["npm", "start"]
```
Build and run:
```bash
docker build -t domino-table .
docker run -p 3001:3001 -v domino_data:/app/server domino-table
```

### Option B: Cloud VM / VPS / DigitalOcean / Render / Railway
1. Clone repository to server.
2. Run `npm run install:all && npm run build`.
3. Start with systemd or PM2:
   ```bash
   pm2 start "npm start" --name domino-table
   ```
4. Point Nginx or Caddy to proxy `http://localhost:3001` with WebSocket upgrade headers enabled.
