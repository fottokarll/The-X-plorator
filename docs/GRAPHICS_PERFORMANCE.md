# Procedural Graphics Performance Plan

All budgets below are *initial diagnostic goals*, **NOT confirmed Project 0 quotas or guarantees**. Real browser/phone measurement rules.

## Test matrix
Test 1280x720 desktop, 1920x1080 desktop, 360x800 phone portrait, 800x360 phone landscape; real Android Chrome/Brave and desktop Chromium/Firefox as available. Profile both flight views, close planetary pass, dense asteroid belt and hex build mode.

Targets: aim 60 FPS desktop, 30 FPS+ lower/midrange mobile and 60 FPS where capable. FPS alone is insufficient: capture median/p95 frame time, draw calls, triangles, frame allocation spikes and resolution.

## Starting experiment limits (tune based on measurements)
- Mobile internal pixel ratio 1.0; desktop 1.0-1.5, dynamic when necessary.
- Initial warning >150 draw calls mobile or >300 desktop, or >150k visible triangles mobile / >500k desktop. NOT hard universal requirements.
- Keep 1-3 detailed planets visible; distant bodies use cheaper approximations.
- Reuse shared material and geometry; instanced asteroid chunks and buffered stars.
- Avoid shadow maps, SSAO, extensive alpha layering, expensive full-screen effects until basic shader/scene proven.
- Shader fBM iterations and ring alpha overdraw must be tunable.
- Precompute immutable planet profiles from seeds rather than regenerating meshes every frame.
- Render loop updates transforms/uniforms only; do not recreate geometry/material every frame.

## Instrumentation
Three.js (only if compatible with P0 renderer): `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.memory`; elapsed frame times measured in real browser. Do not claim GPU performance from a 2D Canvas fallback. Report actual resolution, quality preset, device/browser, warmup duration and screen capture.

Fallback steps when frame budget fails: reduce pixel ratio → drop bloom → simplify fBM → simplify translucent atmosphere → reduce instance count/LODs → cache combined station meshes. More shader detail should be accepted only if before/after visual benefit exceeds measured cost.

Log shader compilation/context failures and handle unsupported WebGL2 with a clear message or fallback rather than a black screen.