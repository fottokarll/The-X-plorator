# Flight Feel Decision — One-stick Assisted Exploration

## User-approved handling (2026-10-24)
ABZÛ was a **VISUAL/ATMOSPHERE** reference (fluid tranquil exploration) and only a loose movement-feel reference. The player strongly dislikes having to hold RT while simultaneously steering with one thumbstick and adjusting camera with another. We will **not reproduce ABZÛ's controls**; REA binary analysis is NOT required to prototype these originals.

### Standard Xbox-style controller, PC/browser
- LEFT STICK: steer ship (yaw/pitch), with smooth response and automatic bank. No second stick required.
- AUTO CRUISE: maintaining pleasant forward momentum with no continuous RT hold; optional toggle off while docking.
- RT: temporary acceleration/boost; RB can optionally duplicate it where browser shortcuts permit.
- LT: gradual brake/stop. A: interact/dock. X: scan. Y: galaxy map. Start: pause.
- RIGHT STICK: **optional look around**; releasing stick recentres view behind ship smoothly. No compulsory camera management.
- Camera tracks ship orientation/position automatically with lag and collision-avoidance to be engineered and playtested.
- Offer accessibility controls: sensitivity, invert Y, auto-level, auto-cruise toggle, camera lag/recenter speed, reduced motion.
- Xbox Edge is experimental: some buttons conflict with browser shortcuts; verify on hardware.

### Mobile browsers
- LEFT touch joystick: yaw/pitch; **cruise means no need to hold a thrust button**.
- Right action zone: Boost, Brake/Stop, Scan/Interact. Optional drag to free-look; release recentres.
- Both portrait and landscape genuinely playable; adaptive chase camera and thumb-safe HUD.

### Keyboard PC
- WASD/arrow for steering, Space/Shift (customisable) boost, Ctrl/S for brake with no conflict, mouse-look optional via hold/right-drag.
- No mandatory mouse aiming.

### First technical implementation
`src/flight/assisted-flight.mjs` includes an independent experimental flight state and damped follow-camera model. Inputs are semantically mapped from `src/input/gamepad.mjs`, `src/input/touch.mjs`, and future keyboard layer.
Initial rates are **original uncalibrated values**; six Node unit tests validate basic behavior, not play feel, 3D visibility, or P0 compatibility.

### Next proof
Same ship and planet, two optional handling presets (responsive versus tranquil), measured turn time and stop distance; visual camera lag and scan/dock accuracy. REA limited to permitted observation/authorized targets for insight; no ABZÛ executable disassembly by default.
