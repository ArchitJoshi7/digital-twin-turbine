// ═══════════════════════════════════════════════
// UI & CONTROLS MANAGER
// ═══════════════════════════════════════════════
// This file handles all user interactions from the floating glass panel in the HTML.
// It bridges the gap between the HTML buttons and the core simulation engine.

/**
 * Toggles the simulation playback state between Playing and Paused.
 * If the simulation is already complete, it resets and starts from the beginning.
 */
function uiTogglePlay() {
    // Check if we reached the end of the G-code sequence
    if (ss.idx >= parsed.entries.length || document.getElementById('btn-play').textContent === 'Restart') {
        uiReset(); // Reset the tool and progress
        ss.playing = true;
    } else {
        // Toggle the playing boolean
        ss.playing = !ss.playing;
    }
    
    const btn = document.getElementById('btn-play');
    const badge = document.getElementById('status-badge');
    
    // Update visuals based on the new playback state
    if (ss.playing) {
        // SIMULATION RUNNING
        btn.textContent = 'Pause';
        btn.classList.add('active');
        
        badge.textContent = 'Running';
        badge.classList.add('running');
        
        // Record the current time to calculate smooth animation steps, then kick off the loop
        lastTick = performance.now();
        simStart();
    } else {
        // SIMULATION PAUSED
        btn.textContent = 'Play';
        btn.classList.remove('active');
        
        badge.textContent = 'Paused';
        badge.classList.remove('running');
        
        // Halt the interval timer
        simStop();
    }
}

/**
 * Halts the simulation and resets all states back to the very beginning.
 * Moves the tool back to a safe Z-height and clears the glowing green trail.
 */
function uiReset() {
    simStop();
    ss.playing = false;
    
    // Reset simulation state variables (index, interpolation time, active segment flag)
    ss.idx = 0; 
    ss.t = 0; 
    ss.inSeg = false; 
    
    // Reset tool coordinates to absolute zero (with Z raised to a safe clearance height of 50)
    ss.x = 0; 
    ss.y = 0; 
    ss.z = 50;
    
    // Wipe the 3D toolpath trail from the viewport
    clearTrail();
    
    // Physically move the 3D tool model to the starting position
    moveTool(0, 0, 50);
    
    // Reset UI button text and states
    const btn = document.getElementById('btn-play');
    btn.textContent = 'Play';
    btn.classList.remove('active');
    
    const badge = document.getElementById('status-badge');
    badge.textContent = 'Idle';
    badge.classList.remove('running');
    
    // Push the reset 0,0,50 coordinates to the screen
    uiUpdateHUD();
}

/**
 * Called automatically by the simulator engine when the final G-code line is executed.
 * Updates the UI to show a "Complete" status and offers a Restart button.
 */
function uiComplete() {
    ss.playing = false;
    simStop();
    
    const btn = document.getElementById('btn-play');
    btn.textContent = 'Restart';
    btn.classList.remove('active');
    
    const badge = document.getElementById('status-badge');
    badge.textContent = 'Complete';
    badge.classList.remove('running');
}

/**
 * Refreshes the on-screen numbers and progress bar.
 * This is called many times per second during playback to keep the HTML perfectly synced with the 3D engine.
 */
function uiUpdateHUD() {
    // Format coordinates to 2 decimal places and update the DOM
    document.getElementById('val-x').textContent = ss.x.toFixed(2);
    document.getElementById('val-y').textContent = ss.y.toFixed(2);
    document.getElementById('val-z').textContent = ss.z.toFixed(2);
    
    // Calculate how far along the array of G-code lines we are
    const pct = parsed.entries.length ? (ss.idx / parsed.entries.length) * 100 : 0;
    
    // Expand the blue CSS width of the progress bar
    document.getElementById('progress-bar').style.width = pct + '%';
}

/**
 * Resets the 3D camera to its default viewing angle.
 * Helpful if the user gets lost while orbiting or panning around the scene.
 */
function uiResetCam() {
    orb.theta = Math.PI / 4; 
    orb.phi = Math.PI / 3; 
    orb.r = 120; 
    orb.tx.set(0, 0, 0); 
    doSyncCam(); // Update the actual Three.js camera position
}

/**
 * Updates the simulation speed multiplier using preset buttons.
 * @param {number} val - The new speed multiplier
 * @param {HTMLElement} btnElem - The clicked button element
 */
function uiSetSpeed(val, btnElem) {
    ss.speedMult = val;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btnElem.classList.add('active');
}