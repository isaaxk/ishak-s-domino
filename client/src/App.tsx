import React, { useState, useEffect } from 'react';
import { socket } from './socket.js';
import type {
  GameState,
  DominoTile,
  GameSettings,
  UserClearState,
  PlacementSide,
} from '../../shared/types.js';
import { LandingView } from './components/LandingView.js';
import { LobbyView } from './components/LobbyView.js';
import { StatusBar } from './components/StatusBar.js';
import { DominoBoard } from './components/DominoBoard.js';
import { PlayerHandDock } from './components/PlayerHandDock.js';
import { HostSettingsModal } from './components/HostSettingsModal.js';
import { RoundOverModal } from './components/RoundOverModal.js';
import { GameOverModal } from './components/GameOverModal.js';
import { RulesHelpModal } from './components/RulesHelpModal.js';
import { SelectStarterModal } from './components/SelectStarterModal.js';

// Web Audio synthesizer for crisp, low-latency tactile sound effects
function playSound(type: 'click' | 'place' | 'draw' | 'score' | 'turn') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'place') {
      // Crisp wooden tile snap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'draw') {
      // Gentle slide swoosh
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'score') {
      // Celebratory chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'turn') {
      // Soft ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {}
}

export function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [myHand, setMyHand] = useState<DominoTile[]>([]);

  // Turn interaction state
  const [selectedTile, setSelectedTile] = useState<DominoTile | null>(null);
  const [selectedRotation, setSelectedRotation] = useState<number>(0);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Socket Lifecycle and Listeners
  useEffect(() => {
    // Check saved session in localStorage
    const saved = localStorage.getItem('domino_player_session');
    if (saved) {
      try {
        const { roomId, token, playerId } = JSON.parse(saved);
        if (roomId && token) {
          socket.emit('room:join', { roomId, nickname: '', sessionToken: token }, (res) => {
            if (res.success) {
              setMyPlayerId(res.playerId || playerId);
              setSessionToken(token);
            } else {
              localStorage.removeItem('domino_player_session');
            }
          });
        }
      } catch {}
    }

    socket.on('room:state', (state: GameState) => {
      setGameState((prev) => {
        // Play sound if round started or turn switched to current player
        if (state.phase === 'playing' && prev?.phase !== 'playing') {
          playSound('turn');
        } else if (state.phase === 'playing' && state.currentTurnPlayerId !== prev?.currentTurnPlayerId) {
          if (state.currentTurnPlayerId === myPlayerId) {
            playSound('turn');
          }
        }
        // Play sound if score increased
        if (state.lastMoveSummary && state.lastMoveSummary.pointsAwarded > 0) {
          if (state.lastMoveSummary.playerId === myPlayerId) {
            playSound('score');
          }
        }
        return state;
      });
    });

    socket.on('game:hand_sync', ({ hand }) => {
      setMyHand(hand);
    });

    socket.on('error:notification', ({ message }) => {
      showToast(message, 'error');
    });

    socket.on('player:kicked', ({ reason }) => {
      localStorage.removeItem('domino_player_session');
      setGameState(null);
      setMyPlayerId('');
      setSessionToken(null);
      alert(reason || 'You were kicked from the room by the manager.');
    });

    return () => {
      socket.off('room:state');
      socket.off('game:hand_sync');
      socket.off('error:notification');
      socket.off('player:kicked');
    };
  }, [myPlayerId]);

  // Handle Room Creation
  const handleCreateRoom = (nickname: string, settings: Partial<GameSettings>) => {
    socket.emit('room:create', { nickname, settings }, (res) => {
      if (res.success && res.roomId && res.sessionToken && res.playerId) {
        setMyPlayerId(res.playerId);
        setSessionToken(res.sessionToken);
        localStorage.setItem(
          'domino_player_session',
          JSON.stringify({ roomId: res.roomId, token: res.sessionToken, playerId: res.playerId, nickname })
        );
        showToast(`Room ${res.roomId} created!`, 'success');
      } else {
        showToast(res.error || 'Failed to create room', 'error');
      }
    });
  };

  // Handle Room Join
  const handleJoinRoom = (roomId: string, nickname: string) => {
    socket.emit('room:join', { roomId, nickname }, (res) => {
      if (res.success && res.sessionToken && res.playerId) {
        setMyPlayerId(res.playerId);
        setSessionToken(res.sessionToken);
        localStorage.setItem(
          'domino_player_session',
          JSON.stringify({ roomId, token: res.sessionToken, playerId: res.playerId, nickname })
        );
        showToast(`Joined room ${roomId}!`, 'success');
      } else {
        showToast(res.error || 'Failed to join room', 'error');
      }
    });
  };

  // Resume Session
  const handleResumeSession = () => {
    const saved = localStorage.getItem('domino_player_session');
    if (!saved) return;
    try {
      const { roomId, token, nickname } = JSON.parse(saved);
      handleJoinRoom(roomId, nickname);
    } catch {}
  };

  // Host update settings
  const handleSaveSettings = (updated: Partial<GameSettings>) => {
    socket.emit('room:update_settings', { settings: updated }, (res) => {
      if (res.success) {
        showToast('Room settings updated', 'success');
      } else {
        showToast(res.error || 'Failed to update settings', 'error');
      }
    });
  };

  // Player toggle ready
  const handleToggleReady = (isReady: boolean) => {
    socket.emit('player:ready', { isReady }, (res) => {
      if (!res.success) showToast(res.error || 'Failed to update ready state', 'error');
    });
  };

  // Creator reorders player seating positions around the table
  const handleReorderPlayers = (playerIds: string[]) => {
    socket.emit('room:reorder_players', { playerIds }, (res) => {
      if (!res.success) showToast(res.error || 'Failed to reorder player seats', 'error');
      else playSound('click');
    });
  };

  // Host starts game (manager will decide who starts after entering table)
  const handleStartGame = () => {
    socket.emit('game:start', {}, (res) => {
      if (!res.success) showToast(res.error || 'Failed to start game', 'error');
      else playSound('turn');
    });
  };

  // Host starts next round (manager will decide who starts after round begins)
  const handleNextRound = () => {
    socket.emit('game:next_round', {}, (res) => {
      if (!res.success) showToast(res.error || 'Failed to start next round', 'error');
      else playSound('turn');
    });
  };

  // Manager chooses who starts the round on the table
  const handleSelectStarter = (playerId: string) => {
    socket.emit('game:select_starter', { playerId }, (res) => {
      if (!res.success) {
        showToast(res.error || 'Failed to select starting player', 'error');
      } else {
        playSound('turn');
      }
    });
  };

  // Player volunteers to start the round
  const handleVolunteerStarter = () => {
    socket.emit('game:volunteer_starter', (res) => {
      if (!res.success) {
        showToast(res.error || 'Cannot volunteer to start', 'error');
      } else {
        playSound('turn');
        showToast('Requested to start round!', 'info');
      }
    });
  };

  // Manager agrees or refuses starter request
  const handleRespondStarterRequest = (approved: boolean) => {
    socket.emit('game:respond_starter_request', { approved }, (res) => {
      if (!res.success) {
        showToast(res.error || 'Action failed', 'error');
      } else {
        playSound('turn');
      }
    });
  };

  // Leave room
  const handleLeaveRoom = () => {
    socket.emit('room:leave', () => {
      localStorage.removeItem('domino_player_session');
      setGameState(null);
      setMyPlayerId('');
      setSessionToken(null);
      showToast('You left the room', 'info');
    });
  };

  // Manager kicks player
  const handleKickPlayer = (playerId: string) => {
    socket.emit('room:kick_player', { playerId }, (res) => {
      if (!res.success) {
        showToast(res.error || 'Failed to kick player', 'error');
      } else {
        showToast('Player removed from room', 'info');
      }
    });
  };

  // Manager assigns seat number to player
  const handleAssignSeat = (playerId: string, seatIndex: number) => {
    socket.emit('room:assign_seat', { playerId, seatIndex }, (res) => {
      if (!res.success) {
        showToast(res.error || 'Failed to assign seat', 'error');
      } else {
        playSound('click');
      }
    });
  };

  // Restart game after game over
  const handleRestartGame = () => {
    socket.emit('room:update_settings', { settings: {} }, () => {});
    handleNextRound();
  };

  // Stage Tile Placement
  const handlePlaceTile = (placement: {
    tileId: string;
    x: number;
    y: number;
    rotation: number;
    placementSide?: PlacementSide;
  }) => {
    socket.emit(
      'game:place_tile',
      {
        tileId: placement.tileId,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        placementSide: placement.placementSide,
      },
      (res) => {
        if (res.success) {
          playSound('place');
          setSelectedTile(null); // Clear active selection once staged
        } else {
          showToast(res.error || 'Placement failed', 'error');
        }
      }
    );
  };

  // Rotate pending tile directly on the table
  const handleRotatePendingTile = (tileId: string, newRotation: number) => {
    setSelectedRotation(newRotation);
    playSound('click');
    socket.emit('game:rotate_tile', { tileId, rotation: newRotation }, (res) => {
      if (!res.success) {
        showToast(res.error || 'Failed to rotate tile', 'error');
      }
    });
  };

  // Undo turn
  const handleUndoTurn = () => {
    socket.emit('game:undo_turn', (res) => {
      if (res.success) {
        showToast('Placement undone', 'info');
      } else {
        showToast(res.error || 'Undo failed', 'error');
      }
    });
  };

  // Confirm turn
  const handleConfirmTurn = () => {
    socket.emit('game:confirm_turn', (res) => {
      if (res.success) {
        playSound('place');
        if (res.pointsScored && res.pointsScored > 0) {
          playSound('score');
          showToast(`Turn confirmed! Scored +${res.pointsScored} pts!`, 'success');
        } else {
          showToast('Turn confirmed!', 'success');
        }
      } else {
        showToast(res.error || 'Failed to confirm turn', 'error');
      }
    });
  };

  // Change last confirmed move if no one played after
  const handleChangeLastMove = () => {
    playSound('click');
    socket.emit('game:change_last_move', (res) => {
      if (res.success) {
        showToast('Move unlocked! You can now adjust, rotate, or change your tile.', 'info');
      } else {
        showToast(res.error || 'Cannot change move', 'error');
      }
    });
  };

  // Draw tile
  const handleDrawTile = () => {
    socket.emit('game:draw_tile', (res) => {
      if (res.success) {
        playSound('draw');
        showToast('Tile drawn from boneyard', 'info');
      } else {
        showToast(res.error || 'Cannot draw tile', 'error');
      }
    });
  };

  // Pass turn
  const handlePassTurn = () => {
    socket.emit('game:pass', (res) => {
      if (res.success) {
        showToast('Passed turn', 'info');
      } else {
        showToast(res.error || 'Cannot pass', 'error');
      }
    });
  };

  // Rotate selected tile 90 degrees
  const handleRotateTile = () => {
    setSelectedRotation((prev) => (prev + 90) % 360);
    playSound('click');
  };

  // 2. Derive Current User Clear State (Requirement 19)
  const isHost = gameState?.players.find((p) => p.id === myPlayerId)?.isHost || false;
  const isFreeStarterWaiting = Boolean(
    gameState?.phase === 'playing' &&
    gameState?.settings.startingTileRule === 'free-starter' &&
    gameState?.board.length === 0
  );
  const isMyTurn = (gameState?.currentTurnPlayerId === myPlayerId) || isFreeStarterWaiting;
  const currentTurnPlayer = gameState?.players.find((p) => p.id === gameState.currentTurnPlayerId);

  let currentClearState: UserClearState = 'Waiting for players';
  if (!gameState || gameState.phase === 'waiting_players') {
    currentClearState = 'Waiting for players';
  } else if (gameState.phase === 'waiting_ready') {
    currentClearState = 'Waiting for ready';
  } else if (gameState.phase === 'selecting_starter') {
    currentClearState = isHost ? 'Choose starting player' : 'Waiting for host to choose starter';
  } else if (gameState.phase === 'round_finished') {
    currentClearState = 'Round finished';
  } else if (gameState.phase === 'game_finished') {
    currentClearState = 'Game finished';
  } else if (gameState.phase === 'playing') {
    if (isFreeStarterWaiting) {
      if (gameState.pendingPlacements.length > 0 && gameState.pendingPlacements.some((p) => p.placedBy === myPlayerId)) {
        currentClearState = 'Turn pending confirmation';
      } else if (selectedTile) {
        currentClearState = 'Placement mode';
      } else {
        currentClearState = 'Your turn';
      }
    } else if (gameState.pendingPlacements.length > 0 && isMyTurn) {
      currentClearState = 'Turn pending confirmation';
    } else if (selectedTile) {
      currentClearState = 'Placement mode';
    } else if (isMyTurn) {
      currentClearState = 'Your turn';
    } else {
      currentClearState = "Opponent's turn";
    }
  }

  // Check saved session in localStorage
  let savedSessionData: { roomId: string; nickname: string } | null = null;
  const rawSaved = localStorage.getItem('domino_player_session');
  if (rawSaved) {
    try {
      savedSessionData = JSON.parse(rawSaved);
    } catch {}
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast Overlay */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div
            className={`px-4 py-2 rounded-2xl shadow-2xl text-xs font-bold border backdrop-blur flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-600 text-rose-200'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Screen 1: Landing / Room Creation / Join */}
      {!gameState ? (
        <LandingView
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          savedSession={savedSessionData}
          onResumeSession={handleResumeSession}
        />
      ) : gameState.phase === 'waiting_players' || gameState.phase === 'waiting_ready' ? (
        /* Screen 2: Room Lobby */
        <>
          <StatusBar
            roomId={gameState.roomId}
            roundNumber={gameState.roundNumber}
            players={gameState.players}
            currentTurnPlayerId={gameState.currentTurnPlayerId}
            myPlayerId={myPlayerId}
            isHost={isHost}
            settings={gameState.settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            onLeaveRoom={handleLeaveRoom}
            onKickPlayer={handleKickPlayer}
          />
          <LobbyView
            state={gameState}
            myPlayerId={myPlayerId}
            isHost={isHost}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onReorderPlayers={handleReorderPlayers}
            onAssignSeat={handleAssignSeat}
            onKickPlayer={handleKickPlayer}
            onLeaveRoom={handleLeaveRoom}
          />
        </>
      ) : (
        /* Screen 3: Active Domino Table */
        <>
          <StatusBar
            roomId={gameState.roomId}
            roundNumber={gameState.roundNumber}
            players={gameState.players}
            currentTurnPlayerId={gameState.currentTurnPlayerId}
            myPlayerId={myPlayerId}
            isHost={isHost}
            settings={gameState.settings}
            isFreeStarterWaiting={isFreeStarterWaiting}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            onLeaveRoom={handleLeaveRoom}
            onKickPlayer={handleKickPlayer}
          />

          {/* Interactive 2D Domino Felt Board */}
          <DominoBoard
            board={gameState.board}
            pendingPlacements={gameState.pendingPlacements}
            selectedTile={selectedTile}
            selectedRotation={selectedRotation}
            openEnds={gameState.openEnds}
            isMyTurn={isMyTurn}
            canChangeLastMove={Boolean(gameState.canChangeLastMove && gameState.lastMovePlayerId === myPlayerId)}
            gameType={gameState.settings.gameType}
            onPlaceTile={handlePlaceTile}
            onRotatePendingTile={handleRotatePendingTile}
            onConfirmTurn={handleConfirmTurn}
            onUndoTurn={handleUndoTurn}
            onChangeLastMove={handleChangeLastMove}
          />

          {/* Player Hand Carousel & Action Dock */}
          <PlayerHandDock
            hand={myHand}
            pendingPlacements={gameState.pendingPlacements}
            selectedTile={selectedTile}
            selectedRotation={selectedRotation}
            isMyTurn={isMyTurn}
            canChangeLastMove={Boolean(gameState.canChangeLastMove && gameState.lastMovePlayerId === myPlayerId)}
            isFreeStarterWaiting={isFreeStarterWaiting}
            currentTurnPlayerName={isFreeStarterWaiting ? 'Anyone' : (currentTurnPlayer?.nickname || 'Opponent')}
            boneyardCount={gameState.boneyardCount}
            protectedBoneyardCount={gameState.protectedBoneyardCount}
            allowDrawing={gameState.settings.allowDrawing}
            allowMultipleTilesPerTurn={gameState.settings.allowMultipleTilesPerTurn}
            gameType={gameState.settings.gameType}
            currentOpenEndsSum={gameState.currentOpenEndsSum}
            onSelectTile={(tile) => {
              setSelectedTile(tile);
              if (tile) playSound('click');
            }}
            onRotateTile={handleRotateTile}
            onConfirmTurn={handleConfirmTurn}
            onUndoTurn={handleUndoTurn}
            onChangeLastMove={handleChangeLastMove}
            onDrawTile={handleDrawTile}
            onPassTurn={handlePassTurn}
          />
        </>
      )}

      {/* Host Settings Modal */}
      {gameState && (
        <HostSettingsModal
          settings={gameState.settings}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Manager Decision: Who Starts Round Modal */}
      {gameState && (
        <SelectStarterModal
          state={gameState}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onSelectStarter={handleSelectStarter}
          onVolunteerStarter={handleVolunteerStarter}
          onRespondStarterRequest={handleRespondStarterRequest}
        />
      )}

      {/* Round Finished Modal */}
      {gameState && (
        <RoundOverModal
          state={gameState}
          isHost={isHost}
          onNextRound={handleNextRound}
        />
      )}

      {/* Game Over Modal */}
      {gameState && (
        <GameOverModal
          state={gameState}
          isHost={isHost}
          onRestart={handleRestartGame}
        />
      )}

      {/* Rules & Help Modal */}
      <RulesHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        gameType={gameState?.settings.gameType || 'all-fives'}
      />
    </div>
  );
}

export default App;
