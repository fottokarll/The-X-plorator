# TASK_MOBILE_001 — Real touch gameplay, not scaled screenshots

## Goal
**Phone browser support is required for the first playable build**, alongside primary PC browser gameplay. The locked owner-approved IMG 7 blue-violet ethereal cosmic look must survive mobile quality settings. P0 SDK behavior remains unverified until audited.

## Requirements for Codex
1. Read docs/PLATFORM_TARGETS.md, docs/ART_BIBLE.md, docs/DECISIONS.md, AGENTS.md, codex/TASK_001.md and current official Project 0 skill/games/assets docs.
2. Use ONE simulation/render/ship system for PC and phone. Choose per-device **input/UI/camera/quality layouts** rather than forking mechanics.
3. Integrate pure touch input from `src/input/touch.mjs` into the approved existing game loop using Pointer Events. Construct actual on-screen controls on phone: left joystick (yaw/pitch), right thrust, brake/boost, scan/interact, camera-look region, pause/map; auto-level or simplified roll on mobile.
4. Responsive layouts in portrait 360×800 and 390×844, landscape 800×360 and 844×390, plus desktop 1280×720/1920×1080. Camera recomposes 3D scene; HUD rearranges instead of simply shrinking font/canvas.
5. Minimum touch target ~44×44 CSS px where practical. Respect device safe areas and dynamic browser bars. Prevent gesture scrolling on flight controls only, not global UI. Recover cleanly after orientation change, pause, multi-touch pointercancel and lost focus. No mandatory fullscreen, keyboard or controller.
6. Phone graphics preset automatically lowers resolution/shader cost (limited nebula particles, atmosphere shells, optional bloom off) while preserving blue-violet colour field, elegant planet rim and small recognizable ship silhouette.
7. Menus must be touch navigable: New Game, Galaxy Map, Hangar, Base, Settings. Test touch scrolling, back/close, purchase mock cards as NONFUNCTIONAL (no ATT processing).
8. Document actual real-device or browser emulator results, compare 3 screenshots of same planet/sector, run unit tests, report measured FPS if available. No fabricated testing, no production publish.
9. On mobile, if portrait design is difficult, make it **less detailed but fully playable**, not a blocking 'Rotate phone' screen.

## Definition of done
[ ] Desktop flight and phone flight both function with no second render loop
[ ] Two thumbs can turn/thrust/boost
[ ] 360px menus remain readable and accessible
[ ] Both phone orientations recover correctly after resize
[ ] No stuck thrust after pointercancel/blur
[ ] Actual responsive screenshots and performance report
[ ] Consistent IMG 7 art style
[ ] P0 access/permissions audited; no assumption that sandbox can capture all gestures
[ ] Draft PR awaits visual approval
