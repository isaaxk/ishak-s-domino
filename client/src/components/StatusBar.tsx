import React from 'react';
import type { PlayerState, GameSettings } from '../../../shared/types.js';
import { Settings, Copy, Check, Info, LogOut, UserX } from 'lucide-react';

interface StatusBarProps {
  roomId: string;
  roundNumber: number;
  players: PlayerState[];
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  isHost: boolean;
  settings: GameSettings;
  isFreeStarterWaiting?: boolean;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onLeaveRoom: () => void;
  onKickPlayer?: (playerId: string) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  roomId,
  roundNumber,
  players,
  currentTurnPlayerId,
  myPlayerId,
  isHost,
  settings,
  isFreeStarterWaiting = false,
  onOpenSettings,
  onOpenHelp,
  onLeaveRoom,
  onKickPlayer,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full bg-slate-900/95 border-b border-slate-800 px-3 py-2 flex flex-col gap-2 z-20 backdrop-blur">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        {/* Room Code & Copy */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-700 text-xs font-mono font-bold text-slate-200 transition"
            title="Click to copy Room Code"
          >
            <span>Room: {roomId}</span>
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-400" />}
          </button>

          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
            {settings.gameType === 'all-fives' ? 'All Fives' : 'Classic'}
          </span>

          <span className="text-xs text-slate-400 font-medium">
            Rnd {roundNumber}
          </span>
        </div>

        {/* Action Icons: Help & Settings */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenHelp}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Game Rules"
          >
            <Info size={18} />
          </button>

          {isHost && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Host Settings"
            >
              <Settings size={18} />
            </button>
          )}

          {/* Leave Table Button */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to leave this table?')) {
                onLeaveRoom();
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition font-bold"
            title="Leave Table"
          >
            <LogOut size={13} /> Leave
          </button>
        </div>
      </div>

      {/* Players Score & Hand Count Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {isFreeStarterWaiting && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse flex-shrink-0">
            <span>🀱 Free Starter: Anyone can place the first domino!</span>
          </div>
        )}
        {players.map((p) => {
          const isTurn = p.id === currentTurnPlayerId;
          const isMe = p.id === myPlayerId;

          return (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-all border ${
                isTurn
                  ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200 shadow-glow font-bold'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-black text-amber-300 bg-slate-950/80 px-1.5 py-0.2 rounded-md border border-amber-500/30" title={`Table Position ${p.seatIndex + 1}`}>
                P{p.seatIndex + 1}
              </span>
              <span>{p.nickname} {isMe && '(You)'}</span>
              <span className="text-slate-400">|</span>
              <span className="font-bold text-amber-300">{p.score} pts</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/40 text-slate-300">
                {p.tileCount} 🀱
              </span>

              {/* Manager Kick Button during game */}
              {isHost && !isMe && onKickPlayer && (
                <button
                  onClick={() => {
                    if (confirm(`Kick ${p.nickname} from the game?`)) {
                      onKickPlayer(p.id);
                    }
                  }}
                  className="text-rose-400 hover:text-rose-200 hover:bg-rose-900/60 p-0.5 rounded transition ml-0.5"
                  title={`Kick ${p.nickname}`}
                >
                  <UserX size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
};
