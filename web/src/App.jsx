import { useState } from 'react';
import CameraFeed from './components/CameraFeed';
import './App.css';

function App() {
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="brand-pill">
          <span className="brand-dot" />
          <span className="brand-text">Module 2 • Vision & Camera</span>
        </div>
        <h1 className="app-title">
          Rock Paper Scissors <span className="gradient-text">AI</span>
        </h1>
        <p className="app-subtitle">
          Real-time browser hand tracking powered by MediaPipe Vision &amp; WebAssembly
        </p>
      </header>

      {/* Main Container */}
      <main className="app-main">
        <section className="camera-section">
          <CameraFeed
            onHandDetected={(detected) => setIsHandDetected(detected)}
            onCameraReady={(ready) => setIsCameraReady(ready)}
          />
        </section>

        {/* Live Status Cards */}
        <section className="info-cards-grid">
          <div className={`info-card ${isCameraReady ? 'card-ready' : 'card-pending'}`}>
            <div className="info-icon">{isCameraReady ? '📹' : '⏳'}</div>
            <div className="info-content">
              <h3>Webcam Feed</h3>
              <p>{isCameraReady ? 'Connected & Streaming' : 'Initializing camera stream...'}</p>
            </div>
            <div className={`status-indicator ${isCameraReady ? 'indicator-online' : ''}`} />
          </div>

          <div className={`info-card ${isHandDetected ? 'card-active' : ''}`}>
            <div className="info-icon">{isHandDetected ? '🖐️' : '🔍'}</div>
            <div className="info-content">
              <h3>Hand Landmark Detection</h3>
              <p>
                {isHandDetected
                  ? '21 3D Landmarks Detected in Real-Time'
                  : isCameraReady
                  ? 'Raise your hand into the camera frame'
                  : 'Awaiting camera start...'}
              </p>
            </div>
            <div className={`status-indicator ${isHandDetected ? 'indicator-tracking' : ''}`} />
          </div>
        </section>

        {/* Milestone Note */}
        <footer className="module-footer">
          <p>
            <strong>Module 2 Scope:</strong> Camera integration + MediaPipe hand tracking foundation.{' '}
            <em>Gesture recognition, AI opponent, countdown timer, and scoring will be enabled in upcoming modules.</em>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
