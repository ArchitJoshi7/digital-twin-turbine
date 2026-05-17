// ═══════════════════════════════════════════════
// THREE.JS 3D SCENE & RENDERING
// ═══════════════════════════════════════════════
// This file initializes the WebGL viewport, creates the lighting, builds the 3D tool,
// draws the pre-calculated toolpath lines, and handles camera orbits.

let renderer, scene, camera;
let toolGroup; // Holds the 3D mesh of the CNC spindle and tool tip

// Configuration for the orbit camera (pan, tilt, zoom)
const orb = { 
    active: false, 
    px: 0, py: 0, 
    theta: Math.PI / 4, // Horizontal rotation
    phi: Math.PI / 3,   // Vertical rotation
    r: 120,             // Radius (zoom distance)
    tx: new THREE.Vector3(0, 0, 0) // Target point the camera looks at
};

// Toolpath Trail configuration
const TRL = 150000; // Increased significantly so the path stays dark permanently as it cuts
let trailPts = [], trailGeo, trailLine;

/**
 * Initializes the entire 3D scene, rendering pipeline, and models.
 */
function initThree() {
    const canvas = document.getElementById('cnv');
    const vp = document.getElementById('viewport');

    // 1. Setup WebGL Renderer
    // We use antialiasing for smooth edges, and alpha:true to blend with the CSS background
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(vp.clientWidth, vp.clientHeight);

    // 2. Setup the Scene & Environment
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8); // Clean light gray
    scene.fog = new THREE.Fog(0xf0f4f8, 100, 300); // Fades distant objects out smoothly

    // 3. Setup the Camera
    // Uses a Perspective camera with a 40 degree field of view
    camera = new THREE.PerspectiveCamera(40, vp.clientWidth / vp.clientHeight, 0.1, 1000);
    doSyncCam(); // Position the camera based on 'orb' settings

    // 4. Setup Lighting
    // Ambient light softly illuminates everything equally
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    
    // Directional light acts like the sun, casting shadows downwards
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // 5. Setup Ground Plane
    // A subtle grid helps visualize X/Y spatial dimensions
    const grid = new THREE.GridHelper(100, 20, 0xcbd5e0, 0xe2e8f0);
    grid.position.y = -0.1; // Slightly below zero to prevent Z-fighting with the base
    scene.add(grid);

    // 6. Setup the Machine Base
    // A simple, sleek white cylinder that acts as the platform for the machining area
    const baseGeo = new THREE.CylinderGeometry(40, 40, 2, 64);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -1.1; // Sits just below zero
    scene.add(baseMesh);

    // 7. Render Machine Parts (Toolpath preview removed)
    buildTool();          // Construct the actual spindle and cutting tip

    // 8. Setup the Live Tracking Trail
    // This is a dynamic line that follows the tool, showing recent history
    trailGeo = new THREE.BufferGeometry();
    const tp = new Float32Array(TRL * 3).fill(9999); // Fill with dummy coordinates initially
    trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    // Create a thin, light tracking line
    const mat = new THREE.LineBasicMaterial({ color: 0x8ba6c1, transparent: true, opacity: 0.7 }); // Light grayish-blue
    trailLine = new THREE.Line(trailGeo, mat);
    trailLine.frustumCulled = false; // Prevent camera from hiding the line due to dynamic vertices
    scene.add(trailLine);

    // 9. Setup Event Listeners for Camera Orbit Controls
    // Handle mouse drag to rotate, right click to pan, and scroll to zoom
    canvas.addEventListener('mousedown', e => { orb.active = true; orb.px = e.clientX; orb.py = e.clientY; });
    window.addEventListener('mouseup', () => orb.active = false);
    window.addEventListener('mousemove', e => {
        if (!orb.active) return;
        const dx = e.clientX - orb.px, dy = e.clientY - orb.py;
        orb.px = e.clientX; orb.py = e.clientY;
        
        if (e.buttons === 2 || e.shiftKey) {
            // Panning: shift the target look-at point
            const r = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
            orb.tx.addScaledVector(r, -dx * 0.1);
            orb.tx.y += dy * 0.1;
        } else {
            // Rotating: adjust angles around the sphere
            orb.theta -= dx * 0.01;
            orb.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orb.phi + dy * 0.01));
        }
        doSyncCam();
    });
    
    // Zoom in and out using mouse wheel
    canvas.addEventListener('wheel', e => { 
        orb.r = Math.max(20, Math.min(250, orb.r + e.deltaY * 0.1)); 
        doSyncCam(); 
    });
    
    // Resize the WebGL viewport gracefully if the browser window changes size
    window.addEventListener('resize', () => {
        renderer.setSize(vp.clientWidth, vp.clientHeight);
        camera.aspect = vp.clientWidth / vp.clientHeight;
        camera.updateProjectionMatrix();
    });
    
    // Disable right-click context menu so it doesn't interrupt panning
    canvas.oncontextmenu = () => false;

    // 10. Start the infinite render loop
    (function loop() {
        requestAnimationFrame(loop);
        
        // Spin the tool purely for visual flair if the simulation is playing
        if (ss.playing && toolGroup) {
            toolGroup.children[0].rotation.y += 0.2; 
        }
        
        renderer.render(scene, camera);
    })();
}

