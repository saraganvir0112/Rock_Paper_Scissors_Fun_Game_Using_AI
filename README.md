# Rock Paper Scissors AI 🤖✊✋✌️

A real-time computer vision Rock Paper Scissors game powered by AI hand tracking. Play against an AI opponent using physical hand gestures captured by your webcam — no keyboard, mouse, or controller required.

This repository features both the original **Python desktop application** (OpenCV + MediaPipe) and a modern **interactive web application** (React 19 + MediaPipe Tasks Vision + Vite).

---

## 🌐 Live Demo
- **Live Demo**: *To be deployed*

---

## ✨ Features

- **Real-Time Hand Tracking**: Detects and tracks 21 3D hand landmarks via MediaPipe HandLandmarker.
- **Robust Landmark-Relative Gesture Classification**:
  - ✊ **Rock**: All 4 fingers curled inward toward the palm.
  - ✋ **Paper**: All 5 fingers extended outward with open palm.
  - ✌️ **Scissors**: Index and middle fingers extended; ring and pinky curled.
  - ❓ **Unknown / Ambiguous**: Transient transitions and non-RPS poses are safely classified as `UNKNOWN` without false triggers.
- **Stabilization Engine**: Sliding window temporal buffer with confidence thresholding to prevent jitter and accidental triggers.
- **AI Opponent & Game Logic**: Fair computerized opponent with standard rules (Rock beats Scissors, Scissors beats Paper, Paper beats Rock).
- **Single-Score Round Protection**: Once a round starts, a held gesture scores exactly once until the next round is initiated.
- **Responsive & Touch-Friendly Web UI**: Optimized layouts across Desktop, Tablet, and Mobile devices with touch target sizes exceeding 44px and zero horizontal overflow.
- **Visual Feedback & Micro-Animations**: Smooth transitions for gesture detection, score increments, and round outcome reveals.

---

## 🛠️ Technologies Used

### Web Application (`/web`)
- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vite.dev/)
- **Computer Vision**: [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (WebAssembly + WebGL)
- **Styling**: Modern Vanilla CSS design system (Glassmorphism, CSS Grid, Flexbox, GPU-accelerated CSS animations)
- **Linter & Code Quality**: [Oxlint](https://oxc.rs/)

### Python Desktop Application (`RPS.py`)
- **Language**: Python 3.11
- **Computer Vision**: OpenCV (`cv2`)
- **Hand Tracking**: MediaPipe (`mediapipe`)
- **Array Computation**: NumPy (`numpy`)

---

## 🚀 Getting Started

### Prerequisites
- A working webcam connected to your computer or mobile device.
- Good ambient lighting so hand landmarks can be accurately identified.

---

### Option A: Running the Web Application (Recommended)

1. Navigate to the `web` directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the displayed local URL (typically `http://localhost:5173`).
5. When prompted by the browser, **allow camera access**.
6. Click **Start Game**, show your gesture to the camera, and see the AI match your move!

To build for production:
```bash
npm run build
```

To run lint checks:
```bash
npm run lint
```

---

### Option B: Running the Python Desktop Application

1. From the repository root, install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python RPS.py
   ```
   *(or `py -3.11 RPS.py` if using Python Launcher on Windows)*

3. Use hand gestures in front of the camera:
   - Make a fist for **Rock**.
   - Open your palm for **Paper**.
   - Show two fingers for **Scissors**.
   - Press `q` to quit.

---

## 📷 Camera Permissions & Requirements

- **Browser Camera Permissions**: The web application requires access to `navigator.mediaDevices.getUserMedia`. Ensure camera permissions are granted in your browser settings.
- **Lighting & Background**: Ensure your hand is well-lit and contrasts reasonably with your background.
- **Hand Orientation**: The landmark classifier uses relative vector geometry and Euclidean distances relative to wrist landmark #0, supporting both left and right hands.

---

## 📱 Verified Compatibility

The web application has been tested and verified for zero horizontal overflow, touch-target compliance ($\ge 44\text{px}$), and active camera/landmark canvas alignment across:

- **Desktop**: $1280 \times 800$ (Chrome / Chromium-based browsers)
- **Tablet**: $768 \times 1024$
- **Mobile Devices**:
  - $375 \times 667$ (e.g., iPhone SE)
  - $390 \times 844$ (e.g., iPhone 14 / modern iOS viewports)
  - $412 \times 915$ (e.g., Google Pixel / Android viewports)
- **Browsers**: Google Chrome, Microsoft Edge, and modern Chromium-based browsers supporting WebAssembly and MediaDevices API.

---

## 📁 Project Structure

```
Rock_Paper_Scissors_Fun_Game_Using_AI/
├── RPS.py                     # Original Python desktop application (untouched)
├── requirements.txt           # Python dependencies (OpenCV, MediaPipe, NumPy)
├── README.md                  # Project documentation
├── .gitignore                 # Root gitignore (Python, OS, environment, and web build artifacts)
└── web/                       # Modern React + MediaPipe Web Application
    ├── package.json           # Node.js dependencies & scripts
    ├── vite.config.js         # Vite bundler configuration
    ├── index.html             # Web entry point & viewport meta
    ├── public/
    │   ├── models/            # MediaPipe HandLandmarker .task model bundle
    │   └── wasm/              # MediaPipe WebAssembly binaries & fallbacks
    └── src/
        ├── App.jsx            # Main application layout, game loop, & state
        ├── App.css            # Responsive CSS design system & micro-animations
        ├── index.css          # Base reset, CSS variables, & overflow prevention
        ├── main.jsx           # React DOM root
        ├── components/
        │   └── CameraFeed.jsx # Webcam streaming, MediaPipe pipeline, & canvas overlay
        └── utils/
            ├── gameLogic.js   # Pure RPS rules, winner calculation, & scoreboard state
            └── gestureClassifier.js # Landmark geometry classification & temporal stabilizer
```

---

## 👤 Author

- **Sara Ganvir** — [GitHub](https://github.com/saraganvir0112)