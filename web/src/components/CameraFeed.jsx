import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import {
  classifyHandGesture,
  GestureStabilizer,
  GESTURES,
  GESTURE_METADATA,
} from '../utils/gestureClassifier';

export default function CameraFeed({ onHandDetected, onCameraReady, onGestureDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const streamRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceTimeRef = useRef(-1);
  const stabilizerRef = useRef(new GestureStabilizer(6, 4));

  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'requesting' | 'loading-model' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState(null); // 'permission' | 'notFound' | 'model' | 'unknown'
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [cameraInfo, setCameraInfo] = useState({ width: 0, height: 0, fps: 0 });
  const [gestureData, setGestureData] = useState({
    gesture: GESTURES.UNKNOWN,
    confidence: 0,
    fingerStates: null,
  });

  const onHandDetectedRef = useRef(onHandDetected);
  const onCameraReadyRef = useRef(onCameraReady);
  const onGestureDetectedRef = useRef(onGestureDetected);
  const activeCallIdRef = useRef(0);

  useEffect(() => {
    onHandDetectedRef.current = onHandDetected;
    onCameraReadyRef.current = onCameraReady;
    onGestureDetectedRef.current = onGestureDetected;
  });

  // Cleanup stream and animation loop
  const stopCamera = useCallback(() => {
    activeCallIdRef.current++;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize MediaPipe HandLandmarker
  const initLandmarker = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;

    setCameraState('loading-model');

    // 1. Resolve WASM assets (local first, fallback to CDN)
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks('/wasm');
    } catch {
      console.warn('Local WASM files not reachable, falling back to CDN...');
      try {
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      } catch (cdnErr) {
        throw new Error(`Failed to load MediaPipe WASM runtime: ${cdnErr.message}`);
      }
    }

    // 2. Initialize HandLandmarker with model fallback
    let landmarker;
    const modelOptions = [
      { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
      { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
      { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' },
      { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU' },
    ];

    let lastModelError = null;
    for (const opt of modelOptions) {
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: opt,
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (landmarker) break;
      } catch (err) {
        console.warn(`Attempt with ${opt.modelAssetPath} (${opt.delegate}) failed:`, err);
        lastModelError = err;
      }
    }

    if (!landmarker) {
      throw new Error(`Could not load HandLandmarker model: ${lastModelError?.message || 'Unknown error'}`);
    }

    landmarkerRef.current = landmarker;
    return landmarker;
  };

  // Frame processing and landmark rendering loop
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker) return;

    const ctx = canvas.getContext('2d');
    const drawingUtils = new DrawingUtils(ctx);

    let frameCounter = 0;
    let lastFpsTime = performance.now();

    const render = () => {
      // Check if video is playing and has data
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused) {
        // Adjust canvas dimensions if video dimensions changed
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          setCameraInfo((prev) => ({
            ...prev,
            width: video.videoWidth,
            height: video.videoHeight,
          }));
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Only run inference when video frame has advanced
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;

          const nowMs = performance.now();
          if (nowMs > lastInferenceTimeRef.current) {
            lastInferenceTimeRef.current = nowMs;

            try {
              const results = landmarker.detectForVideo(video, nowMs);

              const hasHand = Boolean(results && results.landmarks && results.landmarks.length > 0);
              setIsHandDetected(hasHand);
              if (onHandDetectedRef.current) {
                onHandDetectedRef.current(hasHand, results);
              }

              if (hasHand) {
                const primaryHandLandmarks = results.landmarks[0];

                // 1. Gesture Classification + Temporal Stabilization
                const rawClassification = classifyHandGesture(primaryHandLandmarks);
                const stabilized = stabilizerRef.current.add(rawClassification.gesture);

                const updatedGesture = {
                  gesture: stabilized.stableGesture,
                  confidence: stabilized.confidence,
                  fingerStates: rawClassification.fingerStates,
                };

                setGestureData(updatedGesture);
                if (onGestureDetectedRef.current) {
                  onGestureDetectedRef.current(updatedGesture);
                }

                // 2. Draw landmarks and connectors
                for (const landmarks of results.landmarks) {
                  // Draw skeletal connections
                  drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                    color: '#38ef7d',
                    lineWidth: 3,
                  });
                  // Draw landmark joints
                  drawingUtils.drawLandmarks(landmarks, {
                    color: '#11e8b6',
                    fillColor: '#ffffff',
                    lineWidth: 1.5,
                    radius: 4,
                  });
                }

                // 3. Render floating gesture label near wrist
                if (stabilized.stableGesture !== GESTURES.UNKNOWN) {
                  const meta = GESTURE_METADATA[stabilized.stableGesture];
                  const wrist = primaryHandLandmarks[0];
                  const x = wrist.x * canvas.width;
                  const y = Math.max(35, wrist.y * canvas.height - 20);

                  ctx.save();
                  ctx.font = 'bold 22px Outfit, sans-serif';
                  ctx.fillStyle = meta.color;
                  ctx.shadowColor = meta.color;
                  ctx.shadowBlur = 8;
                  ctx.fillText(`${meta.emoji} ${meta.label}`, x - 35, y);
                  ctx.restore();
                }
              } else {
                stabilizerRef.current.reset();
                const resetGesture = {
                  gesture: GESTURES.UNKNOWN,
                  confidence: 0,
                  fingerStates: null,
                };
                setGestureData(resetGesture);
                if (onGestureDetectedRef.current) {
                  onGestureDetectedRef.current(resetGesture);
                }
              }
            } catch (inferErr) {
              console.warn('Frame detection error:', inferErr);
            }
          }
        }

        // FPS calculation
        frameCounter++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          setCameraInfo((prev) => ({
            ...prev,
            fps: Math.round((frameCounter * 1000) / (now - lastFpsTime)),
          }));
          frameCounter = 0;
          lastFpsTime = now;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
  }, []);

  // Start webcam and hand tracking
  const startCamera = useCallback(async () => {
    // If an active live stream already exists, preserve it
    const hasLiveStream = streamRef.current &&
      streamRef.current.getTracks().some((t) => t.readyState === 'live');
    if (hasLiveStream && videoRef.current && videoRef.current.srcObject) {
      if (!animFrameIdRef.current) {
        runDetectionLoop();
      }
      return;
    }

    const callId = ++activeCallIdRef.current;

    // Stop previous tracks and reset state
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setErrorMessage('');
    setErrorType(null);
    setCameraState('requesting');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (callId !== activeCallIdRef.current) return;
      setCameraState('error');
      setErrorType('notFound');
      setErrorMessage('Browser does not support camera access (getUserMedia is unavailable).');
      return;
    }

    try {
      // 1. Get webcam stream
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });
      } catch (camErr) {
        // Fallback to basic constraints if ideal resolution fails
        if (camErr.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw camErr;
        }
      }

      if (callId !== activeCallIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      videoRef.current.srcObject = stream;

      await new Promise((resolve) => {
        const video = videoRef.current;
        if (!video) return resolve();

        const handleReady = () => {
          video.removeEventListener('loadeddata', handleReady);
          video.removeEventListener('loadedmetadata', handleReady);
          video.play().then(resolve).catch(resolve);
        };

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          video.play().then(resolve).catch(resolve);
        } else {
          video.addEventListener('loadeddata', handleReady);
          video.addEventListener('loadedmetadata', handleReady);
          setTimeout(handleReady, 500);
        }
      });

      if (callId !== activeCallIdRef.current) {
        stopCamera();
        return;
      }

      // 2. Load HandLandmarker
      await initLandmarker();

      if (callId !== activeCallIdRef.current) {
        stopCamera();
        return;
      }

      setCameraState('ready');
      if (onCameraReadyRef.current) onCameraReadyRef.current(true);

      // Start detection render loop
      runDetectionLoop();
    } catch (err) {
      if (callId !== activeCallIdRef.current) return;

      console.error('Camera or model initialization error:', err);
      setCameraState('error');

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorType('permission');
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorType('notFound');
        setErrorMessage('No camera found on this device. Please connect a webcam and retry.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorType('busy');
        setErrorMessage('Camera is currently in use by another application or tab.');
      } else if (err.message && err.message.includes('HandLandmarker')) {
        setErrorType('model');
        setErrorMessage(`AI Model failed to load: ${err.message}`);
      } else {
        setErrorType('unknown');
        setErrorMessage(err.message || 'An unexpected error occurred while accessing the camera.');
      }

      if (onCameraReadyRef.current) onCameraReadyRef.current(false);
    }
  }, [stopCamera, runDetectionLoop]);

  useEffect(() => {
    let isMounted = true;

    Promise.resolve().then(() => {
      if (isMounted) {
        startCamera();
      }
    });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const activeMeta = GESTURE_METADATA[gestureData.gesture] || GESTURE_METADATA[GESTURES.UNKNOWN];

  return (
    <div className="camera-feed-container">
      {/* Top Status Bar */}
      <div className="camera-header-bar">
        <div className="status-badges-group">
          {/* Camera Status */}
          <div className={`badge status-${cameraState}`}>
            <span className="badge-dot" />
            <span className="badge-text">
              {cameraState === 'ready' && 'Camera Active'}
              {cameraState === 'requesting' && 'Requesting Camera...'}
              {cameraState === 'loading-model' && 'Loading AI Model...'}
              {cameraState === 'error' && 'Camera Error'}
              {cameraState === 'idle' && 'Camera Off'}
            </span>
          </div>

          {/* Hand Tracking Status */}
          {cameraState === 'ready' && (
            <div className={`badge hand-badge ${isHandDetected ? 'hand-active' : 'hand-waiting'}`}>
              <span className="hand-icon">{isHandDetected ? '🖐️' : '⏳'}</span>
              <span>{isHandDetected ? 'Hand Detected' : 'Show Hand to Camera'}</span>
            </div>
          )}

          {/* Active Gesture Badge */}
          {cameraState === 'ready' && isHandDetected && (
            <div
              className={`badge gesture-badge gesture-${gestureData.gesture.toLowerCase()}`}
              style={{ borderColor: activeMeta.color }}
            >
              <span>{activeMeta.emoji}</span>
              <span style={{ color: activeMeta.color, fontWeight: 700 }}>{activeMeta.label}</span>
              {gestureData.confidence > 0 && (
                <span className="confidence-tag">{gestureData.confidence}%</span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="camera-controls-group">
          <button
            type="button"
            className="btn-icon"
            title={isMirrored ? 'Disable Mirror' : 'Enable Mirror'}
            onClick={() => setIsMirrored((m) => !m)}
          >
            {isMirrored ? '🪞 Mirrored' : '🔄 Normal'}
          </button>
          {cameraState === 'ready' && cameraInfo.width > 0 && (
            <span className="stats-tag">
              {cameraInfo.width}×{cameraInfo.height} {cameraInfo.fps > 0 ? `• ${cameraInfo.fps} FPS` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Video + Canvas Viewport */}
      <div className="camera-viewport-card">
        {/* Loading Overlay */}
        {(cameraState === 'requesting' || cameraState === 'loading-model') && (
          <div className="camera-state-overlay loading-overlay">
            <div className="pulse-spinner" />
            <p className="state-title">
              {cameraState === 'requesting' ? 'Requesting Webcam Permission' : 'Initializing MediaPipe AI...'}
            </p>
            <p className="state-subtitle">
              {cameraState === 'requesting'
                ? 'Please accept the browser camera prompt to play'
                : 'Loading neural hand landmark tracker'}
            </p>
          </div>
        )}

        {/* Error Overlay */}
        {cameraState === 'error' && (
          <div className="camera-state-overlay error-overlay">
            <div className="error-icon">⚠️</div>
            <p className="state-title">Camera Initialization Failed</p>
            <p className="state-subtitle">{errorMessage}</p>
            {errorType === 'permission' && (
              <p className="error-hint">
                Check the camera icon in your browser URL bar and change permission to "Allow".
              </p>
            )}
            <button type="button" className="btn-retry" onClick={startCamera}>
              🔄 Try Again
            </button>
          </div>
        )}

        {/* Video Feed */}
        <video
          ref={videoRef}
          className={`camera-video ${isMirrored ? 'mirrored' : ''}`}
          playsInline
          muted
          autoPlay
        />

        {/* Hand Landmark Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className={`camera-canvas ${isMirrored ? 'mirrored' : ''}`}
        />

        {/* Interactive Hand Finder Crosshairs / Guideline */}
        {cameraState === 'ready' && !isHandDetected && (
          <div className="hand-finder-guide">
            <div className="guide-box">
              <span className="guide-hint">Position hand inside frame</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
