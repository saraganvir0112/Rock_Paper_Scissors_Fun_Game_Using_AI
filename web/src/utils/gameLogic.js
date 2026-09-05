/**
 * Rock Paper Scissors Game Logic & AI Opponent
 */

export const MOVES = {
  ROCK: 'ROCK',
  PAPER: 'PAPER',
  SCISSORS: 'SCISSORS',
};

export const MOVE_METADATA = {
  [MOVES.ROCK]: { label: 'Rock', emoji: '✊' },
  [MOVES.PAPER]: { label: 'Paper', emoji: '✋' },
  [MOVES.SCISSORS]: { label: 'Scissors', emoji: '✌️' },
};

export const WINNERS = {
  PLAYER: 'PLAYER',
  COMPUTER: 'COMPUTER',
  DRAW: 'DRAW',
};

export const VALID_MOVES = [MOVES.ROCK, MOVES.PAPER, MOVES.SCISSORS];

/**
 * Generates a random move for the computer opponent.
 */
export function getComputerMove(randomFn = Math.random) {
  const index = Math.floor(randomFn() * VALID_MOVES.length);
  return VALID_MOVES[index];
}

/**
 * Determines the winner of an RPS match based on standard rules:
 * - Rock beats Scissors
 * - Scissors beats Paper
 * - Paper beats Rock
 * - Same move results in a Draw
 */
export function determineWinner(playerMove, computerMove) {
  if (!VALID_MOVES.includes(playerMove) || !VALID_MOVES.includes(computerMove)) {
    throw new Error(`Invalid moves provided: player=${playerMove}, computer=${computerMove}`);
  }

  if (playerMove === computerMove) {
    return WINNERS.DRAW;
  }

  if (
    (playerMove === MOVES.ROCK && computerMove === MOVES.SCISSORS) ||
    (playerMove === MOVES.SCISSORS && computerMove === MOVES.PAPER) ||
    (playerMove === MOVES.PAPER && computerMove === MOVES.ROCK)
  ) {
    return WINNERS.PLAYER;
  }

  return WINNERS.COMPUTER;
}

/**
 * Returns a user-friendly result message based on the winner.
 */
export function getWinnerMessage(winner) {
  switch (winner) {
    case WINNERS.PLAYER:
      return 'You Win!';
    case WINNERS.COMPUTER:
      return 'Computer Wins!';
    case WINNERS.DRAW:
      return "It's a Draw!";
    default:
      return '';
  }
}

/**
 * Computes new scores given current scores and the round winner.
 */
export function updateScores(currentScores, winner) {
  const scores = { ...currentScores };
  if (winner === WINNERS.PLAYER) {
    scores.player += 1;
  } else if (winner === WINNERS.COMPUTER) {
    scores.computer += 1;
  } else if (winner === WINNERS.DRAW) {
    scores.draws += 1;
  }
  return scores;
}

/**
 * Executes a round with the given player move and optional computer move.
 */
export function evaluateRound(playerMove, computerMove = null) {
  const compMove = computerMove || getComputerMove();
  const winner = determineWinner(playerMove, compMove);
  const message = getWinnerMessage(winner);

  return {
    playerMove,
    computerMove: compMove,
    winner,
    message,
  };
}
