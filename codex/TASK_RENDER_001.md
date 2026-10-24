# TASK_RENDER_001 — Code graphics proof for The X-plorator

**Objective:** translate art bible/moodboard into visually credible REAL browser-rendered code, not another AI image or generic shapes. First inspect AGENTS.md, docs/ART_BIBLE.md, docs/PROCEDURAL_RENDERING_STRATEGY.md, docs/GRAPHICS_PERFORMANCE.md and current P0 official docs.

### Step 0: Compatibility audit
Read https://project0.city/skill.md, guides/games.md, guides/assets.md. Document exact SDK method signatures, render-loop ownership, post-process/restricted dependencies, packaging. If unavailable use an isolated local test harness. **No speculative P0 APIs. No publish. No STARBOX #696 changes.**

### Step 1: Real GPU proof
Build one maintainable shader-driven planet factory from a shared SphereGeometry and ShaderMaterial. Three types: oceanic, volcanic, frozen. Surface: palette gradients, seeded noise, light terminator, thin rim, ring variant. Show actual screenshots and shader controls. If shader fails compile, report it and debug; do not substitute a generated illustration.

### Step 2: Procedural mesh proof
Build ONE attractive silhouette-driven spaceship from programmatic 3D primitives with sockets for engines/cargo/miner. Create 150+ instanced low-poly asteroids (or adjust after measuring). Make at least one recognisable 3D hex base module and a 7-hex joined layout. Geometry must be inspectable as real mesh, not billboard image.

### Step 3: Camera A/B experiment
From SAME sector, SAME planet positions and SAME ship geometry create:
- Mode A perspective chase (free pitch/yaw/roll).
- Mode B elevated orthographic / 2.5D (roam across plane).
- Build mode camera (orthographic hex-grid).
Switch cameras without rebuilding the world. Document limitations of each.

### Step 4: Quality and review
Actual desktop and 360px mobile screenshots, brief interaction evidence, measured FPS/frame time and draw calls, low/medium/high quality selector, readable HUD and touch input plan. Identify 3 biggest visual differences from reference art and fix at least 1. Verify reproducibility of planet profile seeds.

### Exit gate
Open a draft PR with screenshots and precise test results, stop for owner design approval. **No P0 release, ATT payments, economy, multiplayer, walkers, PvP or other scope creep.** Restore working branches/checkpoints if anything breaks.