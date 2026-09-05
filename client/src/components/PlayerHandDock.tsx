import React from 'react';
import type { DominoTile, PlacedTile } from '../../../shared/types.js';
import { DominoTileView } from './DominoTileView.js';
import { RotateCw, Check, Undo2, Plus, SkipForward, Edit3 } from 'lucide-react';

interface PlayerHandDockProps {
  hand: DominoTile[];
  pendingPlacements: PlacedTile[];
  selectedTile: DominoTile | null;
  selectedRotation: number;
  isMyTurn: boolean;
  canChangeLastMove?: boolean;
  canUndoPass?: boolean;
  isFreeStarterWaiting?: boolean;
  currentTurnPlayerName: string;
  boneyardCount: number;
  protectedBoneyardCount: number;
  allowDrawing: boolean;
  allowMultipleTilesPerTurn: boolean;
  gameType: 'classic' | 'all-fives';
  currentOpenEndsSum?: number;
  onSelectTile: (tile: DominoTile | null) => void;
  onRotateTile: () => void;
  onConfirmTurn: () => void;
  onUndoTurn: () => void;
  onChangeLastMove?: () => void;
  onUndoPass?: () => void;
  onDrawTile: () => void;
  onPassTurn: () => void;
}

export const PlayerHandDock: React.FC<PlayerHandDockProps> = ({
  hand,
  pendingPlacements,
  selectedTile,
  selectedRotation,
  isMyTurn,
  canChangeLastMove = false,
  canUndoPass = false,
  isFreeStarterWaiting = false,
  currentTurnPlayerName,
  boneyardCount,
  protectedBoneyardCount,
  allowDrawing,
  allowMultipleTilesPerTurn,
  gameType,
  currentOpenEndsSum = 0,
  onSelectTile,
  onRotateTile,
  onConfirmTurn,
  onUndoTurn,
  onChangeLastMove,
  onUndoPass,
  onDrawTile,
  onPassTurn,
}) => {
  const effectiveProtectedCount = protectedBoneyardCount ?? 0;
  const canDraw = allowDrawing && boneyardCount > effectiveProtectedCount && pendingPlacements.length === 0 && !isFreeStarterWaiting;
  const hasPending = pendingPlacements.length > 0;
  const potentialScore = gameType === 'all-fives' && currentOpenEndsSum > 0 && currentOpenEndsSum % 5 === 0
    ? currentOpenEndsSum
    : 0;

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 shadow-2xl flex flex-col z-20 pb-safe">
      {/* 1. Turn Status Banner */}
      <div
        className={`w-full py-1.5 px-4 flex items-center justify-between transition-colors duration-200 ${
          isFreeStarterWaiting
            ? 'bg-amber-700/90 text-white font-bold'
            : isMyTurn
            ? 'bg-emerald-700 text-white font-bold'
            : 'bg-slate-800 text-slate-300 font-medium'
        }`}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isFreeStarterWaiting ? 'bg-amber-300 animate-ping' : isMyTurn ? 'bg-emerald-300 animate-ping' : 'bg-amber-400'
            }`}
          />
          {isFreeStarterWaiting ? (
            <span className="font-black text-amber-100">
              🀱 FREE STARTER — {hasPending ? 'Confirm your opening domino!' : 'Select & place a domino to open the round!'}
            </span>
          ) : isMyTurn ? (
            <span>YOUR TURN {hasPending ? '— Confirm your placement' : '— Select a domino to place'}</span>
          ) : (
            <span>{currentTurnPlayerName}&apos;s turn...</span>
          )}
        </div>

        {gameType === 'all-fives' && (
          <div className="text-xs font-semibold px-2 py-0.5 rounded bg-black/30">
            Ends: <span className="font-bold">{currentOpenEndsSum}</span>
            {potentialScore > 0 && (
              <span className="text-emerald-300 font-extrabold ml-1 animate-pulse">
                (+{potentialScore} pts!)
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Hand Carousel & Selected Actions Toolbar */}
      <div className="p-3 flex flex-col gap-2">
        {/* If a tile is selected, show floating controls for rotation */}
        {selectedTile && isMyTurn && (
          <div className="flex items-center justify-between bg-slate-800/90 rounded-lg p-2 border border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-medium">Selected:</span>
              <span className="text-xs font-bold text-emerald-400">
                [{selectedTile.sideA}|{selectedTile.sideB}]
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onRotateTile}
                className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-bold rounded-md shadow border border-slate-500 transition"
              >
                <RotateCw size={14} /> Rotate ({selectedRotation}°)
              </button>
              <button
                onClick={() => onSelectTile(null)}
                className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* Tiles in Player's Hand */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-2 min-h-[66px]">
          {hand.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-3 text-center w-full">
              No tiles in hand.
            </div>
          ) : (
            hand.map((tile) => {
              const isSelected = selectedTile?.id === tile.id;
              return (
                <div
                  key={tile.id}
                  draggable={isMyTurn}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', tile.id);
                    onSelectTile(tile);
                  }}
                  className="flex-shrink-0 transition-transform cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
                >
                  <DominoTileView
                    sideA={tile.sideA}
                    sideB={tile.sideB}
                    rotation={0}
                    scale={0.92}
                    isSelected={isSelected}
                    onClick={() => {
                      if (!isMyTurn) return;
                      onSelectTile(isSelected ? null : tile);
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* 3. Bottom Action Buttons Bar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Draw Button */}
          {allowDrawing && (
            <button
              onClick={onDrawTile}
              disabled={!isMyTurn || !canDraw}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold shadow transition active:scale-95 ${
                isMyTurn && canDraw
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Plus size={15} />
              Draw ({boneyardCount})
            </button>
          )}

          {/* Pass Button */}
          <button
            onClick={onPassTurn}
            disabled={!isMyTurn || hasPending || isFreeStarterWaiting}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold shadow transition active:scale-95 ${
              isMyTurn && !hasPending && !isFreeStarterWaiting
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <SkipForward size={14} /> Pass
          </button>

          {/* Right Action: Change Move / Undo Pass / Undo / Confirm Turn */}
          <div className="flex items-center gap-2">
            {canChangeLastMove && !hasPending && (
              <button
                onClick={onChangeLastMove}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg border-2 border-amber-300 animate-pulse active:scale-95 transition"
                title="Change your move before someone plays"
              >
                <Edit3 size={15} /> Change Move
              </button>
            )}

            {canUndoPass && !hasPending && (
              <button
                onClick={onUndoPass}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg border-2 border-indigo-300 animate-pulse active:scale-95 transition"
                title="Undo your pass before someone plays"
              >
                <Undo2 size={15} /> Undo Pass
              </button>
            )}

            {hasPending && (
              <button
                onClick={onUndoTurn}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-800 hover:bg-rose-700 text-rose-100 text-xs font-bold shadow active:scale-95 transition"
              >
                <Undo2 size={15} /> Undo
              </button>
            )}

            <button
              onClick={onConfirmTurn}
              disabled={!isMyTurn || !hasPending}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-lg transition active:scale-95 ${
                isMyTurn && hasPending
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Check size={16} /> Confirm Turn
              {potentialScore > 0 && ` (+${potentialScore})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
