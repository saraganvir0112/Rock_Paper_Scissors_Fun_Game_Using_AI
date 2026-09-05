/**
 * Gesture Classifier for Rock, Paper, Scissors using MediaPipe Hand Landmarks.
 * Uses orientation-invariant landmark-relative geometry.
 */

// Landmark indices for reference
export const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

export const GESTURES = {
  ROCK: 'ROCK',
  PAPER: 'PAPER',
  SCISSORS: 'SCISSORS',
  UNKNOWN: 'UNKNOWN',
};

export const GESTURE_METADATA = {
  [GESTURES.ROCK]: { label: 'Rock', emoji: '✊', color: '#f59e0b' },
  [GESTURES.PAPER]: { label: 'Paper', emoji: '✋', color: '#10b981' },
  [GESTURES.SCISSORS]: { label: 'Scissors', emoji: '✌️', color: '#6366f1' },
  [GESTURES.UNKNOWN]: { label: 'Unknown', emoji: '❓', color: '#94a3b8' },
};

/**
 * Calculates Euclidean distance between two landmarks.
 */
export function euclideanDistance(p1, p2, use3D = true) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  if (!use3D || p1.z === undefined || p2.z === undefined) {
    return Math.sqrt(dx * dx + dy * dy);
  }
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Determines whether each finger is extended or curled.
 * Uses orientation-invariant distances relative to wrist and MCP joints.
 */
export function getFingerStates(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[LANDMARK_INDEX.WRIST];
  const middleMcp = landmarks[LANDMARK_INDEX.MIDDLE_MCP];
  
  // Reference palm scale (distance from wrist to middle finger knuckle)
  const palmScale = euclideanDistance(wrist, middleMcp);
  if (palmScale === 0) return null;

  // Helper: check if a finger is extended based on tip vs PIP/MCP distance to wrist
  const isFingerExtended = (tipIdx, pipIdx, mcpIdx) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    const distTipToWrist = euclideanDistance(tip, wrist);
    const distPipToWrist = euclideanDistance(pip, wrist);
    const distTipToMcp = euclideanDistance(tip, mcp);
    const distPipToMcp = euclideanDistance(pip, mcp);

    // Finger is extended if tip is further from wrist than PIP
    // AND tip is not curled back toward its base MCP
    const isFartherThanPip = distTipToWrist > distPipToWrist;
    const isNotCurled = distTipToMcp > distPipToMcp * 0.9;

    return isFartherThanPip && isNotCurled;
  };

  // Thumb evaluation: thumb tip distance to pinky MCP compared to thumb IP
  const thumbTip = landmarks[LANDMARK_INDEX.THUMB_TIP];
  const thumbIp = landmarks[LANDMARK_INDEX.THUMB_IP];
  const pinkyMcp = landmarks[LANDMARK_INDEX.PINKY_MCP];
  const isThumbExtended = euclideanDistance(thumbTip, pinkyMcp) > euclideanDistance(thumbIp, pinkyMcp) * 1.1;

  const indexExtended = isFingerExtended(
    LANDMARK_INDEX.INDEX_TIP,
    LANDMARK_INDEX.INDEX_PIP,
    LANDMARK_INDEX.INDEX_MCP
  );

  const middleExtended = isFingerExtended(
    LANDMARK_INDEX.MIDDLE_TIP,
    LANDMARK_INDEX.MIDDLE_PIP,
    LANDMARK_INDEX.MIDDLE_MCP
  );

  const ringExtended = isFingerExtended(
    LANDMARK_INDEX.RING_TIP,
    LANDMARK_INDEX.RING_PIP,
    LANDMARK_INDEX.RING_MCP
  );

  const pinkyExtended = isFingerExtended(
    LANDMARK_INDEX.PINKY_TIP,
    LANDMARK_INDEX.PINKY_PIP,
    LANDMARK_INDEX.PINKY_MCP
  );

  return {
    thumb: isThumbExtended,
    index: indexExtended,
    middle: middleExtended,
    ring: ringExtended,
    pinky: pinkyExtended,
  };
}

/**
 * Classifies the hand pose into ROCK, PAPER, SCISSORS, or UNKNOWN.
 */
export function classifyHandGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return {
      gesture: GESTURES.UNKNOWN,
      confidence: 0,
      fingerStates: null,
    };
  }

  const fingerStates = getFingerStates(landmarks);
  if (!fingerStates) {
    return {
      gesture: GESTURES.UNKNOWN,
      confidence: 0,
      fingerStates: null,
    };
  }

  const { index, middle, ring, pinky } = fingerStates;

  // 1. ROCK: All 4 main fingers curled
  if (!index && !middle && !ring && !pinky) {
    return {
      gesture: GESTURES.ROCK,
      confidence: 0.95,
      fingerStates,
    };
  }

  // 2. PAPER: All 4 main fingers extended
  if (index && middle && ring && pinky) {
    return {
      gesture: GESTURES.PAPER,
      confidence: 0.95,
      fingerStates,
    };
  }

  // 3. SCISSORS: Index and Middle extended; Ring and Pinky curled
  if (index && middle && !ring && !pinky) {
    return {
      gesture: GESTURES.SCISSORS,
      confidence: 0.95,
      fingerStates,
    };
  }

  // 4. Any other pose (e.g. pointing 1 finger, 3 fingers, rock horns) -> UNKNOWN
  return {
    gesture: GESTURES.UNKNOWN,
    confidence: 0.4,
    fingerStates,
  };
}

/**
 * Rolling window stabilizer to avoid single-frame flickers.
 */
export class GestureStabilizer {
  constructor(windowSize = 6, threshold = 4) {
    this.windowSize = windowSize;
    this.threshold = threshold;
    this.history = [];
    this.currentStableGesture = GESTURES.UNKNOWN;
    this.stableCount = 0;
  }

  add(rawGesture) {
    this.history.push(rawGesture);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    // Tally occurrences in the sliding window
    const counts = {};
    for (const g of this.history) {
      counts[g] = (counts[g] || 0) + 1;
    }

    let dominantGesture = GESTURES.UNKNOWN;
    let maxCount = 0;

    for (const [gesture, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantGesture = gesture;
      }
    }

    // Switch stable state only when dominant gesture exceeds consensus threshold
    if (maxCount >= this.threshold) {
      this.currentStableGesture = dominantGesture;
      this.stableCount = maxCount;
    } else if (counts[this.currentStableGesture] === undefined || counts[this.currentStableGesture] === 0) {
      // If the current stable gesture has vanished from history, decay to UNKNOWN
      this.currentStableGesture = GESTURES.UNKNOWN;
      this.stableCount = 0;
    }

    const confidence = this.history.length > 0 ? (maxCount / this.history.length) : 0;

    return {
      stableGesture: this.currentStableGesture,
      rawGesture,
      confidence: Math.round(confidence * 100),
      historyLength: this.history.length,
    };
  }

  reset() {
    this.history = [];
    this.currentStableGesture = GESTURES.UNKNOWN;
    this.stableCount = 0;
  }
}
