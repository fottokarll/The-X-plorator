# TASK_INPUT_001 — browser gamepad + TV / optional Xbox test

Context: **PC browser first**, gamepad as secondary; Xbox Edge target optional and unverified. Read `docs/PLATFORM_TARGETS.md`, `AGENTS.md`, `docs/DECISIONS.md`, `docs/ART_BIBLE.md` and the current P0 documentation first.

## Input architecture
- Implement action-based controller input independent of Three.js/P0. Example pure module: `src/input/gamepad.js`.
- Poll controller during existing game loop (NOT extra renderer loops), handle user gesture/focus and `getGamepads` unsupported safely.
- Use standard mapping, with adjustable deadzone and sensitivity. Normalize left stick yaw/pitch, right stick camera movement, RT thrust, LT brake, RB boost, LB+left-stick horizontal roll, A interact/dock, X scan, Y map, B back, Start pause.
- UI focus and D-pad control in pause/main/hangar/build/galaxy menus. Avoid relying on hover/pointer.
- Do not override P0's input layer or lock pointer if the platform handles input; adapt only after verified API audit.
- Disconnect gracefully; preserve keyboard/mouse play.
- Two-controller discovery can be exposed now for future **standalone** co-op; don't invent networking or P0 player identities.

## TV / Xbox acceptance
- Validate on PC with real Xbox controller, with Xbox-like 16:9 TV viewport and visible focus for navigation.
- Real Xbox Edge on Series X|S is a **manual compatibility check**; don't assert it works before physically testing.
- Compare standalone browser vs P0 sandbox. If P0 lacks Gamepad permission, report it and create safe fallback; do not attempt to break out of the sandbox.
- Responsive HUD: 1920x1080, 1280x720, mobile 360x800. Buttons reachable without mouse; onscreen hints switch by detected input.
- Test no-controller, connection, disconnect, deadzone, held triggers, menu navigation, menu not scrolling page when controller is focused.

## Family mode requirements
- Child testing must use a local or independent age-appropriate standalone build. P0 requires users 16+; don't create a P0 account for younger players.
- Initial couch co-op should be a **design experiment**: single shared scene, 2 controllers or keyboard+controller, navigator/scan helper role, without multiplayer platform dependencies. Actual code is a later task.
- For standalone mode, ATT labels/buttons are hidden and nonfunctional. Do not promise shared P0 progress.

## Quality gate
Provide source changes, tests, screenshot(s) and real controller session results in draft PR; no production P0 or Xbox deployment without owner approval.
