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

const GAME_STATUS = {
  IDLE: 'IDLE',
  WAITING: 'WAITING',
  RESULT: 'RESULT',
};

export default function App() {
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [gestureInfo, setGestureInfo] = useState({
    gesture: GESTURES.UNKNOWN,
    confidence: 0,
    fingerStates: null,
  });

  // Game Logic States
  const [gameStatus, setGameStatus] = useState(GAME_STATUS.IDLE);
  const [scores, setScores] = useState({ player: 0, computer: 0, draws: 0 });
  const [roundResult, setRoundResult] = useState(null);
  const [scoreAnimation, setScoreAnimation] = useState(null); // 'player' | 'computer' | 'draws' | null

  // Ref ensuring a round scores at most once
  const roundScoredRef = useRef(false);

  // Handle detected gesture input from camera
  const handleGestureDetected = useCallback(
    (detectedData) => {
      setGestureInfo(detectedData);

      const gesture = detectedData.gesture;
      const isValidMove =
        gesture === GESTURES.ROCK ||
        gesture === GESTURES.PAPER ||
        gesture === GESTURES.SCISSORS;

      // Only score when in WAITING state and this round hasn't scored yet
      if (gameStatus === GAME_STATUS.WAITING && isValidMove && !roundScoredRef.current) {
        roundScoredRef.current = true;

        const result = evaluateRound(gesture);
        setRoundResult(result);
        setScores((prev) => {
          const next = updateScores(prev, result.winner);
          if (result.winner === WINNERS.PLAYER) setScoreAnimation('player');
          else if (result.winner === WINNERS.COMPUTER) setScoreAnimation('computer');
          else if (result.winner === WINNERS.DRAW) setScoreAnimation('draws');
          return next;
        });
        setGameStatus(GAME_STATUS.RESULT);
      }
    },
    [gameStatus]
  );

  // Clear score bump animation after transition
  useEffect(() => {
    if (scoreAnimation) {
      const timer = setTimeout(() => setScoreAnimation(null), 700);
      return () => clearTimeout(timer);
    }
  }, [scoreAnimation]);

  // Start new game session / round
  const handleStartGame = () => {
    roundScoredRef.current = false;
    setRoundResult(null);
    setGameStatus(GAME_STATUS.WAITING);
  };

  // Play another round
  const handlePlayAgain = () => {
    roundScoredRef.current = false;
    setRoundResult(null);
    setGameStatus(GAME_STATUS.WAITING);
  };

  // Reset entire scoreboard
  const handleResetScore = () => {
    setScores({ player: 0, computer: 0, draws: 0 });
    setRoundResult(null);
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
              title="Reset scoreboard to 0"
            >
              🔄 Reset Score
            </button>
          </div>
        </section>

        {/* Game Arena & Controls */}
        <section className="game-arena-panel" aria-live="polite">
          {gameStatus === GAME_STATUS.IDLE && (
            <div className="arena-idle-box">
              <div className="arena-badge">Ready to Play</div>
              <h3>Start a Round</h3>
              <p>Click below, then hold up Rock, Paper, or Scissors in front of the camera.</p>
              <button
                type="button"
                className="btn-game-primary"
                onClick={handleStartGame}
              >
                🎮 Start Game
              </button>
            </div>
          )}

          {gameStatus === GAME_STATUS.WAITING && (
            <div className="arena-waiting-box">
              <div className="waiting-radar-wrapper">
                <div className="waiting-radar-pulse" />
                <span className="waiting-radar-icon">📸</span>
              </div>
              <h3>Round in Progress</h3>
              <p>Make your move: ✊ Rock, ✋ Paper, or ✌️ Scissors</p>
              <div className="waiting-badge">
                <span className="waiting-dot" />
                <span>Waiting for your hand gesture...</span>
              </div>
            </div>
          )}

          {gameStatus === GAME_STATUS.RESULT && roundResult && (
            <div className={`arena-result-box winner-${roundResult.winner.toLowerCase()}`}>
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
                <span className="result-subtext">
                  {roundResult.winner === WINNERS.PLAYER && 'Great move! You beat the computer.'}
                  {roundResult.winner === WINNERS.COMPUTER && 'Computer won this round. Try again!'}
                  {roundResult.winner === WINNERS.DRAW && 'Both chose the same move. Stalemate!'}
                </span>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className="btn-game-primary btn-play-again"
                  onClick={handlePlayAgain}
                >
                  🔁 Play Again
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
