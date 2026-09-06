import React, { useState, useEffect } from 'react';
import type { GameState, DominoTile } from '../../../shared/types.js';
import { DominoTileView } from './DominoTileView.js';
import { Trophy, Play, Eye, Lock, Flag, Edit3, Plus, Minus, Save, Check } from 'lucide-react';

interface RoundOverModalProps {
  state: GameState;
  isHost: boolean;
  onNextRound: () => void;
  onFinishGame?: () => void;
  onUpdateScores?: (scores: Record<string, number>) => void;
}

export const RoundOverModal: React.FC<RoundOverModalProps> = ({
  state,
  isHost,
  onNextRound,
  onFinishGame,
  onUpdateScores,
}) => {
  if (state.phase !== 'round_finished') return null;

  const winner = state.players.find((p) => p.id === state.roundWinnerId);
  const revealedHands = state.revealedHands || {};

  // Manager score editing state
  const [editableScores, setEditableScores] = useState<Record<string, number>>({});
  const [isEditingScores, setIsEditingScores] = useState<boolean>(Boolean(state.isBlocked && isHost));
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const p of state.players) {
      initial[p.id] = p.score;
    }
    setEditableScores(initial);
    if (state.isBlocked && isHost) {
      setIsEditingScores(true);
    }
  }, [state.players, state.isBlocked, isHost]);

  const handleScoreChange = (playerId: string, val: number) => {
    setEditableScores((prev) => ({
      ...prev,
      [playerId]: Math.max(0, Math.round(val)),
    }));
  };

  const handleAdjust = (playerId: string, delta: number) => {
    setEditableScores((prev) => ({
      ...prev,
      [playerId]: Math.max(0, (prev[playerId] ?? 0) + delta),
    }));
  };

  const handleSaveScores = () => {
    onUpdateScores?.(editableScores);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleProceedNextRound = () => {
    if (isEditingScores) {
      onUpdateScores?.(editableScores);
    }
    onNextRound();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header Banner */}
        <div
          className={`p-5 text-center flex flex-col items-center gap-2 border-b border-slate-800 ${
            state.isBlocked
              ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70'
              : 'bg-gradient-to-r from-emerald-900/60 to-slate-900'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border ${
              state.isBlocked
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {state.isBlocked ? <Lock size={24} /> : <Trophy size={24} />}
          </div>

          <h2 className="text-xl font-black text-white">
            {state.blockedReason?.includes('Manager')
              ? `Round ${state.roundNumber} Ended by Manager`
              : state.isBlocked
              ? `Round ${state.roundNumber} Blocked!`
              : winner
              ? `${winner.nickname} Won Round ${state.roundNumber}!`
              : `Round ${state.roundNumber} Ended`}
          </h2>

          {state.isBlocked ? (
            <p className="text-xs text-amber-300 font-bold max-w-md px-2">
              {state.blockedReason || 'Round ended! No further moves are possible.'}
            </p>
          ) : (
            <p className="text-xs text-emerald-400 font-semibold">
              {state.roundPointsWon ? `+${state.roundPointsWon} bonus points awarded!` : 'Round ended'}
            </p>
          )}
        </div>

        {/* Revealed Hands & Points Section */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between font-bold text-slate-300">
            <div className="flex items-center gap-1.5">
              <Eye size={15} className="text-emerald-400" />
              <span>Revealed Hands & Dots (Pips)</span>
            </div>

            {/* Manager quick toggle to edit scores */}
            {isHost && (
              <button
                type="button"
                onClick={() => setIsEditingScores((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 transition"
              >
                <Edit3 size={12} />
                {isEditingScores ? 'Hide Score Editor' : 'Edit Scores'}
              </button>
            )}
          </div>

          {/* Blocked / Ended Game Notice */}
          {state.isBlocked && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 flex items-center justify-between gap-2">
              <span className="font-semibold text-[11px]">
                {state.blockedReason?.includes('Manager')
                  ? 'Round ended by manager ("la partie")! Each player’s remaining dots are revealed below. You can edit each player’s points directly.'
                  : 'Game blocked across all ends! Remaining dominoes and exact dots are revealed for all players. Manager can edit each player’s points directly below.'}
              </span>
            </div>
          )}

          {/* Players Hand Breakdowns */}
          <div className="flex flex-col gap-3">
            {state.players.map((p) => {
              const hand = revealedHands[p.id] || [];
              const isWinner = p.id === state.roundWinnerId;
              const totalHandPips = hand.reduce((sum, t) => sum + (t.sideA + t.sideB), 0);
              const currentScore = editableScores[p.id] ?? p.score;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex flex-col gap-2.5 transition ${
                    isWinner
                      ? 'bg-emerald-950/40 border-emerald-600/60 shadow-lg'
                      : 'bg-slate-800/60 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span className="text-sm">{p.nickname}</span>
                      {p.isHost && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase font-black">
                          Host
                        </span>
                      )}
                      {isWinner && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 uppercase font-bold flex items-center gap-1">
                          <Trophy size={11} /> {state.isBlocked ? 'Fewest Pips Winner' : 'Winner'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {/* Hand count & pips description */}
                      <span className="text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700">
                        {hand.length === 0 ? (
                          <span className="text-emerald-400 font-bold">0 dominoes (0 dots)</span>
                        ) : (
                          <span>
                            {hand.length} dominoes • <strong className="text-amber-300">{totalHandPips} dots</strong>
                          </span>
                        )}
                      </span>

                      {/* Total match score */}
                      <span className="text-amber-300 font-mono font-bold text-sm">
                        {p.score} pts
                      </span>
                    </div>
                  </div>

                  {/* Manager In-Place Score Editor */}
                  {isHost && isEditingScores && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-amber-500/40 animate-fadeIn">
                      <span className="text-[11px] font-bold text-amber-300">
                        Adjust {p.nickname}&apos;s Score:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjust(p.id, -5)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold active:scale-95"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjust(p.id, -1)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={currentScore}
                          onChange={(e) => handleScoreChange(p.id, Number(e.target.value))}
                          className="w-14 text-center py-0.5 bg-slate-950 border border-amber-500/60 rounded-lg text-amber-300 font-mono font-black text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjust(p.id, 1)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjust(p.id, 5)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold active:scale-95"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Revealed Tiles in Hand */}
                  {hand.length === 0 ? (
                    <div className="text-emerald-400 text-xs italic">
                      Domino! Hand cleared completely.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {hand.map((tile) => (
                        <DominoTileView
                          key={tile.id}
                          sideA={tile.sideA}
                          sideB={tile.sideB}
                          scale={0.75}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manager save scores confirmation notification */}
          {isHost && isEditingScores && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveScores}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow active:scale-95 transition"
              >
                {savedSuccess ? <Check size={14} className="text-emerald-300" /> : <Save size={14} />}
                {savedSuccess ? 'Scores Saved!' : 'Save Scores'}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70 gap-2">
          {/* Manager Finish Match Button */}
          {isHost ? (
            <button
              onClick={onFinishGame}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-800 hover:bg-rose-700 text-rose-100 font-bold text-xs shadow transition active:scale-95 border border-rose-600/60"
              title="Finish match now and crown the winner"
            >
              <Flag size={14} /> Finish Match
            </button>
          ) : (
            <div className="text-xs text-slate-400">
              Waiting for host...
            </div>
          )}

          {isHost ? (
            <button
              onClick={handleProceedNextRound}
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
