import React, { useState } from 'react';
import type { GameState, GameSettings } from '../../../shared/types.js';
import {
  Crown,
  CheckCircle2,
  Circle,
  Users,
  Settings,
  Play,
  Copy,
  Check,
  Share2,
  ChevronUp,
  ChevronDown,
  Compass,
  LogOut,
  UserX,
} from 'lucide-react';

interface LobbyViewProps {
  state: GameState;
  myPlayerId: string;
  isHost: boolean;
  onToggleReady: (ready: boolean) => void;
  onStartGame: (startingPlayerId?: string) => void;
  onOpenSettings: () => void;
  onReorderPlayers?: (playerIds: string[]) => void;
  onAssignSeat?: (playerId: string, seatIndex: number) => void;
  onKickPlayer?: (playerId: string) => void;
  onLeaveRoom: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  state,
  myPlayerId,
  isHost,
  onToggleReady,
  onStartGame,
  onOpenSettings,
  onReorderPlayers,
  onAssignSeat,
  onKickPlayer,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const me = state.players.find((p) => p.id === myPlayerId);
  const minPlayersMet = state.players.length >= 2;

  const getSeatPositionName = (seatIndex: number, total: number) => {
    if (total <= 2) return seatIndex === 0 ? 'South (Bottom)' : 'North (Top)';
    if (total === 3) return seatIndex === 0 ? 'South (Bottom)' : seatIndex === 1 ? 'West (Left)' : 'East (Right)';
    const names = ['South (Bottom)', 'West (Left)', 'North (Top)', 'East (Right)', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'];
    return names[seatIndex] || `Seat ${seatIndex + 1}`;
  };

  const handleMovePlayer = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= state.players.length) return;

    const currentIds = state.players.map((p) => p.id);
    const temp = currentIds[currentIndex];
    currentIds[currentIndex] = currentIds[targetIndex];
    currentIds[targetIndex] = temp;

    onReorderPlayers?.(currentIds);
  };

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Lobby & Room Code
            </span>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to leave this room?')) {
                  onLeaveRoom();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 rounded-xl border border-rose-800/50 transition font-bold"
              title="Leave Room"
            >
              <LogOut size={14} /> Leave Room
            </button>
          </div>

          <div className="flex items-center justify-center gap-3">
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
          <p className="text-xs text-slate-400 text-center">
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
            {state.players.map((p, index) => {
              const totalSlots = Math.max(state.settings.maxPlayers || 6, 6);

              return (
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
                          <Crown size={14} className="text-amber-400 fill-amber-400" title="Manager / Host" />
                        )}
                        {p.id === myPlayerId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">You</span>
                        )}
                      </div>

                      {/* Position Number Selector or Display */}
                      {isHost ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Compass size={11} className="text-amber-400" />
                          <label className="text-[10px] font-bold text-slate-400">Pos:</label>
                          <select
                            value={p.seatIndex}
                            onChange={(e) => onAssignSeat?.(p.id, Number(e.target.value))}
                            className="bg-slate-900 text-amber-300 font-bold text-xs px-2 py-0.5 rounded border border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            title="Manager assigns position number to this player"
                          >
                            {Array.from({ length: totalSlots }).map((_, sIdx) => (
                              <option key={sIdx} value={sIdx}>
                                Position {sIdx + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-amber-300/90 font-medium mt-0.5">
                          <Compass size={11} className="text-amber-400" />
                          <span>Position {p.seatIndex + 1}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Shift Position Up / Down */}
                    {isHost && state.players.length > 1 && (
                      <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                        <button
                          onClick={() => handleMovePlayer(index, 'up')}
                          disabled={index === 0}
                          className={`p-1 rounded transition ${
                            index === 0
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95'
                          }`}
                          title="Shift position earlier"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMovePlayer(index, 'down')}
                          disabled={index === state.players.length - 1}
                          className={`p-1 rounded transition ${
                            index === state.players.length - 1
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95'
                          }`}
                          title="Shift position later"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    )}

                    {/* Manager Kick Player Button */}
                    {isHost && p.id !== myPlayerId && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to kick ${p.nickname} from the room?`)) {
                            onKickPlayer?.(p.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-800/40 transition active:scale-95"
                        title={`Kick ${p.nickname}`}
                      >
                        <UserX size={15} />
                      </button>
                    )}

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
                </div>
              );
            })}
          </div>

          {/* Visual Table Seating Arrangement: Displays ALL Positions (1 to N) */}
          {state.players.length >= 1 && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Compass size={14} /> Physical Table Layout ({Math.max(state.settings.maxPlayers || 6, 6)} Positions)
                </span>
                {isHost && <span className="text-[10px] text-amber-300/80 font-normal">Manager gives each player a number</span>}
              </div>

              {/* Oval Domino Felt Table with ALL Positions Clearly Numbered */}
              <div className="relative w-full h-44 sm:h-52 bg-[#04140b] rounded-3xl border border-emerald-950/80 p-2 flex items-center justify-center shadow-inner overflow-hidden">
                {/* Watermark in center */}
                <div className="text-center select-none pointer-events-none">
                  <div className="text-[10px] font-serif font-black tracking-widest text-amber-400/25 uppercase">
                    ISHAK'S DOMINO
                  </div>
                  <div className="text-[8px] tracking-wider text-amber-400/20 uppercase mt-0.5">
                    CLOCKWISE TURNS: 1 → 2 → 3 → 4 → 5 → 6
                  </div>
                </div>

                {/* Render every single position slot from 1 to totalSlots */}
                {(() => {
                  const totalSlots = Math.max(state.settings.maxPlayers || 6, 6);
                  return Array.from({ length: totalSlots }).map((_, slotIdx) => {
                    // Calculate oval coordinates
                    const angle = Math.PI / 2 + (slotIdx * 2 * Math.PI) / totalSlots;
                    const x = 50 - 41 * Math.sin(angle);
                    const y = 50 + 36 * Math.cos(angle);

                    const playerAtSlot = state.players.find((pl) => pl.seatIndex === slotIdx);

                    return (
                      <div
                        key={slotIdx}
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          position: 'absolute',
                        }}
                        className="z-10"
                      >
                        {playerAtSlot ? (
                          <div
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1 whitespace-nowrap border ${
                              playerAtSlot.isHost
                                ? 'bg-amber-950/95 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                                : playerAtSlot.id === myPlayerId
                                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                                : 'bg-slate-900/95 border-slate-700 text-slate-200'
                            }`}
                            title={`Position ${slotIdx + 1}: ${playerAtSlot.nickname}`}
                          >
                            <span className="w-4 h-4 rounded-full bg-amber-400/25 text-amber-300 text-[9px] flex items-center justify-center font-black border border-amber-500/40">
                              {slotIdx + 1}
                            </span>
                            <span className="truncate max-w-[64px] sm:max-w-[80px]">{playerAtSlot.nickname}</span>
                            {playerAtSlot.isHost && <Crown size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                          </div>
                        ) : (
                          <div
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-slate-700/70 bg-slate-950/50 text-slate-500 flex items-center gap-1 whitespace-nowrap"
                            title={`Position ${slotIdx + 1}: Empty`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-slate-800 text-slate-400 text-[9px] flex items-center justify-center font-bold">
                              {slotIdx + 1}
                            </span>
                            <span className="text-[9px]">Pos {slotIdx + 1}</span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="text-[10px] text-slate-400 text-center">
                All table positions are numbered 1 through {Math.max(state.settings.maxPlayers || 6, 6)}. Turn order follows position numbers clockwise.
              </div>
            </div>
          )}

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
            onClick={() => onStartGame()}
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
