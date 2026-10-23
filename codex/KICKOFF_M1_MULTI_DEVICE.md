# CODEX KICKOFF — M1 MULTI-DEVICE VISUAL VERTICAL SLICE

**Read this FIRST after checking out the current repository.** This unifies earlier TASK_001, TASK_RENDER_001, TASK_INPUT_001, and TASK_MOBILE_001 into one ordered implementation goal; do not implement all future game features in one pass.

## Authority/order
1. Current owner decisions in docs/DECISIONS.md and **LOCKED** art direction docs/ART_BIBLE.md (IMG 7); menu/hangar/hex references represent LAYOUT ONLY.
2. docs/PLATFORM_TARGETS.md — PC browser primary; **touch phone gameplay in both portrait and landscape REQUIRED**; optional Xbox compatibility.
3. docs/PROCEDURAL_RENDERING_STRATEGY.md if this graphics R&D PR is merged; otherwise inspect that branch/PR #4 rather than guessing.
4. AGENTS.md, docs/GDD.md, docs/ARCHITECTURE.md, official Project 0 skill.md/games.md/assets.md.

## Delivery phases
### Phase A — Audit and boot
Verify current official Project 0 SDK interfaces, supported renderer ownership, touch event permissions and allowed asset/game packaging; record signatures to docs/P0_API_AUDIT_VERIFIED.md. If unavailable, use standalone local HTML+JS+Three.js scene via mock adapter; DON'T invent P0 methods or publish. Confirm how to run and produce a real screenshot.

### Phase B — ONE stunning real scene (Visual Gate)
Construct one small white procedural 3D hero ship and one hero oceanic shader planet amid restrained faceted asteroids, violet/cobalt atmosphere, cyan rim light and minimal dust. Match IMG 7's **visual grammar**, not an overly detailed AI image. Use actual running browser renderer screenshots, **not image generation**. Test performance and visual hierarchy with 16:9 camera.

### Phase C — Actually playable, PC+phone
Fluid chase flight with keyboard/mouse, gamepad optional, pointer-events touch control: left thumb yaw/pitch, right thrust/boost/scan, optional camera look; simplify roll and provide autolevel for phone. Adapt same scene/camera/controls to 360×800 portrait, 844×390 landscape. Phone gameplay must work without rotate-device wall or external pad. Use independent internal render resolution, not stretched UI. Check pointercancel, blur and orientation switch.

### Phase D — Expand only after B/C pass
Add two more distinct shader planet types, 7 hex base tiles with simple placement ghost and isometric build camera, menu/map/hangar structural UI. Do not design large economy or full persistent universe yet.

## Acceptance evidence
- One actual browser video or short demo of live ship flight (real rendered frames, not concept art).
- Three real screenshot sizes: desktop 1920×1080, phone portrait 390×844, landscape 844×390. Same seed/planet composition shown; readable ship/HUD, clear focal lighting in all.
- Tests: flight/input and deterministic planet seeds, no stuck controls, no shader/runtime errors, measured FPS with device/browser named (or explicit measurement unavailable).
- Low/medium/high quality with at least one phone-saving preset, preserving locked style.
- Real P0 API audit, precise changed-file list and TODOs. Never report an untested platform as working.
- Open draft PR, stop for human review — **DO NOT publish to Project 0** or touch STARBOX #696. ATT/payment and child P0 use excluded.

## Explicit priority
FIRST visually beautiful and fluid flight, SECOND accessible cross-device gameplay, THIRD more systems. Neither beauty nor mobile play can be deferred to a post-M1 polish pass.

Read linked issue details: #1, #3, #5, #7. PR foundation #2 and graphics strategy #4 may need merging into main. This file currently lives on input branch PR #6; don't start in bare main before the requirements are merged.
