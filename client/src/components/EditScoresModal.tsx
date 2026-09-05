import React, { useState, useEffect } from 'react';
import type { PlayerState } from '../../../shared/types.js';
import { X, Save, Edit3, Plus, Minus } from 'lucide-react';

interface EditScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerState[];
  onSaveScores: (scores: Record<string, number>) => void;
}

export const EditScoresModal: React.FC<EditScoresModalProps> = ({
  isOpen,
  onClose,
  players,
  onSaveScores,
}) => {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      for (const p of players) {
        initial[p.id] = p.score;
      }
      setScores(initial);
    }
  }, [isOpen, players]);

  if (!isOpen) return null;

  const handleScoreChange = (playerId: string, val: number) => {
    setScores((prev) => ({
      ...prev,
      [playerId]: Math.max(0, Math.round(val)),
    }));
  };

  const handleAdjust = (playerId: string, delta: number) => {
    setScores((prev) => ({
      ...prev,
      [playerId]: Math.max(0, (prev[playerId] ?? 0) + delta),
    }));
  };

  const handleSave = () => {
    onSaveScores(scores);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
              <Edit3 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Manager: Edit Player Scores</h2>
              <p className="text-[11px] text-slate-400">Directly adjust points for any player in this game.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Players List */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          {players.map((p) => {
            const currentVal = scores[p.id] ?? p.score;

            return (
              <div
                key={p.id}
                className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs truncate">{p.nickname}</span>
                    {p.isHost && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black uppercase">
                        Host
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">Position {p.seatIndex + 1}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjust(p.id, -5)}
                    className="px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold active:scale-95 transition"
                    title="-5 pts"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjust(p.id, -1)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 active:scale-95 transition"
                    title="-1 pt"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={currentVal}
                    onChange={(e) => handleScoreChange(p.id, Number(e.target.value))}
                    className="w-16 text-center py-1.5 px-1 bg-slate-900 border border-amber-500/50 rounded-xl text-amber-300 font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />

                  <button
                    type="button"
                    onClick={() => handleAdjust(p.id, 1)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 active:scale-95 transition"
                    title="+1 pt"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjust(p.id, 5)}
                    className="px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold active:scale-95 transition"
                    title="+5 pts"
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Save size={15} /> Save Scores
          </button>
        </div>
      </div>
    </div>
  );
};
