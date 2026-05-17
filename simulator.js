// ═══════════════════════════════════════════════
// SIMULATION KINEMATICS ENGINE
// ═══════════════════════════════════════════════
// This file is the mathematical heart of the project. It calculates exactly how to smoothly
// interpolate the machine's position between the coordinates defined in the G-code.

let parsed = { entries: [], ops: [] };

// 'ss' represents the active Simulation State.
const ss = {
    playing: false,      // Is the playhead currently moving?
    idx: 0,              // Current index inside the parsed.entries array
    t: 0,                // Interpolation scalar from 0.0 to 1.0 (how far along the current line are we?)
    speedMult: 15,       // Artificial multiplier to make the simulation run faster than real time

    x: 0, y: 0, z: 50,   // Real-time calculated coordinates of the tool tip

    inSeg: false,        // Are we currently actively traversing a line segment?
    segLen: 1,           // The physical distance length of the current line segment in mm
    gcode: 'G00',        // The current movement type (G00 Rapid, G01 Feed, G02/G03 Arc)

    fx: 0, fy: 0, fz: 50, // "From" coordinates - Where did this segment start?
    tx: 0, ty: 0, tz: 50, // "To" coordinates - Where is this segment ending?

    arc: null            // Holds arc geometry metadata (radius, sweep angle) if doing a G02/G03
};

let simTimer = null, lastTick = performance.now();

/**
 * Kicks off a fast periodic timer that calculates movement logic 60 times a second.
 */
function simStart() {
    clearInterval(simTimer);
    lastTick = performance.now();
    simTimer = setInterval(simTick, 0.1)
}

/**
 * Pauses the movement calculation loop.
 */
function simStop() {
    clearInterval(simTimer);
    simTimer = null;
}

/**
 * Fired 60 times per second while playing.
 * It determines how much physical time (dt) has passed and delegates the math.
 */
function simTick() {
    if (!ss.playing) return;

    // Calculate delta time (dt) in seconds.
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    // If we've finished the previous segment, load up the next one.
    // Otherwise, continue interpolating along the current segment.
    if (!ss.inSeg) {
        advance();
    } else {
        interp(dt);
    }
}

/**
 * Loads the next valid G-code line from the array and prepares the mathematical
 * data required to traverse it.
 */
function advance() {
    while (ss.idx < parsed.entries.length) {
        const e = parsed.entries[ss.idx];

        // Skip over comments or empty lines
        if (!e || e.type === 'skip' || e.type === 'comment' || !e.toState) {
            ss.idx++;
            continue;
        }

        // M30 represents Program End in standard G-code
        if (e.m === 30) {
            uiComplete();
            return;
        }

        const ts = e.toState;
        const g = e.gcode || 'G00';

        // Record our exact starting position for this segment
        ss.fx = ss.x;
        ss.fy = ss.y;
        ss.fz = ss.z;

        // Record the exact target destination
        ss.tx = ts.x;
        ss.ty = ts.y;
        ss.tz = ts.z;

        if (g === 'G00' || g === 'G01') {
            // Linear Movements (Straight lines)
            // Use 3D Pythagorean theorem to find the exact length of the line in mm
            ss.segLen = Math.hypot(ss.tx - ss.fx, ss.ty - ss.fy, ss.tz - ss.fz) || 0.001;
            ss.arc = null;
        } else {
            // Arc Movements (G02 Clockwise, G03 Counter-Clockwise)
            const I = e.i || 0, J = e.j || 0;

            // Calculate absolute center of the circle based on I,J offsets
            const cx = ss.fx + I;
            const cy = ss.fy + J;

            // Calculate radius
            const r = Math.hypot(ss.fx - cx, ss.fy - cy) || 1;

            // Calculate starting and ending angles via arctangent
            const sa = Math.atan2(ss.fy - cy, ss.fx - cx);
            let ea = Math.atan2(ss.ty - cy, ss.tx - cx);

            // Determine the sweep direction based on if it's G02 (CW) or G03 (CCW)
            let sw = g === 'G02'
                ? (ea - sa > 0 ? ea - sa - Math.PI * 2 : ea - sa)
                : (ea - sa < 0 ? ea - sa + Math.PI * 2 : ea - sa);

            // If it's a full 360 degree circle, fix mathematical edge cases
            if (Math.abs(sw) < 0.001) sw = g === 'G02' ? -Math.PI * 2 : Math.PI * 2;

            ss.arc = { cx, cy, r, sa, sw };

            // Arc length is radius * radians, plus any Z-axis helical drop
            ss.segLen = Math.abs(sw) * r + Math.abs(ss.tz - ss.fz);
        }

        // Mark that we are now actively inside a segment, ready to begin interpolating
        ss.gcode = g;
        ss.t = 0;
        ss.inSeg = true;
        break;
    }
}

/**
 * Calculates the exact micro-position of the tool based on time elapsed and physical speed.
 * @param {number} dt - Delta time elapsed since last frame
 */
function interp(dt) {
    // G00 is rapid travel, so we simulate a very fast 20,000 mm/min.
    // Otherwise, use a standard feedrate of 3000 mm/min.
    // Apply user speed multiplier to fast-forward the visual simulation.
    const spd = (ss.gcode === 'G00' ? 20000 : 3000) * ss.speedMult / 60;

    // Advance 't' (the 0 to 1 scalar). Add the fraction of the segment we just covered.
    ss.t = Math.min(1, ss.t + spd / ss.segLen * dt);

    let nx, ny, nz;

    if (ss.arc) {
        // Evaluate Arc Position using Trigonometry
        const a = ss.arc.sa + ss.arc.sw * ss.t;
        nx = ss.arc.cx + ss.arc.r * Math.cos(a);
        ny = ss.arc.cy + ss.arc.r * Math.sin(a);
        nz = ss.fz + (ss.tz - ss.fz) * ss.t; // Z moves linearly even in an arc (helical interpolation)
    } else {
        // Evaluate Linear Position using basic linear interpolation (LERP)
        nx = ss.fx + (ss.tx - ss.fx) * ss.t;
        ny = ss.fy + (ss.ty - ss.fy) * ss.t;
        nz = ss.fz + (ss.tz - ss.fz) * ss.t;
    }

    // Save state
    ss.x = nx;
    ss.y = ny;
    ss.z = nz;

    // Update the 3D graphics
    moveTool(nx, ny, nz);
    updateTrail(nx, ny, nz);
    uiUpdateHUD();

    // If t hit 1.0, we completed the segment. Ready for the next one!
    if (ss.t >= 1) {
        ss.inSeg = false;
        ss.idx++;
    }
}