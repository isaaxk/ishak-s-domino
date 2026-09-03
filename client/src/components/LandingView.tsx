import React, { useState, useEffect } from 'react';
import type { DominoSetType, GameType, GameSettings } from '../../../shared/types.js';
import { DEFAULT_SETTINGS } from '../../../shared/types.js';
import { Users, Plus, LogIn, Sparkles, RotateCcw } from 'lucide-react';

interface LandingViewProps {
  onCreateRoom: (nickname: string, settings: Partial<GameSettings>) => void;
  onJoinRoom: (roomId: string, nickname: string) => void;
  savedSession?: { roomId: string; nickname: string } | null;
  onResumeSession: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  savedSession,
  onResumeSession,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // Quick settings for Create Room
  const [dominoSet, setDominoSet] = useState<DominoSetType>('double-6');
  const [gameType, setGameType] = useState<GameType>('all-fives');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);

  // Parse room code from query params (e.g. ?room=A7K9P2)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomCode(code.toUpperCase());
      setTab('join');
    }
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    onCreateRoom(nickname.trim(), {
      dominoSet,
      gameType,
      maxPlayers,
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomCode.trim()) return;
    onJoinRoom(roomCode.trim().toUpperCase(), nickname.trim());
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col justify-center items-center gap-5 overflow-y-auto">
      {/* Brand Hero Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-14 rounded-lg bg-domino-ivory shadow-lg border border-neutral-300 flex flex-col items-center justify-around py-1">
            <div className="w-2 h-2 rounded-full bg-domino-pip" />
            <div className="w-5 h-[1.5px] bg-neutral-300" />
            <div className="w-2 h-2 rounded-full bg-domino-pip" />
          </div>
          <div className="w-9 h-14 rounded-lg bg-domino-ivory shadow-lg border border-neutral-300 flex flex-col items-center justify-around py-1">
            <div className="w-2 h-2 rounded-full bg-domino-pip" />
            <div className="w-5 h-[1.5px] bg-neutral-300" />
            <div className="w-2 h-2 rounded-full bg-domino-pip" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-white tracking-tight">
          Domino Table
        </h1>
        <p className="text-xs text-emerald-400 font-semibold max-w-xs">
          Physical freedom online multiplayer. Place tiles freely, play All Fives or Classic block.
        </p>
      </div>

      {/* Resume Active Session Card */}
      {savedSession && (
        <div className="w-full bg-slate-800/90 border border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col">
            <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
              Previous Game Detected
            </span>
            <span className="text-xs text-white font-medium">
              Room: <span className="font-mono font-bold text-amber-300">{savedSession.roomId}</span> ({savedSession.nickname})
            </span>
          </div>
          <button
            onClick={onResumeSession}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition"
          >
            <RotateCcw size={14} /> Resume
          </button>
        </div>
      )}

      {/* Main Tab Box */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 flex flex-col gap-4">
        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              tab === 'create'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus size={15} /> Create Room
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              tab === 'join'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn size={15} /> Join Room
          </button>
        </div>

        {/* Tab 1: Create Room */}
        {tab === 'create' ? (
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Your Nickname</label>
              <input
                type="text"
                required
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Omar, Sara, Ali..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Domino Set */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Domino Set</label>
              <div className="grid grid-cols-2 gap-2">
                {(['double-6', 'double-7', 'double-8', 'double-9'] as DominoSetType[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDominoSet(st)}
                    className={`py-2 px-2.5 rounded-xl font-medium border text-center transition capitalize text-[11px] ${
                      dominoSet === st
                        ? 'bg-emerald-600/90 border-emerald-400 text-white font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Game Type */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Game Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['all-fives', 'classic'] as GameType[]).map((gt) => (
                  <button
                    key={gt}
                    type="button"
                    onClick={() => setGameType(gt)}
                    className={`py-2 px-2.5 rounded-xl font-medium border text-center transition capitalize text-[11px] ${
                      gameType === gt
                        ? 'bg-emerald-600/90 border-emerald-400 text-white font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {gt === 'all-fives' ? 'All Fives (Muggins)' : 'Classic Domino'}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Players */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Max Players</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:ring-2 focus:ring-emerald-500"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} Players
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-sm rounded-2xl shadow-glow transition active:scale-98 flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Create Room & Table
            </button>
          </form>
        ) : (
          /* Tab 2: Join Room */
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Room Code</label>
              <input
                type="text"
                required
                maxLength={8}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. A7K9P2"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold tracking-widest uppercase placeholder-slate-500 text-center text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Your Nickname</label>
              <input
                type="text"
                required
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Omar, Sara, Ali..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim() || !roomCode.trim()}
              className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-sm rounded-2xl shadow-glow transition active:scale-98 flex items-center justify-center gap-2"
            >
              <LogIn size={18} /> Join Room
            </button>
          </form>
        )}
      </div>

      <div className="text-[11px] text-slate-500 text-center flex items-center gap-1">
        <Sparkles size={12} className="text-emerald-400" />
        Simulates the freedom of physical domino play
      </div>
    </div>
  );
};
