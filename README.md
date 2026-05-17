# 🛠️ Digital Twin — Industrial Turbine CNC Simulator

A browser-based CNC Digital Twin built with JavaScript and Three.js that visualizes the machining of a procedurally generated turbine. The project features a custom parser that translates raw G-code (linear and arc interpolations) into a delta-time kinematics engine for mathematically accurate tool movement. A modern glassmorphic UI provides dynamic speed multipliers, playback state, and real-time X/Y/Z telemetry, while the WebGL viewport permanently traces the live toolpath of the milling sequence.

---

## Problem Statement

Running raw, untested G-code on a physical CNC machine is risky. A single miscalculated coordinate can crash the spindle, destroy tooling, and waste raw material. Traditional desktop CNC simulation software is expensive, heavyweight, and difficult to share or integrate into modern workflows.

## Why It Matters

Engineers and machinists need a safe, accessible, and fast way to validate manufacturing instructions before sending them to the shop floor. A Digital Twin provides that validation layer — and delivering it as a zero-install, browser-native application makes it instantly shareable for education, portfolios, and collaborative review.

## Solution

A fully client-side 3D CNC simulator that parses 11,000+ lines of procedurally generated G-code and renders a real-time turbine machining sequence directly in the browser. No backend. No install. Just open `index.html`.

---

## Features

| Feature | Description |
|---|---|
| **Custom G-Code Parser** | Handles `G00` (rapid), `G01` (linear feed), `G02/G03` (clockwise/counter-clockwise arc interpolation), spindle M-codes, and feedrate commands |
| **Delta-Time Kinematics** | Smooth, frame-rate-independent interpolation using real elapsed time for both linear segments and trigonometric arc evaluation |
| **Procedural Turbine G-Code** | 16 spiraling blades generated via parametric math (Python), with multi-pass depth carving and helical hub roughing |
| **Live Toolpath Rendering** | The WebGL viewport permanently inks the traversed path in real-time as the tool moves — no pre-drawn preview |
| **Real-Time Telemetry** | X, Y, Z coordinates and a progress bar update every frame |
| **Speed Control** | Three preset speed multipliers: Slow (1×), Regular (10×), Fast (100×) |
| **Orbit Camera** | Click-drag to rotate, Shift-drag to pan, scroll to zoom, with a one-click Recenter button |
| **Glassmorphic UI** | A clean, floating control panel with modern typography (Inter) and responsive layout |

---

## Tech Stack

- **Rendering** — [Three.js](https://threejs.org/) r128 (WebGL)
- **Language** — Vanilla JavaScript (ES6+)
- **Styling** — Vanilla CSS with glassmorphism
- **Typography** — [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **G-Code Generation** — Python 3 (one-time script, output committed as `js/gcode.js`)

---

## Project Structure

```
mechanical-modeling/
├── index.html          # Entry point — loads all modules and defines the UI panel
├── css/
│   └── style.css       # Glassmorphic panel, progress bar, speed buttons, layout
└── js/
    ├── gcode.js        # 11,000+ lines of procedurally generated turbine G-code
    ├── parser.js       # Converts raw G-code text into structured command objects
    ├── scene.js        # Three.js scene setup, camera, lighting, tool mesh, trail rendering
    ├── simulator.js    # Delta-time kinematics engine (linear interpolation + arc math)
    ├── ui.js           # Bridges HTML controls to the simulation state machine
    └── main.js         # Bootstrap — parses G-code, initializes scene, updates HUD
```

---

## Data Flow

```
gcode.js (raw string)
    ↓
parser.js (parseGCode) → structured entries[] with fromState/toState
    ↓
main.js (bootstrap) → calls initThree() + uiUpdateHUD()
    ↓
simulator.js (simTick @ 60fps) → advance() loads next segment, interp(dt) calculates position
    ↓
scene.js (moveTool + updateTrail) → updates 3D tool position and inks the traversed path
    ↓
ui.js (uiUpdateHUD) → pushes X/Y/Z values and progress bar to the DOM
```

---

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- No dependencies to install — everything loads via CDN

### Run Locally

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/mechanical-modeling.git
cd mechanical-modeling

# Open directly (simplest)
open index.html        # macOS
start index.html       # Windows

# Or use a local server to avoid any CORS issues
npx serve .
```

### Regenerate G-Code (Optional)

If you want to modify the turbine geometry (blade count, radius, depth), edit and re-run the Python generator:

```bash
python gen_gcode.py
```

This overwrites `js/gcode.js` with fresh toolpath data.

---

## Usage

1. Open the simulator in your browser
2. The 3D viewport shows a clean platform with the CNC tool parked at Z=50
3. Click **Play** to begin the simulation
4. Watch the tool trace the turbine machining sequence in real-time
5. Use the **Slow / Regular / Fast** buttons to control simulation speed
6. Click-drag to orbit the camera, scroll to zoom, Shift-drag to pan
7. Click **Recenter** to reset the camera to its default angle
8. Click **Reset** to clear the trace and start over

---

## Key Technical Details

### G-Code Parser (`parser.js`)
- G-code is **modal**: the parser maintains a running state machine (`S`) that remembers the last X, Y, Z, feedrate, and movement mode across lines
- Each parsed entry stores both `fromState` and `toState`, giving the kinematics engine exact start and end coordinates for every segment

### Kinematics Engine (`simulator.js`)
- Uses **uncapped delta-time** (`dt = (now - lastTick) / 1000`) for frame-rate-independent movement
- Linear segments use standard LERP: `pos = from + (to - from) * t`
- Arc segments (G02/G03) use trigonometric evaluation: `x = cx + r * cos(startAngle + sweep * t)`
- Helical interpolation: Z moves linearly even during arc segments

### 3D Scene (`scene.js`)
- Coordinate mapping: CNC Z → Three.js Y, CNC Y → Three.js -Z
- Trail uses `frustumCulled = false` to prevent the camera from hiding dynamically updated geometry
- Trail buffer is pre-allocated at 150,000 vertices to persist the entire machining path

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Author

Built as an engineering portfolio project demonstrating the intersection of mechanical engineering, CNC manufacturing, and modern web development.
