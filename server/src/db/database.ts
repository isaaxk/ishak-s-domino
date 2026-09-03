import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { GameSettings, GameState, DominoTile, PlayerState } from '../shared/types.js';

export interface RoomRecord {
  id: string;
  host_id: string;
  status: string;
  settings_json: string;
  created_at: string;
}

export interface PlayerRecord {
  id: string;
  room_id: string;
  nickname: string;
  session_token: string;
  is_host: number;
  is_ready: number;
  score: number;
  seat_index: number;
  connected: number;
}

export class DominoDatabase {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.resolve(process.cwd(), 'domino.db');
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(finalPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        settings_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        session_token TEXT NOT NULL,
        is_host INTEGER DEFAULT 0,
        is_ready INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        seat_index INTEGER DEFAULT 0,
        connected INTEGER DEFAULT 1,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS game_states (
        room_id TEXT PRIMARY KEY,
        round_number INTEGER DEFAULT 1,
        state_json TEXT NOT NULL,
        hands_json TEXT NOT NULL,
        boneyard_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS moves_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        move_type TEXT NOT NULL,
        move_data_json TEXT NOT NULL,
        points_earned INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Room operations
  saveRoom(id: string, hostId: string, settings: GameSettings, status: string = 'waiting') {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (id, host_id, status, settings_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        host_id = excluded.host_id,
        status = excluded.status,
        settings_json = excluded.settings_json
    `);
    stmt.run(id, hostId, status, JSON.stringify(settings));
  }

  getRoom(id: string): { id: string; hostId: string; status: string; settings: GameSettings } | null {
    const stmt = this.db.prepare(`SELECT * FROM rooms WHERE id = ?`);
    const row = stmt.get(id) as RoomRecord | undefined;
    if (!row) return null;
    return {
      id: row.id,
      hostId: row.host_id,
      status: row.status,
      settings: JSON.parse(row.settings_json),
    };
  }

  // Player operations
  savePlayer(player: PlayerState, roomId: string, sessionToken: string) {
    const stmt = this.db.prepare(`
      INSERT INTO players (id, room_id, nickname, session_token, is_host, is_ready, score, seat_index, connected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nickname = excluded.nickname,
        is_host = excluded.is_host,
        is_ready = excluded.is_ready,
        score = excluded.score,
        seat_index = excluded.seat_index,
        connected = excluded.connected
    `);
    stmt.run(
      player.id,
      roomId,
      player.nickname,
      sessionToken,
      player.isHost ? 1 : 0,
      player.isReady ? 1 : 0,
      player.score,
      player.seatIndex,
      player.connected ? 1 : 0
    );
  }

  getPlayerByToken(sessionToken: string): (PlayerRecord & { playerState: PlayerState }) | null {
    const stmt = this.db.prepare(`SELECT * FROM players WHERE session_token = ?`);
    const row = stmt.get(sessionToken) as PlayerRecord | undefined;
    if (!row) return null;

    const playerState: PlayerState = {
      id: row.id,
      nickname: row.nickname,
      isHost: row.is_host === 1,
      isReady: row.is_ready === 1,
      score: row.score,
      seatIndex: row.seat_index,
      connected: row.connected === 1,
      tileCount: 0,
    };

    return {
      ...row,
      playerState,
    };
  }

  getRoomPlayers(roomId: string): { players: PlayerState[]; sessionTokens: Record<string, string> } {
    const stmt = this.db.prepare(`SELECT * FROM players WHERE room_id = ? ORDER BY seat_index ASC`);
    const rows = stmt.all(roomId) as unknown as PlayerRecord[];

    const players: PlayerState[] = [];
    const sessionTokens: Record<string, string> = {};

    for (const row of rows) {
      players.push({
        id: row.id,
        nickname: row.nickname,
        isHost: row.is_host === 1,
        isReady: row.is_ready === 1,
        score: row.score,
        seatIndex: row.seat_index,
        connected: row.connected === 1,
        tileCount: 0,
      });
      sessionTokens[row.id] = row.session_token;
    }

    return { players, sessionTokens };
  }

  // Game state persistence
  saveGameState(
    roomId: string,
    state: GameState,
    privateHands: Record<string, DominoTile[]>,
    boneyard: DominoTile[]
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO game_states (room_id, round_number, state_json, hands_json, boneyard_json, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(room_id) DO UPDATE SET
        round_number = excluded.round_number,
        state_json = excluded.state_json,
        hands_json = excluded.hands_json,
        boneyard_json = excluded.boneyard_json,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      roomId,
      state.roundNumber,
      JSON.stringify(state),
      JSON.stringify(privateHands),
      JSON.stringify(boneyard)
    );
  }

  getGameState(roomId: string): {
    state: GameState;
    privateHands: Record<string, DominoTile[]>;
    boneyard: DominoTile[];
  } | null {
    const stmt = this.db.prepare(`SELECT * FROM game_states WHERE room_id = ?`);
    const row = stmt.get(roomId) as { state_json: string; hands_json: string; boneyard_json: string } | undefined;
    if (!row) return null;

    return {
      state: JSON.parse(row.state_json),
      privateHands: JSON.parse(row.hands_json),
      boneyard: JSON.parse(row.boneyard_json),
    };
  }

  recordMove(
    roomId: string,
    roundNumber: number,
    playerId: string,
    moveType: string,
    moveData: unknown,
    pointsEarned: number = 0
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO moves_history (room_id, round_number, player_id, move_type, move_data_json, points_earned)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(roomId, roundNumber, playerId, moveType, JSON.stringify(moveData), pointsEarned);
  }

  close() {
    this.db.close();
  }
}