/**
 * Calculates camera position using spherical coordinates (r, theta, phi) 
 * relative to the target focus point (tx, ty, tz).
 */
function doSyncCam() {
    camera.position.set(
        orb.tx.x + orb.r * Math.sin(orb.phi) * Math.sin(orb.theta),
        orb.tx.y + orb.r * Math.cos(orb.phi),
        orb.tx.z + orb.r * Math.sin(orb.phi) * Math.cos(orb.theta)
    );
    camera.lookAt(orb.tx);
}

/**
 * Analyzes the fully parsed G-code array and draws a static wireframe map 
 * of the entire path the tool is going to take.
 */
function buildToolpathLines() {
    const pts = [];
    let prev = null;
    
    for (const e of parsed.entries) {
        if (e.type !== 'move' || !e.toState) continue;
        
        const s = e.toState;
        // Notice we map CNC coordinates to Three.js coordinates!
        // CNC Z (up/down) corresponds to Three.js Y. 
        // CNC Y (depth) corresponds to Three.js -Z.
        const p = new THREE.Vector3(s.x, s.z, -s.y);
        
        // Connect a line from the previous point to this new point
        if (prev) pts.push(prev.clone(), p.clone());
        prev = p.clone();
    }
    
    // Generate a line segments geometry to display them all
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: 0xa0aec0, opacity: 0.3, transparent: true });
    scene.add(new THREE.LineSegments(g, m));
}

/**
 * Constructs the 3D meshes for the CNC tool (a cylinder for the body and a sphere for the tip).
 */
function buildTool() {
    toolGroup = new THREE.Group();
    
    // Build the dark metal spindle body
    const spindle = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 20, 32),
        new THREE.MeshLambertMaterial({ color: 0x2d3748 })
    );
    spindle.position.y = 10; // Lift it up so the tip rests at 0
    
    // Build the striking blue ball-nose cutting tip
    const tip = new THREE.Mesh(
        new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x3182ce })
    );
    tip.position.y = 0;
    tip.rotation.x = Math.PI; // Flip it downwards

    // Group them together so they can spin as one unit
    const spinGroup = new THREE.Group();
    spinGroup.add(spindle);
    spinGroup.add(tip);
    toolGroup.add(spinGroup);

    // Initial safe parking position
    toolGroup.position.set(0, 50, 0);
    scene.add(toolGroup);
}

/**
 * Physically translates the 3D tool model to exact spatial coordinates.
 */
function moveTool(x, y, z) {
    // Again mapping CNC Z to Three.js Y
    toolGroup.position.set(x, z, -y);
}

/**
 * Appends a new coordinate to the glowing history trail trailing behind the tool.
 */
function updateTrail(x, y, z) {
    trailPts.push(new THREE.Vector3(x, z, -y));
    
    // If the trail gets too long, remove the oldest point so it doesn't clutter the screen
    if (trailPts.length > TRL) trailPts.shift();
    
    const pos = trailGeo.attributes.position;
    for (let i = 0; i < trailPts.length; i++) {
        pos.setXYZ(i, trailPts[i].x, trailPts[i].y, trailPts[i].z);
    }
    
    pos.needsUpdate = true;
    trailGeo.setDrawRange(0, trailPts.length);
}

/**
 * Completely erases the tracking trail (used when resetting the simulation).
 */
function clearTrail() {
    trailPts = [];
    const pos = trailGeo.attributes.position;
    
    // Shove all points far off-screen to hide them
    for (let i = 0; i < TRL; i++) pos.setXYZ(i, 9999, 9999, 9999);
    
    pos.needsUpdate = true; 
    trailGeo.setDrawRange(0, 0);
}