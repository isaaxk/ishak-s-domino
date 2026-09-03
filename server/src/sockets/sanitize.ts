import { GameState, DominoTile, PlayerState } from '../shared/types.js';

/**
 * Sanitizes the complete authoritative game state for a specific recipient socket/player.
 * - Injects only the recipient's private hand into their player object.
 * - Strips hand arrays from all other players (leaving only tileCount).
 * - Masks revealedHands unless the round or game is finished.
 * - Ensures hidden boneyard tile contents are NEVER transmitted.
 */
export function sanitizeStateForPlayer(
  authoritativeState: GameState,
  recipientPlayerId: string,
  privateHands: Record<string, DominoTile[]>
): GameState {
  const isFinished = authoritativeState.phase === 'round_finished' || authoritativeState.phase === 'game_finished';

  const sanitizedPlayers: PlayerState[] = authoritativeState.players.map((p) => {
    if (p.id === recipientPlayerId) {
      // Recipient gets their own private hand
      return {
        ...p,
        hand: [...(privateHands[p.id] || [])],
        tileCount: (privateHands[p.id] || []).length,
      };
    } else {
      // Other players: hand is completely omitted from the payload
      const { hand, ...otherPlayerData } = p;
      return {
        ...otherPlayerData,
        tileCount: (privateHands[p.id] || []).length,
      };
    }
  });

  return {
    ...authoritativeState,
    players: sanitizedPlayers,
    // revealedHands only revealed to all clients when the round/game is complete
    revealedHands: isFinished ? authoritativeState.revealedHands : undefined,
  };
}
