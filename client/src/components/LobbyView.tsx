import React, { useState } from 'react';
import type { GameState, GameSettings } from '../../../shared/types.js';
import { Crown, CheckCircle2, Circle, Users, Settings, Play, Copy, Check, Share2 } from 'lucide-react';

interface LobbyViewProps {
  state: GameState;
  myPlayerId: string;
  isHost: boolean;
  onToggleReady: (ready: boolean) => void;
  onStartGame: (startingPlayerId?: string) => void;
  onOpenSettings: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  state,
  myPlayerId,
  isHost,
  onToggleReady,
  onStartGame,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedStarterId, setSelectedStarterId] = useState<string>(myPlayerId);
  const me = state.players.find((p) => p.id === myPlayerId);
  const minPlayersMet = state.players.length >= 2;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(state.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoomLink = () => {
    const shareUrl = `${window.location.origin}?room=${state.roomId}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Domino Table!',
        text: `Join room ${state.roomId} to play Dominoes with me!`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col justify-between overflow-y-auto">
      <div className="flex flex-col gap-5">
        {/* Room Header & Code Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-center flex flex-col items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Lobby & Room Code
          </span>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-mono font-black text-emerald-400 tracking-wider">
              {state.roomId}
            </span>
            <button
              onClick={copyRoomCode}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 active:scale-95 transition"
              title="Copy Code"
            >
              {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
            </button>
            <button
              onClick={shareRoomLink}
              className="p-2 bg-emerald-800 hover:bg-emerald-700 rounded-xl text-emerald-200 active:scale-95 transition"
              title="Share Invite Link"
            >
              <Share2 size={20} />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Share this code with your friends on phone or PC to join the table.
          </p>
        </div>

        {/* Players in Room */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Users size={18} className="text-emerald-400" />
              <span>Players ({state.players.length}/{state.settings.maxPlayers})</span>
            </div>
            {isHost && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <Settings size={14} /> Room Settings
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {state.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-emerald-400">
                    {p.nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <span>{p.nickname}</span>
                      {p.isHost && (
                        <Crown size={14} className="text-amber-400 fill-amber-400" title="Host" />
                      )}
                      {p.id === myPlayerId && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">You</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold">
                  {p.isReady ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={16} /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Circle size={16} /> Waiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!minPlayersMet && (
            <div className="text-xs text-amber-400/90 bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-xl text-center">
              Waiting for at least 2 players to join before game can start.
            </div>
          )}
        </div>

        {/* Current Game Settings Summary */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 flex flex-col gap-1.5">
          <div className="font-semibold text-slate-300">Room Rules:</div>
          <div className="grid grid-cols-2 gap-1">
            <div>Set: <span className="text-slate-200 font-medium capitalize">{state.settings.dominoSet}</span></div>
            <div>Mode: <span className="text-slate-200 font-medium capitalize">{state.settings.gameType === 'all-fives' ? 'All Fives' : 'Classic'}</span></div>
            <div>Tiles/Player: <span className="text-slate-200 font-medium">{state.settings.tilesPerPlayer}</span></div>
            <div>Free Placement: <span className="text-emerald-400 font-medium">{state.settings.allowFreePlacement ? 'Enabled (Physical)' : 'Strict'}</span></div>
          </div>
        </div>

        {/* Creator / Host Starting Player Selector */}
        {isHost && minPlayersMet && (
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Crown size={15} /> Who Starts & Puts 1st Domino?
              </span>
              <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                Creator Decides
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {state.players.map((p) => {
                const isSelected = selectedStarterId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedStarterId(p.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow-lg ring-1 ring-amber-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-amber-400">
                        {p.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold truncate">
                        {p.nickname} {p.id === myPlayerId && '(You)'}
                      </span>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-amber-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 italic">
              Tap any player above to give them the first turn to start the round.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col gap-2 pt-4 pb-2">
        {/* Toggle Ready Button for non-host */}
        {!isHost && me && (
          <button
            onClick={() => onToggleReady(!me.isReady)}
            className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 ${
              me.isReady
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow'
            }`}
          >
            {me.isReady ? 'Cancel Ready' : "I'm Ready"}
          </button>
        )}

        {/* Host Start Game Button */}
        {isHost && (
          <button
            onClick={() => onStartGame(selectedStarterId)}
            disabled={!minPlayersMet}
            className={`w-full py-4 rounded-xl font-black text-sm shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 ${
              minPlayersMet
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Play size={18} /> Start Game
          </button>
        )}
      </div>
    </div>
  );
};
