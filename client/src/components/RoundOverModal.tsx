import React, { useState } from 'react';
import type { GameState, DominoTile } from '../../../shared/types.js';
import { DominoTileView } from './DominoTileView.js';
import { Trophy, ArrowRight, Play, Eye, Crown, Check } from 'lucide-react';

interface RoundOverModalProps {
  state: GameState;
  isHost: boolean;
  onNextRound: (startingPlayerId?: string) => void;
}

export const RoundOverModal: React.FC<RoundOverModalProps> = ({
  state,
  isHost,
  onNextRound,
}) => {
  if (state.phase !== 'round_finished') return null;

  const [selectedStarterId, setSelectedStarterId] = useState<string>(
    state.roundWinnerId || state.players[0]?.id || ''
  );

  const winner = state.players.find((p) => p.id === state.roundWinnerId);
  const revealedHands = state.revealedHands || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header Banner */}
        <div className="p-5 bg-gradient-to-r from-emerald-900/60 to-slate-900 border-b border-slate-800 text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg border border-amber-500/30">
            <Trophy size={24} />
          </div>
          <h2 className="text-xl font-black text-white">
            {winner ? `${winner.nickname} Won Round ${state.roundNumber}!` : `Round ${state.roundNumber} Blocked!`}
          </h2>
          <p className="text-xs text-emerald-400 font-semibold">
            {state.roundPointsWon ? `+${state.roundPointsWon} bonus points awarded!` : 'Round ended'}
          </p>
        </div>

        {/* Revealed Hands Section */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <Eye size={15} className="text-emerald-400" />
            <span>Revealed Hands & Remaining Dominoes</span>
          </div>

          <div className="flex flex-col gap-3">
            {state.players.map((p) => {
              const hand = revealedHands[p.id] || [];
              const isWinner = p.id === state.roundWinnerId;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border flex flex-col gap-2 ${
                    isWinner
                      ? 'bg-emerald-950/40 border-emerald-600/60'
                      : 'bg-slate-850 bg-slate-800/60 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span>{p.nickname}</span>
                      {isWinner && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 uppercase">
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-amber-300">
                      Score: {p.score} pts
                    </div>
                  </div>

                  {hand.length === 0 ? (
                    <div className="text-emerald-400 text-xs italic">
                      Domino! (All tiles played)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                      {hand.map((tile) => (
                        <DominoTileView
                          key={tile.id}
                          sideA={tile.sideA}
                          sideB={tile.sideB}
                          scale={0.65}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Host Starting Player Selector for Next Round */}
        {isHost && (
          <div className="p-3.5 bg-slate-900/90 border-t border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Crown size={14} /> Who Starts Round {state.roundNumber + 1}?
              </span>
              <span className="text-[10px] text-amber-300/80 font-semibold">Creator Decides</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {state.players.map((p) => {
                const isSelected = selectedStarterId === p.id;
                const isWinner = p.id === state.roundWinnerId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedStarterId(p.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow ring-1 ring-amber-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{p.nickname}</span>
                    {isWinner && <span className="text-[10px] text-emerald-400">(Winner)</span>}
                    {isSelected && <Check size={14} className="text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="text-xs text-slate-400">
            {isHost ? 'You can start the next round' : 'Waiting for host to start next round...'}
          </div>

          {isHost ? (
            <button
              onClick={() => onNextRound(selectedStarterId)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition active:scale-95"
            >
              <Play size={16} /> Start Next Round
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ready for Round {state.roundNumber + 1}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
