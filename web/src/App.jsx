import { useState } from 'react';
import CameraFeed from './components/CameraFeed';
import { GESTURES, GESTURE_METADATA } from './utils/gestureClassifier';
import './App.css';

function App() {
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [gestureInfo, setGestureInfo] = useState({
    gesture: GESTURES.UNKNOWN,
    confidence: 0,
    fingerStates: null,
  });

  const activeMeta = GESTURE_METADATA[gestureInfo.gesture] || GESTURE_METADATA[GESTURES.UNKNOWN];

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="brand-pill">
          <span className={`brand-dot ${isCameraReady ? 'brand-dot-ready' : ''}`} />
          <span className="brand-text">
            {isCameraReady ? 'Module 3 • Vision Active' : 'Module 3 • Initializing'}
          </span>
        </div>
        <h1 className="app-title">
          Rock Paper Scissors <span className="gradient-text">AI</span>
        </h1>
        <p className="app-subtitle">
          Real-time landmark classification with temporal stabilization
        </p>
      </header>

      {/* Main Container */}
      <main className="app-main">
        {/* Camera Feed */}
        <section className="camera-section">
          <CameraFeed
            onHandDetected={(detected) => setIsHandDetected(detected)}
            onCameraReady={(ready) => setIsCameraReady(ready)}
            onGestureDetected={(data) => setGestureInfo(data)}
          />
        </section>

        {/* Live Gesture Detection Showcase */}
        <section className="gesture-showcase-panel">
          <div className="gesture-display-card" style={{ borderColor: isHandDetected ? activeMeta.color : 'var(--border-card)' }}>
            <div className="gesture-emoji-wrapper" style={{ textShadow: `0 0 25px ${activeMeta.color}` }}>
              {isHandDetected ? activeMeta.emoji : '👋'}
            </div>
            <div className="gesture-details">
              <span className="gesture-subtitle">Stabilized Classification</span>
              <h2 className="gesture-name" style={{ color: isHandDetected ? activeMeta.color : 'var(--text-main)' }}>
                {isHandDetected ? activeMeta.label : 'No Hand in View'}
              </h2>
              {isHandDetected && (
                <div className="gesture-meta-row">
                  <span className="stability-meter">
                    Stability: <strong>{gestureInfo.confidence}%</strong>
                  </span>
                  <span className={`posture-tag tag-${gestureInfo.gesture.toLowerCase()}`}>
                    {gestureInfo.gesture === GESTURES.UNKNOWN ? 'Ambiguous Pose' : 'Valid Gesture'}
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

        {/* Gesture Reference Target Grid */}
        <section className="gesture-targets-grid">
          <div className={`target-card ${gestureInfo.gesture === GESTURES.ROCK ? 'target-active' : ''}`}>
            <span className="target-emoji">✊</span>
            <div className="target-info">
              <h4>Rock</h4>
              <p>All fingers curled into fist</p>
            </div>
            {gestureInfo.gesture === GESTURES.ROCK && <span className="active-dot" />}
          </div>

          <div className={`target-card ${gestureInfo.gesture === GESTURES.PAPER ? 'target-active' : ''}`}>
            <span className="target-emoji">✋</span>
            <div className="target-info">
              <h4>Paper</h4>
              <p>All fingers fully extended</p>
            </div>
            {gestureInfo.gesture === GESTURES.PAPER && <span className="active-dot" />}
          </div>

          <div className={`target-card ${gestureInfo.gesture === GESTURES.SCISSORS ? 'target-active' : ''}`}>
            <span className="target-emoji">✌️</span>
            <div className="target-info">
              <h4>Scissors</h4>
              <p>Index &amp; Middle extended</p>
            </div>
            {gestureInfo.gesture === GESTURES.SCISSORS && <span className="active-dot" />}
          </div>
        </section>

        {/* Milestone Note */}
        <footer className="module-footer">
          <p>
            <strong>Module 3 Scope:</strong> Orientation-invariant gesture classification + stabilization.{' '}
            <em>Game rules, scoring, countdown, and AI opponent are scheduled for future modules.</em>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
