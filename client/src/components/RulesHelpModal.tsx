import React from 'react';
import { X, HelpCircle, Compass, Sparkles, Hand, ZoomIn } from 'lucide-react';

interface RulesHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: 'classic' | 'all-fives';
}

export const RulesHelpModal: React.FC<RulesHelpModalProps> = ({
  isOpen,
  onClose,
  gameType,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <HelpCircle size={18} className="text-emerald-400" />
            <span>How to Play & Table Rules</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-slate-300">
          {/* Physical Table Freedom */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-xl flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Compass size={16} /> Physical Domino Table Freedom
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Just like a real physical table, you have complete freedom to arrange your dominoes. You can place any tile on the left, right, or anywhere on the table grid — even if the numbers don't match (e.g. <span className="font-mono text-emerald-300">[6|2] [5|5] [1|4]</span>). Physical placement is decoupled from scoring rules!
            </p>
          </div>

          {/* All Fives Scoring */}
          {gameType === 'all-fives' ? (
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Sparkles size={16} /> All Fives (Muggins) Scoring
              </div>
              <p className="text-[11px] leading-relaxed">
                After you place your domino, the game calculates the sum of all exposed outer ends of the chain:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 pl-1">
                <li>If ends total <span className="font-bold text-white">5</span> → You get <span className="font-bold text-emerald-400">+5 pts</span></li>
                <li>If ends total <span className="font-bold text-white">10</span> → You get <span className="font-bold text-emerald-400">+10 pts</span></li>
                <li>If ends total <span className="font-bold text-white">15</span> → You get <span className="font-bold text-emerald-400">+15 pts</span></li>
              </ul>
              <p className="text-[10px] text-slate-400 mt-1">
                When a player empties their hand ("Domino!"), they also win bonus points equal to the remaining pips in opponents' hands rounded to the nearest 5!
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Sparkles size={16} /> Classic Scoring
              </div>
              <p className="text-[11px] leading-relaxed">
                The first player to play all tiles shouts <span className="font-bold text-emerald-400">"Domino!"</span> and wins the round. The winner is awarded the total sum of pips left in all opponents' hands!
              </p>
            </div>
          )}

          {/* Touch & Navigation Controls */}
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-300">
              <ZoomIn size={16} /> Mobile Board Navigation
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li><span className="font-semibold text-white">Drag to Pan:</span> Swipe anywhere across the felt table to view all tiles.</li>
              <li><span className="font-semibold text-white">Pinch / Wheel Zoom:</span> Pinch with two fingers or scroll mouse wheel to zoom.</li>
              <li><span className="font-semibold text-white">Recenter:</span> Tap the crosshair icon in top right to instantly frame the board.</li>
              <li><span className="font-semibold text-white">Tap to Place:</span> Tap a domino in your hand, then tap "Place Left", "Place Right", or anywhere on table.</li>
              <li><span className="font-semibold text-white">Confirm Turn:</span> Review your move, then tap green "Confirm Turn" to lock it in!</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
