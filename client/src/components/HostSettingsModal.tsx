import React, { useState } from 'react';
import type { GameSettings, DominoSetType, GameType, StartingTileRule, EndGameCondition } from '../../../shared/types.js';
import { X, Save, AlertTriangle } from 'lucide-react';

interface HostSettingsModalProps {
  settings: GameSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<GameSettings>) => void;
}

export const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<GameSettings>({ ...settings });

  React.useEffect(() => {
    if (isOpen) {
      setForm({ ...settings });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // Max tiles available in set
  const getMaxTiles = (set: DominoSetType) => {
    switch (set) {
      case 'double-6': return 28;
      case 'double-7': return 36;
      case 'double-8': return 45;
      case 'double-9': return 55;
    }
  };

  const totalTilesInSet = getMaxTiles(form.dominoSet);
  const requiredTiles = form.maxPlayers * form.tilesPerPlayer;
  const isCompatible = requiredTiles <= totalTilesInSet;

  const handleSelectSet = (st: DominoSetType) => {
    const setTiles = getMaxTiles(st);
    const maxAllowed = Math.floor(setTiles / form.maxPlayers);
    const newTiles = form.tilesPerPlayer > maxAllowed ? Math.max(1, maxAllowed) : form.tilesPerPlayer;
    setForm((prev) => ({ ...prev, dominoSet: st, tilesPerPlayer: newTiles }));
  };

  const handleChangeMaxPlayers = (players: number) => {
    const setTiles = getMaxTiles(form.dominoSet);
    const maxAllowed = Math.floor(setTiles / players);
    const newTiles = form.tilesPerPlayer > maxAllowed ? Math.max(1, maxAllowed) : form.tilesPerPlayer;
    setForm((prev) => ({ ...prev, maxPlayers: players, tilesPerPlayer: newTiles }));
  };

  const handleSave = () => {
    if (!isCompatible) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Host Game Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Scrollable Area */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Compatibility Warning */}
          {!isCompatible && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertTriangle size={20} className="flex-shrink-0 text-rose-400" />
              <span>
                Too many tiles requested ({requiredTiles}) for selected {form.dominoSet} set ({totalTilesInSet} total). Reduce players or tiles per player.
              </span>
            </div>
          )}

          {/* 1. Domino Set */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-300">Domino Set Size</label>
            <div className="grid grid-cols-2 gap-2">
              {(['double-6', 'double-7', 'double-8', 'double-9'] as DominoSetType[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleSelectSet(st)}
                  className={`py-2 px-3 rounded-xl font-medium border text-center transition capitalize ${
                    form.dominoSet === st
                      ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {st} ({getMaxTiles(st)} tiles)
                </button>
              ))}
            </div>
          </div>

          {/* 2. Game Type */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-300">Game Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['all-fives', 'classic'] as GameType[]).map((gt) => (
                <button
                  key={gt}
                  type="button"
                  onClick={() => setForm({ ...form, gameType: gt })}
                  className={`py-2 px-3 rounded-xl font-medium border text-center transition capitalize ${
                    form.gameType === gt
                      ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {gt === 'all-fives' ? 'All Fives (Muggins)' : 'Classic Block/Draw'}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Number of Players & Tiles Per Player */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Max Players</label>
              <select
                value={form.maxPlayers}
                onChange={(e) => handleChangeMaxPlayers(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium focus:ring-2 focus:ring-emerald-500"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} Players
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Tiles Per Player</label>
              <select
                value={form.tilesPerPlayer}
                onChange={(e) => setForm({ ...form, tilesPerPlayer: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium focus:ring-2 focus:ring-emerald-500"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 12].map((n) => {
                  const isOver = n * form.maxPlayers > totalTilesInSet;
                  const boneyardRemaining = totalTilesInSet - n * form.maxPlayers;
                  return (
                    <option key={n} value={n} disabled={isOver}>
                      {n} Tiles {isOver ? '(Too many for set)' : `(${boneyardRemaining} in boneyard)`}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 4. Physical Freedom: Allow Free Placement (Crucial Requirement 23) */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex flex-col pr-2">
              <span className="font-bold text-white text-xs">Allow Free Placement</span>
              <span className="text-[11px] text-slate-400">
                Simulate physical table: place tiles freely (e.g. [6|2][5|5][1|4]) without rigid match enforcement.
              </span>
            </div>
            <input
              type="checkbox"
              checked={form.allowFreePlacement}
              onChange={(e) => setForm({ ...form, allowFreePlacement: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* 5. Allow Multiple Tiles Per Turn */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex flex-col pr-2">
              <span className="font-bold text-white text-xs">Multiple Tiles Per Turn</span>
              <span className="text-[11px] text-slate-400">
                Allow placing multiple dominoes before hitting Confirm Turn.
              </span>
            </div>
            <input
              type="checkbox"
              checked={form.allowMultipleTilesPerTurn}
              onChange={(e) => setForm({ ...form, allowMultipleTilesPerTurn: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* 6. Starting Tile Rule & Specific Tile */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-300">Starting Tile Rule</label>
            <select
              value={form.startingTileRule}
              onChange={(e) => setForm({ ...form, startingTileRule: e.target.value as StartingTileRule })}
              className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="free-starter">Free Starter (Real Life - Anyone can start) (Default)</option>
              <option value="host-selects">Creator Chooses Starting Player</option>
              <option value="highest-double">Highest Double Held</option>
              <option value="specific-tile">Specific Tile (e.g. 0-0)</option>
              <option value="random">Random Player</option>
              <option value="previous-winner">Previous Round Winner</option>
            </select>
          </div>

          {form.startingTileRule === 'specific-tile' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Designated Starting Tile</label>
              <select
                value={form.specificStartingTile}
                onChange={(e) => setForm({ ...form, specificStartingTile: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
              >
                <option value="tile-0-0">0-0 (Double Blank)</option>
                <option value="tile-6-6">6-6 (Double Six)</option>
                <option value="tile-1-1">1-1 (Double One)</option>
                <option value="tile-5-5">5-5 (Double Five)</option>
              </select>
              <span className="text-[10px] text-slate-400">
                Guaranteed to NOT be in the boneyard; assigned directly to starting player.
              </span>
            </div>
          )}

          {/* 7. Drawing & Protected Boneyard Tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Allow Drawing</label>
              <select
                value={form.allowDrawing ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, allowDrawing: e.target.value === 'true' })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
              >
                <option value="true">Yes (Draw Game)</option>
                <option value="false">No (Block Game)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Protected Boneyard</label>
              <select
                value={form.protectedBoneyardTiles ?? 0}
                onChange={(e) => setForm({ ...form, protectedBoneyardTiles: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
              >
                <option value={0}>0 Tiles (Draw All until Empty - Default)</option>
                <option value={1}>1 Tile</option>
                <option value={2}>2 Tiles</option>
              </select>
            </div>
          </div>

          {/* Guaranteed Tile In Hands (Not in Draw Pile) */}
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex flex-col">
              <span className="font-semibold text-slate-200">Guaranteed Tile in Hands (Not in Draw Pile)</span>
              <span className="text-xs text-slate-400">
                Ensure a specific tile is dealt to a player at random rather than left in the boneyard draw pile.
              </span>
            </div>
            <select
              value={form.protectedTiles?.[0] || 'none'}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, protectedTiles: val === 'none' ? [] : [val] });
              }}
              className="mt-1 bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-medium"
            >
              <option value="none">None (100% Random Deal - Default)</option>
              <option value="tile-0-0">Double 0 [0|0]</option>
              <option value="tile-6-6">Double 6 [6|6]</option>
              <option value="tile-5-5">Double 5 [5|5]</option>
              <option value="tile-4-4">Double 4 [4|4]</option>
              <option value="tile-3-3">Double 3 [3|3]</option>
              <option value="tile-2-2">Double 2 [2|2]</option>
              <option value="tile-1-1">Double 1 [1|1]</option>
            </select>
          </div>

          {/* 8. Target Score / Win Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">Target Score</label>
              <select
                value={form.targetScore}
                onChange={(e) => setForm({ ...form, targetScore: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
              >
                <option value={50}>50 Points</option>
                <option value={100}>100 Points</option>
                <option value={150}>150 Points</option>
                <option value={200}>200 Points</option>
                <option value={250}>250 Points</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-300">End Condition</label>
              <select
                value={form.endGameCondition}
                onChange={(e) => setForm({ ...form, endGameCondition: e.target.value as EndGameCondition })}
                className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-medium"
              >
                <option value="target-score">First to Target Score</option>
                <option value="rounds-limit">Fixed Rounds Limit</option>
              </select>
            </div>
          </div>

          {/* 9. Tile Count Visibility */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex flex-col pr-2">
              <span className="font-semibold text-slate-200 text-sm">Show Player Tile Counts</span>
              <span className="text-xs text-slate-400">Display remaining domino counts for all players (Default: ON)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={form.showTileCounts ?? true}
                onChange={(e) => setForm({ ...form, showTileCounts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
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
            disabled={!isCompatible}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Save size={15} /> Save Rules
          </button>
        </div>
      </div>
    </div>
  );
};
