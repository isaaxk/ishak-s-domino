import React, { useEffect } from 'react';
import type { GameState } from '../../../shared/types.js';
import confetti from 'canvas-confetti';
import { Trophy, Medal, RotateCcw } from 'lucide-react';

interface GameOverModalProps {
  state: GameState;
  isHost: boolean;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  state,
  isHost,
  onRestart,
}) => {
  if (state.phase !== 'game_finished') return null;

  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
  const champion = sortedPlayers[0];

  useEffect(() => {
    // Fire celebratory confetti on game over
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-center">
        {/* Header Podium Banner */}
        <div className="p-6 bg-gradient-to-b from-amber-600/30 via-slate-900 to-slate-900 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-glow border border-amber-400/40 animate-bounce">
            <Trophy size={32} />
          </div>

          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            Game Complete
          </span>

          <h1 className="text-2xl font-black text-white">
            🏆 {champion?.nickname} Wins!
          </h1>

          <p className="text-xs text-slate-300">
            Reached the target score with {champion?.score} points across {state.roundNumber} rounds!
          </p>
        </div>

        {/* Final Standings Table */}
        <div className="p-5 flex flex-col gap-2.5">
          <div className="text-xs font-bold text-slate-400 text-left">Final Standings</div>
          <div className="flex flex-col gap-2">
            {sortedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-2xl border ${
                  idx === 0
                    ? 'bg-amber-950/30 border-amber-600/60 font-bold'
                    : 'bg-slate-800/60 border-slate-750'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      idx === 0
                        ? 'bg-amber-400 text-black'
                        : idx === 1
                        ? 'bg-slate-300 text-black'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-white">{p.nickname}</span>
                </div>

                <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-400">
                  <span>{p.score}</span>
                  <span className="text-xs text-slate-400">pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Action */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex justify-center">
          {isHost ? (
            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-glow transition active:scale-95"
            >
              <RotateCcw size={18} /> Play Again
            </button>
          ) : (
            <span className="text-xs text-slate-400">Waiting for host to start a new game...</span>
          )}
        </div>
      </div>
    </div>
  );
};
