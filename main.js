// ═══════════════════════════════════════════════
// MAIN BOOTSTRAP SCRIPT
// ═══════════════════════════════════════════════
// This file is the entry point for the simulation.
// It waits for the HTML document to fully load, then initializes the core components.

window.addEventListener('load', () => {
    // 1. Parse the raw G-code string (from gcode.js) into a structured list of commands.
    // 'parsed' will contain an array of entries with coordinates and movement types.
    parsed = parseGCode(GCODE);
    
    // 2. Initialize the 3D environment (Three.js).
    // This sets up the camera, lighting, grid, and the 3D models for the CNC tool.
    initThree();
    
    // 3. Update the UI panel with the initial starting state.
    // This populates the X, Y, Z coordinates and resets the progress bar to 0%.
    uiUpdateHUD();
});