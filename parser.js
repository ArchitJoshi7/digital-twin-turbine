// ═══════════════════════════════════════════════
// G-CODE PARSER ENGINE
// ═══════════════════════════════════════════════
// The parser takes raw text (e.g. "G01 X10 Y5 F1000") and converts it into
// Javascript objects so our 3D engine knows exactly where and how fast to move.

/**
 * Reads a massive multiline string of G-code and breaks it down into a structured array.
 * @param {string} raw - The multiline string from gcode.js
 * @returns {object} An object containing 'entries' (the parsed commands) and 'ops' (operation names).
 */
function parseGCode(raw) {
    // Split the entire file by newline into an array of individual text lines
    const lines = raw.split('\n');
    const entries = [];
    const ops = [];
    
    // S keeps track of the 'State' of the machine at any given time.
    // G-code is modal, meaning if you tell it 'X10', and the next line says 'Y5',
    // it remembers that X is still 10. We initialize at X=0, Y=0, Z=50.
    let S = { x: 0, y: 0, z: 50, f: 1000, s: 0, modal: 'G00', spindleOn: false };

    // Loop through every single line in the G-code string
    for (let i = 0; i < lines.length; i++) {
        const raw_l = lines[i].trim();
        
        // Ignore completely empty lines or the '%' program start/end characters
        if (!raw_l || raw_l === '%') { 
            entries.push({ raw: raw_l, type: 'skip', lineNum: i + 1, state: { ...S } }); 
            continue; 
        }

        // Search for comments wrapped in parentheses, e.g. "(BLADE 1)"
        const cm = raw_l.match(/\(([^)]*)\)/);
        const comment = cm ? cm[1] : null;
        
        // Remove the comments from the line so we are left with pure commands
        const code = raw_l.replace(/\([^)]*\)/g, '').trim();

        // If a comment starts with "OP" or "BLADE", record it as a major Operation milestone
        if (comment && /^(OP|BLADE)/i.test(comment)) {
            ops.push({ name: comment.trim(), lineIdx: entries.length });
        }

        // If the line was *only* a comment with no actual code, skip moving forward
        if (!code && comment) { 
            entries.push({ raw: raw_l, type: 'comment', comment, lineNum: i + 1, state: { ...S }, opName: ops.length ? ops[ops.length - 1].name : '' }); 
            continue; 
        }

        // Create an 'entry' object that will represent this specific movement
        const e = {
            raw: raw_l, type: 'move', lineNum: i + 1, comment,
            opName: ops.length ? ops[ops.length - 1].name : '',
            gcode: null, i: null, j: null, m: null, fromState: { ...S }
        };

        // Split the command string by spaces (e.g. ["G01", "X10", "Y5"])
        for (const tok of code.toUpperCase().split(/\s+/)) {
            if (!tok) continue;
            
            // l is the letter (e.g., 'X'), v is the numeric value (e.g., 10.0)
            const l = tok[0];
            const v = parseFloat(tok.slice(1));
            
            // Update the machine state based on the letter
            switch (l) {
                // G-codes handle the type of move
                case 'G': 
                    const n = parseInt(tok.slice(1)); 
                    // G00=Rapid, G01=Linear Cut, G02=CW Arc, G03=CCW Arc
                    if ([0, 1, 2, 3].includes(n)) { 
                        S.modal = 'G0' + n; 
                        e.gcode = S.modal; 
                    } 
                    break;
                // X, Y, Z update spatial coordinates
                case 'X': S.x = v; break; 
                case 'Y': S.y = v; break; 
                case 'Z': S.z = v; break;
                // I and J are relative arc center offsets for G02/G03 circles
                case 'I': e.i = v; break; 
                case 'J': e.j = v; break;
                // F is Feedrate (speed of cutting), S is Spindle Speed (RPM)
                case 'F': S.f = v; break; 
                case 'S': S.s = v; break;
                // M-codes handle machine functions like turning the spindle on/off
                case 'M': 
                    e.m = v; 
                    if (v === 3 || v === 4) S.spindleOn = true; 
                    if (v === 5) S.spindleOn = false; 
                    break;
            }
        }
        
        // Save the final state to the entry. This lets the simulator know exactly 
        // where it needs to be by the end of this command line.
        e.toState = { ...S }; 
        e.gcode = e.gcode || S.modal;
        
        entries.push(e);
    }
    
    return { entries, ops };
}
