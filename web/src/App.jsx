import { useState, useCallback, useRef, useEffect } from 'react';
import CameraFeed from './components/CameraFeed';
import { GESTURES, GESTURE_METADATA } from './utils/gestureClassifier';
import {
  evaluateRound,
  updateScores,
  MOVE_METADATA,
  WINNERS,
} from './utils/gameLogic';
import './App.css';

const MAX_ROUNDS = 5;
const TARGET_WINS = 3;

const GAME_STATUS = {
  IDLE: 'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  ROUND_RESULT: 'ROUND_RESULT',
  MATCH_RESULT: 'MATCH_RESULT',
  UNCLEAR: 'UNCLEAR',
};

export default function App() {
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [gestureInfo, setGestureInfo] = useState({
    gesture: GESTURES.UNKNOWN,
    confidence: 0,
    fingerStates: null,
  });

  // Game Logic States (Best-of-5 Match)
  const [gameStatus, setGameStatus] = useState(GAME_STATUS.IDLE);
  const [currentRound, setCurrentRound] = useState(1);
  const [scores, setScores] = useState({ player: 0, computer: 0, draws: 0 });
  const [roundResult, setRoundResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [scoreAnimation, setScoreAnimation] = useState(null); // 'player' | 'computer' | 'draws' | null
  const [countdownValue, setCountdownValue] = useState(null); // 3, 2, 1, 'SHOOT!'

  // Refs ensuring reliable snapshots and avoiding stale closures across timers
  const currentRoundRef = useRef(1);
  const scoresRef = useRef({ player: 0, computer: 0, draws: 0 });
  const roundScoredRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const nextRoundTimerRef = useRef(null);
  const startCountdownRef = useRef(null);
  const simulatedGestureRef = useRef(null);
  const mockComputerMoveRef = useRef(null);
  const latestGestureRef = useRef({
    gesture: GESTURES.UNKNOWN,
    confidence: 0,
    fingerStates: null,
  });

  // Handle detected gesture input from camera (feeds live snapshot without scoring)
  const handleGestureDetected = useCallback((detectedData) => {
    if (simulatedGestureRef.current) return;
    setGestureInfo(detectedData);
    latestGestureRef.current = detectedData;
  }, []);

  // Expose test helper for automated test environments
  useEffect(() => {
    window.__simulateGesture = (gesture, confidence = 0.95) => {
      if (!gesture) {
        simulatedGestureRef.current = null;
        return;
      }
      simulatedGestureRef.current = gesture;
      const data = {
        gesture,
        confidence,
        hand: 'Right',
        isAmbiguous: gesture === GESTURES.UNKNOWN,
        fingerStates: null,
      };
      setGestureInfo(data);
      latestGestureRef.current = data;
    };

    window.__setMockComputerMove = (move) => {
      mockComputerMoveRef.current = move;
    };

    return () => {
      delete window.__simulateGesture;
      delete window.__setMockComputerMove;
    };
  }, []);

  // Clear all active timers
  const clearAllTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (nextRoundTimerRef.current) {
      clearTimeout(nextRoundTimerRef.current);
      nextRoundTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Clear score bump animation after transition
  useEffect(() => {
    if (scoreAnimation) {
      const timer = setTimeout(() => setScoreAnimation(null), 700);
      return () => clearTimeout(timer);
    }
  }, [scoreAnimation]);

  // Start 3-second countdown gameplay for a specific round (3 -> 2 -> 1 -> SHOOT!)
  const startCountdown = useCallback((roundNumber) => {
    clearAllTimers();
    roundScoredRef.current = false;
    setRoundResult(null);

    const activeRound = roundNumber !== undefined ? roundNumber : currentRoundRef.current;
    setCurrentRound(activeRound);
    currentRoundRef.current = activeRound;

    setGameStatus(GAME_STATUS.COUNTDOWN);

    let currentCount = 3;
    setCountdownValue(3);

    countdownTimerRef.current = setInterval(() => {
      currentCount -= 1;

      if (currentCount > 0) {
        setCountdownValue(currentCount);
      } else if (currentCount === 0) {
        // Exact moment of SHOOT!
        setCountdownValue('SHOOT!');

        const captured = latestGestureRef.current;
        const gesture = captured ? captured.gesture : GESTURES.UNKNOWN;
        const isValidMove =
          gesture === GESTURES.ROCK ||
          gesture === GESTURES.PAPER ||
          gesture === GESTURES.SCISSORS;

        if (isValidMove && !roundScoredRef.current) {
          roundScoredRef.current = true;
          const compMoveOverride = mockComputerMoveRef.current;
          const result = evaluateRound(gesture, compMoveOverride);
          setRoundResult(result);

          // Update match scores
          const prevScores = scoresRef.current;
          const nextScores = updateScores(prevScores, result.winner);
          scoresRef.current = nextScores;
          setScores(nextScores);

          if (result.winner === WINNERS.PLAYER) setScoreAnimation('player');
          else if (result.winner === WINNERS.COMPUTER) setScoreAnimation('computer');
          else if (result.winner === WINNERS.DRAW) setScoreAnimation('draws');

          // Brief pause on SHOOT! then reveal round or match result
          setTimeout(() => {
            const thisRound = currentRoundRef.current;
            const pWins = nextScores.player;
            const cWins = nextScores.computer;

            const isPlayerEarlyWin = pWins >= TARGET_WINS;
            const isComputerEarlyWin = cWins >= TARGET_WINS;
            const isMatchComplete = isPlayerEarlyWin || isComputerEarlyWin || thisRound >= MAX_ROUNDS;

            if (isMatchComplete) {
              let matchWinner = 'draw';
              let title = "IT'S A DRAW MATCH! 🤝";
              let subtitle = `Match tied ${pWins} - ${cWins} after ${thisRound} rounds!`;

              if (pWins > cWins) {
                matchWinner = 'player';
                title = 'YOU WIN THE MATCH! 🏆';
                subtitle = isPlayerEarlyWin
                  ? `Decisive victory! You reached ${TARGET_WINS} wins first.`
                  : `Victory by score after ${MAX_ROUNDS} rounds (${pWins} - ${cWins})!`;
              } else if (cWins > pWins) {
                matchWinner = 'computer';
                title = 'AI WINS THE MATCH! 🤖';
                subtitle = isComputerEarlyWin
                  ? `The AI reached ${TARGET_WINS} wins first.`
                  : `AI won by score after ${MAX_ROUNDS} rounds (${cWins} - ${pWins}).`;
              }

              setMatchResult({
                winner: matchWinner,
                title,
                subtitle,
                finalScores: nextScores,
                roundsPlayed: thisRound,
              });
              setGameStatus(GAME_STATUS.MATCH_RESULT);
              setCountdownValue(null);
            } else {
              // Valid round completed, auto-advance to next round after 2.2 seconds
              setGameStatus(GAME_STATUS.ROUND_RESULT);
              setCountdownValue(null);

              nextRoundTimerRef.current = setTimeout(() => {
                const nextRound = thisRound + 1;
                setCurrentRound(nextRound);
                currentRoundRef.current = nextRound;
                startCountdownRef.current?.(nextRound);
              }, 2200);
            }
          }, 650);
        } else {
          // Unclear / UNKNOWN at SHOOT! -> Round does NOT count
          setTimeout(() => {
            setGameStatus(GAME_STATUS.UNCLEAR);
            setCountdownValue(null);
          }, 650);
        }

        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    }, 1000);
  }, [clearAllTimers]);

  useEffect(() => {
    startCountdownRef.current = startCountdown;
  }, [startCountdown]);

  // Start a new Best-of-5 battle
  const handleStartBattle = () => {
    clearAllTimers();
    setCurrentRound(1);
    currentRoundRef.current = 1;
    setScores({ player: 0, computer: 0, draws: 0 });
    scoresRef.current = { player: 0, computer: 0, draws: 0 };
    setRoundResult(null);
    setMatchResult(null);
    startCountdown(1);
  };

  // Play another full match after previous match ends
  const handlePlayAgain = () => {
    handleStartBattle();
  };

  // Reset entire scoreboard, match, and active timers
  const handleResetScore = () => {
    clearAllTimers();
    setCountdownValue(null);
    setCurrentRound(1);
    currentRoundRef.current = 1;
    setScores({ player: 0, computer: 0, draws: 0 });
    scoresRef.current = { player: 0, computer: 0, draws: 0 };
    setRoundResult(null);
    setMatchResult(null);
    roundScoredRef.current = false;
    setGameStatus(GAME_STATUS.IDLE);
    setScoreAnimation(null);
  };

  // Stable callbacks for CameraFeed
  const handleHandDetected = useCallback((detected) => {
    setIsHandDetected(detected);
  }, []);

  const handleCameraReady = useCallback((ready) => {
    setIsCameraReady(ready);
  }, []);

  const activeMeta = GESTURE_METADATA[gestureInfo.gesture] || GESTURE_METADATA[GESTURES.UNKNOWN];

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="brand-pill">
          <span className={`brand-dot ${isCameraReady ? 'brand-dot-ready' : ''}`} />
          <span className="brand-text">
            {isCameraReady ? 'AI Vision Ready' : 'Initializing Vision...'}
          </span>
        </div>
        <h1 className="app-title">
          Rock Paper Scissors <span className="gradient-text">AI</span>
        </h1>
        <p className="app-subtitle">
          Real-time webcam hand tracking game powered by MediaPipe &amp; React
        </p>
      </header>

      {/* Main Container */}
      <main className="app-main">
        {/* Scoreboard Panel */}
        <section className="scoreboard-panel" aria-label="Scoreboard">
          {/* Prominent Match Status Banner */}
          <div className="match-status-banner">
            {gameStatus === GAME_STATUS.IDLE && (
              <>
                <span className="round-pill idle-pill">BEST OF 5 BATTLE</span>
                <span className="match-score-pill">First to 3 Wins</span>
              </>
            )}
            {(gameStatus === GAME_STATUS.COUNTDOWN ||
              gameStatus === GAME_STATUS.ROUND_RESULT ||
              gameStatus === GAME_STATUS.UNCLEAR) && (
              <>
                <span className="round-pill active-match-pill">ROUND {currentRound} / 5</span>
                <span className="match-score-pill">
                  YOU {scores.player}  |  AI {scores.computer}
                </span>
                {scores.draws > 0 && (
                  <span className="match-draws-pill">
                    {scores.draws} {scores.draws === 1 ? 'Draw' : 'Draws'}
                  </span>
                )}
              </>
            )}
            {gameStatus === GAME_STATUS.MATCH_RESULT && (
              <>
                <span className="round-pill complete-match-pill">MATCH COMPLETE</span>
                <span className="match-score-pill">
                  FINAL: YOU {scores.player}  |  AI {scores.computer}
                </span>
              </>
            )}
          </div>

          <div className="score-boxes-container">
            <div className={`score-box score-player ${scoreAnimation === 'player' ? 'score-bump' : ''}`}>
              <span className="score-label">You</span>
              <span className="score-number">{scores.player}</span>
            </div>
            <div className={`score-box score-draws ${scoreAnimation === 'draws' ? 'score-bump' : ''}`}>
              <span className="score-label">Draws</span>
              <span className="score-number">{scores.draws}</span>
            </div>
            <div className={`score-box score-computer ${scoreAnimation === 'computer' ? 'score-bump' : ''}`}>
              <span className="score-label">Computer</span>
              <span className="score-number">{scores.computer}</span>
            </div>
          </div>
          <div className="score-actions">
            <button
              type="button"
              className="btn-reset"
              onClick={handleResetScore}
              title="Reset match and scoreboard to 0"
            >
              🔄 Reset Score
            </button>
          </div>
        </section>

        {/* Game Arena & Controls */}
        <section className="game-arena-panel" aria-live="polite">
          {gameStatus === GAME_STATUS.IDLE && (
            <div className="arena-idle-box">
              <div className="arena-badge">⚔️ Best of 5 Battle</div>
              <h3>Ready for the RPS Championship?</h3>
              <p>
                Face the AI across 5 rounds. First to 3 wins takes the match! Every round starts with a
                3 → 2 → 1 → SHOOT! countdown.
              </p>
              <button
                type="button"
                className="btn-game-primary btn-start-battle"
                onClick={handleStartBattle}
              >
                ⚔️ Start Battle
              </button>
            </div>
          )}

          {gameStatus === GAME_STATUS.COUNTDOWN && (
            <div className="arena-countdown-box">
              <div className="countdown-round-tag">ROUND {currentRound} / 5</div>
              <div
                className={`countdown-number-circle ${countdownValue === 'SHOOT!' ? 'shoot-mode' : ''}`}
                key={countdownValue}
              >
                <span className="countdown-number">{countdownValue}</span>
              </div>
              <h3 className="countdown-headline">
                {countdownValue === 'SHOOT!' ? '⚡ SHOOT! Capture Moment' : `Round ${currentRound}: Get Ready to Shoot!`}
              </h3>
              <p className="countdown-subtext">
                {countdownValue === 'SHOOT!'
                  ? 'Locking in your move and generating AI choice...'
                  : 'Prepare your move: ✊ Rock, ✋ Paper, or ✌️ Scissors'}
              </p>
              <div className="countdown-live-preview">
                <span className="preview-label">Live Hand Pose:</span>
                <span className="preview-badge" style={{ color: activeMeta.color }}>
                  {activeMeta.emoji} {activeMeta.label}
                </span>
              </div>
            </div>
          )}

          {gameStatus === GAME_STATUS.UNCLEAR && (
            <div className="arena-unclear-box">
              <div className="unclear-icon">❓</div>
              <h3 className="unclear-headline">No Clear Move at SHOOT!</h3>
              <p className="unclear-subtext">
                The camera could not detect a clear Rock, Paper, or Scissors gesture at the exact moment of SHOOT!.
              </p>
              <p className="unclear-hint">
                Round {currentRound} / 5 was not counted. Position your hand clearly and try again.
              </p>
              <div className="unclear-actions">
                <button
                  type="button"
                  className="btn-game-primary btn-try-again"
                  onClick={() => startCountdown(currentRound)}
                >
                  🔁 Retry Round {currentRound}
                </button>
              </div>
            </div>
          )}

          {gameStatus === GAME_STATUS.ROUND_RESULT && roundResult && (
            <div className={`arena-result-box round-result-box winner-${roundResult.winner.toLowerCase()}`}>
              <div className="round-badge-row">
                <span className="round-completed-badge">ROUND {currentRound} / 5 COMPLETE</span>
                <span className={`round-outcome-tag outcome-${roundResult.winner.toLowerCase()}`}>
                  {roundResult.winner === WINNERS.PLAYER && `🎉 You Won Round ${currentRound}!`}
                  {roundResult.winner === WINNERS.COMPUTER && `🤖 AI Won Round ${currentRound}!`}
                  {roundResult.winner === WINNERS.DRAW && `🤝 Round ${currentRound} is a Draw!`}
                </span>
              </div>

              <div className="moves-comparison-row">
                <div className="move-card move-player">
                  <span className="move-owner">You</span>
                  <span className="move-icon">{MOVE_METADATA[roundResult.playerMove]?.emoji}</span>
                  <span className="move-name">{MOVE_METADATA[roundResult.playerMove]?.label}</span>
                </div>

                <div className="vs-badge">
                  <span>VS</span>
                </div>

                <div className="move-card move-computer">
                  <span className="move-owner">Computer</span>
                  <span className="move-icon">{MOVE_METADATA[roundResult.computerMove]?.emoji}</span>
                  <span className="move-name">{MOVE_METADATA[roundResult.computerMove]?.label}</span>
                </div>
              </div>

              <div className="result-banner">
                <h2 className="result-headline">{roundResult.message}</h2>
                <div className="auto-advance-bar">
                  <span className="auto-advance-pulse" />
                  <span className="auto-advance-text">
                    Round complete! Preparing Round {currentRound + 1} / 5 in 2.2 seconds...
                  </span>
                </div>
              </div>
            </div>
          )}

          {gameStatus === GAME_STATUS.MATCH_RESULT && matchResult && (
            <div className={`arena-result-box arena-match-result-box match-winner-${matchResult.winner}`}>
              <div className="match-trophy-icon">
                {matchResult.winner === 'player' ? '🏆' : matchResult.winner === 'computer' ? '🤖' : '🤝'}
              </div>
              <h2 className="match-result-headline">{matchResult.title}</h2>

              <div className="match-score-card">
                <div className="match-score-caption">MATCH SCORE</div>
                <div className="match-score-big">
                  <span className="big-score-player">YOU {scores.player}</span>
                  <span className="big-score-divider">-</span>
                  <span className="big-score-computer">{scores.computer} AI</span>
                </div>
                {scores.draws > 0 && (
                  <div className="match-draws-caption">
                    ({scores.draws} {scores.draws === 1 ? 'Draw round' : 'Draw rounds'})
                  </div>
                )}
              </div>

              <p className="match-result-subtext">{matchResult.subtitle}</p>

              <div className="result-actions">
                <button
                  type="button"
                  className="btn-game-primary btn-play-again"
                  onClick={handlePlayAgain}
                >
                  🔁 PLAY AGAIN
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Camera Feed */}
        <section className="camera-section">
          <CameraFeed
            onHandDetected={handleHandDetected}
            onCameraReady={handleCameraReady}
            onGestureDetected={handleGestureDetected}
          />
        </section>

        {/* Live Gesture Detection Showcase */}
        <section className="gesture-showcase-panel">
          <div
            className="gesture-display-card"
            style={{ borderColor: isHandDetected ? activeMeta.color : 'var(--border-card)' }}
          >
            <div className="gesture-emoji-wrapper" style={{ textShadow: `0 0 25px ${activeMeta.color}` }}>
              {isHandDetected ? activeMeta.emoji : '👋'}
            </div>
            <div className="gesture-details">
              <span className="gesture-subtitle">Detected Gesture</span>
              <h2 className="gesture-name" style={{ color: isHandDetected ? activeMeta.color : 'var(--text-main)' }}>
                {isHandDetected ? activeMeta.label : 'No Hand in View'}
              </h2>
              {isHandDetected && (
                <div className="gesture-meta-row">
                  <span className="stability-meter">
                    Stability: <strong>{gestureInfo.confidence}%</strong>
                  </span>
                  <span className={`posture-tag tag-${gestureInfo.gesture.toLowerCase()}`}>
                    {gestureInfo.gesture === GESTURES.UNKNOWN ? 'Ambiguous Pose' : 'Valid Move'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Finger State Matrix */}
          <div className="finger-matrix-card">
            <h3 className="matrix-title">Hand Landmark Geometry</h3>
            <div className="fingers-grid">
              {[
                { name: 'Thumb', key: 'thumb', icon: '👍' },
                { name: 'Index', key: 'index', icon: '☝️' },
                { name: 'Middle', key: 'middle', icon: '🖕' },
                { name: 'Ring', key: 'ring', icon: '💍' },
                { name: 'Pinky', key: 'pinky', icon: '🤙' },
              ].map((finger) => {
                const isExtended = gestureInfo.fingerStates ? Boolean(gestureInfo.fingerStates[finger.key]) : false;
                return (
                  <div
                    key={finger.key}
                    className={`finger-chip ${!isHandDetected ? 'disabled' : isExtended ? 'extended' : 'curled'}`}
                  >
                    <span className="finger-icon">{finger.icon}</span>
                    <div className="finger-text">
                      <span className="finger-name">{finger.name}</span>
                      <span className="finger-state">
                        {!isHandDetected ? '—' : isExtended ? 'Extended' : 'Curled'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Target Reference Cards */}
        <section className="gesture-targets-grid">
          <div className={`target-card ${gestureInfo.gesture === GESTURES.ROCK ? 'target-active' : ''}`}>
            <span className="target-emoji">✊</span>
            <div className="target-info">
              <h4>Rock</h4>
              <p>Beats Scissors • All fingers curled</p>
            </div>
            {gestureInfo.gesture === GESTURES.ROCK && <span className="active-dot" />}
          </div>

          <div className={`target-card ${gestureInfo.gesture === GESTURES.PAPER ? 'target-active' : ''}`}>
            <span className="target-emoji">✋</span>
            <div className="target-info">
              <h4>Paper</h4>
              <p>Beats Rock • All fingers extended</p>
            </div>
            {gestureInfo.gesture === GESTURES.PAPER && <span className="active-dot" />}
          </div>

          <div className={`target-card ${gestureInfo.gesture === GESTURES.SCISSORS ? 'target-active' : ''}`}>
            <span className="target-emoji">✌️</span>
            <div className="target-info">
              <h4>Scissors</h4>
              <p>Beats Paper • Index &amp; Middle extended</p>
            </div>
            {gestureInfo.gesture === GESTURES.SCISSORS && <span className="active-dot" />}
          </div>
        </section>

        {/* Portfolio Footer */}
        <footer className="module-footer">
          <p>
            <strong>Rock Paper Scissors AI</strong> • Real-time hand tracking and computer vision in the browser.
          </p>
        </footer>
      </main>
    </div>
  );
}
