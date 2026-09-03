import React, { useState } from 'react';
import type { GameState } from '../../../shared/types.js';
import { Crown, Check, Play, Compass } from 'lucide-react';

interface SelectStarterModalProps {
  state: GameState;
  myPlayerId: string;
  isHost: boolean;
  onSelectStarter: (playerId: string) => void;
}

export const SelectStarterModal: React.FC<SelectStarterModalProps> = ({
  state,
  myPlayerId,
  isHost,
  onSelectStarter,
}) => {
  if (state.phase !== 'selecting_starter') return null;

  const [chosenPlayerId, setChosenPlayerId] = useState<string>(
    state.roundWinnerId || myPlayerId || state.players[0]?.id || ''
  );

  const manager = state.players.find((p) => p.isHost);

  const getSeatName = (seatIndex: number, total: number) => {
    if (total <= 2) return seatIndex === 0 ? 'South (Bottom)' : 'North (Top)';
    if (total === 3) return seatIndex === 0 ? 'South (Bottom)' : seatIndex === 1 ? 'West (Left)' : 'East (Right)';
    const names = ['South (Bottom)', 'West (Left)', 'North (Top)', 'East (Right)', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'];
    return names[seatIndex] || `Seat ${seatIndex + 1}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {isHost ? (
        /* Manager / Creator Decision Dialog */
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-lg">
            <Crown size={28} />
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-widest text-amber-400 font-black flex items-center justify-center gap-1.5">
              <Crown size={14} /> Manager Decision • Round {state.roundNumber}
            </span>
            <h2 className="text-xl font-black text-white mt-1">
              Who Starts Round {state.roundNumber}?
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Choose the player who will put the first domino on the table.
            </p>
          </div>

          {/* Player Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-1">
            {state.players.map((p) => {
              const isSelected = chosenPlayerId === p.id;
              const isWinner = p.id === state.roundWinnerId;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setChosenPlayerId(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                    isSelected
                      ? 'bg-amber-500/25 border-amber-400 text-white shadow-glow ring-2 ring-amber-400/60'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-amber-400 flex-shrink-0">
                    {p.nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col truncate flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-sm font-bold truncate">
                        {p.nickname} {p.id === myPlayerId && '(You)'}
                      </span>
                      {isWinner && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-700 text-emerald-100 rounded-full font-bold uppercase">
                          Winner
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-amber-300/80 font-medium flex items-center gap-1">
                      <Compass size={11} className="text-amber-400" />
                      Pos {p.seatIndex + 1}: {getSeatName(p.seatIndex, state.players.length)}
                    </span>
                  </div>
                  {isSelected && <Check size={18} className="text-amber-400 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onSelectStarter(chosenPlayerId)}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm shadow-glow transition flex items-center justify-center gap-2"
          >
            <Play size={16} /> Confirm &amp; Put First Domino
          </button>
        </div>
      ) : (
        /* Non-Manager Waiting View */
        <div className="w-full max-w-sm bg-slate-900/95 border border-amber-500/50 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Crown size={24} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Round {state.roundNumber} Started
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Waiting for the manager (<span className="text-amber-300 font-bold">{manager?.nickname || 'Host'}</span>) to decide who puts the first domino...
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Tiles dealt to your dock</span>
          </div>
        </div>
      )}
    </div>
  );
};
