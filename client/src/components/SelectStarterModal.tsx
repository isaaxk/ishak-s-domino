import React, { useState } from 'react';
import type { GameState } from '../../../shared/types.js';
import { Crown, Check, X, Play, Compass, Hand } from 'lucide-react';

interface SelectStarterModalProps {
  state: GameState;
  myPlayerId: string;
  isHost: boolean;
  onSelectStarter: (playerId: string) => void;
  onVolunteerStarter: () => void;
  onRespondStarterRequest: (approved: boolean) => void;
}

export const SelectStarterModal: React.FC<SelectStarterModalProps> = ({
  state,
  myPlayerId,
  isHost,
  onSelectStarter,
  onVolunteerStarter,
  onRespondStarterRequest,
}) => {
  if (state.phase !== 'selecting_starter') return null;

  const [chosenPlayerId, setChosenPlayerId] = useState<string>(
    state.roundWinnerId || myPlayerId || state.players[0]?.id || ''
  );

  const manager = state.players.find((p) => p.isHost);
  const isMyRequest = state.starterRequest?.playerId === myPlayerId;

  const getSeatName = (seatIndex: number, total: number) => {
    return `Position ${seatIndex + 1}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {isHost ? (
        /* Manager Decision Dialog */
        <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-center max-h-[90vh] overflow-y-auto">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-lg flex-shrink-0">
            <Crown size={28} />
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-widest text-amber-400 font-black flex items-center justify-center gap-1.5">
              <Crown size={14} /> Manager Control • Round {state.roundNumber}
            </span>
            <h2 className="text-xl font-black text-white mt-1">
              Who Starts Round {state.roundNumber}?
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Any player can volunteer to start. As Manager, you can agree or refuse!
            </p>
          </div>

          {/* Incoming Player Start Request: Manager Agrees or Refuses */}
          {state.starterRequest && (
            <div className="bg-amber-950/90 border-2 border-amber-400 rounded-2xl p-4 shadow-xl flex flex-col gap-3 text-left animate-pulse">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Hand size={20} className="text-amber-400 flex-shrink-0 animate-bounce" />
                <span>
                  <strong className="text-white text-base underline decoration-amber-400">
                    {state.starterRequest.playerNickname}
                  </strong>{' '}
                  wants to start &amp; put the 1st domino!
                </span>
              </div>
              <p className="text-xs text-slate-200">
                Do you agree to let {state.starterRequest.playerNickname} place the first domino?
              </p>
              <div className="flex items-center gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={() => onRespondStarterRequest(true)}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 font-black text-xs text-white shadow-glow flex items-center justify-center gap-1.5 transition"
                >
                  <Check size={16} /> Agree (Let Start)
                </button>
                <button
                  type="button"
                  onClick={() => onRespondStarterRequest(false)}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 font-black text-xs text-white shadow-lg flex items-center justify-center gap-1.5 transition"
                >
                  <X size={16} /> Refuse
                </button>
              </div>
            </div>
          )}

          {/* Volunteer Myself as Manager */}
          {!state.starterRequest && (
            <button
              type="button"
              onClick={() => onSelectStarter(myPlayerId)}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs shadow-glow transition flex items-center justify-center gap-2"
            >
              <Hand size={16} /> I Want to Start Myself
            </button>
          )}

          {/* Or Directly Select Any Player from Grid */}
          <div className="flex flex-col gap-2 text-left border-t border-slate-800 pt-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Or Directly Choose Starter:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {state.players.map((p) => {
                const isSelected = chosenPlayerId === p.id;
                const isWinner = p.id === state.roundWinnerId;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChosenPlayerId(p.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow ring-1 ring-amber-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 flex-shrink-0">
                      {p.nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate flex-1">
                      <div className="flex items-center gap-1 truncate">
                        <span className="text-xs font-bold truncate">
                          {p.nickname} {p.id === myPlayerId && '(You)'}
                        </span>
                        {isWinner && (
                          <span className="text-[8px] px-1 bg-emerald-700 text-emerald-100 rounded font-bold uppercase">
                            Win
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-300/80 font-medium">
                        Pos {p.seatIndex + 1}
                      </span>
                    </div>
                    {isSelected && <Check size={16} className="text-amber-400 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onSelectStarter(chosenPlayerId)}
              className="w-full py-3 mt-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Play size={15} /> Confirm Selected Player Directly
            </button>
          </div>
        </div>
      ) : (
        /* Non-Manager Player View: Ability to Volunteer to Start */
        <div className="w-full max-w-sm bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Hand size={28} />
          </div>

          <div>
            <h3 className="text-lg font-black text-white">
              Round {state.roundNumber} Starting
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Do you want to put the first domino on the table?
            </p>
          </div>

          {state.starterRequest ? (
            /* A request is currently pending */
            <div className="w-full p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 flex flex-col items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              {isMyRequest ? (
                <>
                  <h4 className="text-sm font-bold text-amber-300">
                    You volunteered to start!
                  </h4>
                  <p className="text-xs text-slate-300">
                    Waiting for the Manager (<span className="text-amber-400 font-semibold">{manager?.nickname || 'Host'}</span>) to agree or refuse your request...
                  </p>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-bold text-white">
                    {state.starterRequest.playerNickname} volunteered to start
                  </h4>
                  <p className="text-xs text-slate-400">
                    Waiting for Manager approval...
                  </p>
                </>
              )}
            </div>
          ) : (
            /* No request yet: player can volunteer! */
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onVolunteerStarter}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm shadow-glow transition flex items-center justify-center gap-2"
              >
                <Hand size={18} /> ✋ I Want to Start &amp; Put 1st Domino!
              </button>
              <p className="text-[11px] text-slate-400">
                Clicking will ask Manager ({manager?.nickname || 'Host'}) to let you play first.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold pt-2 border-t border-slate-800 w-full justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tiles dealt to your dock</span>
          </div>
        </div>
      )}
    </div>
  );
};
