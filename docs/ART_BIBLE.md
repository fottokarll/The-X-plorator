# Art Bible v0.2 — LOCKED visual direction

## Visual north star: user-approved IMG 7 (October 23, 2026)
**Ethereal blue-violet space ocean.** Deep cobalt / indigo / violet instead of flat black; large serene azure planets rim-lit in cyan/pink, delicate stellar dust, layered parallax haze, sculpted low-poly asteroids, soft bloom and luminous shafts. The tiny, graceful white spaceship is the protagonist and visual scale anchor, almost swimming through space with fluid drifting/boosting. Calm, hopeful, beautiful and restrained rather than an aggressive neon arcade. This style is LOCKED; do not reinterpret it based on the earlier UI examples.

The previous example screens supply **LAYOUT references only**:
- Main menu + starting vessel/purchasing cards.
- Hangar viewed mostly from top, neat equipment slots and inventory.
- Modular hexagonal orbital outposts floating in space.
- Small-ship flight and chase-behind-ship camera options.

The AI concept screens are visual targets, **not gameplay captures or code implementation evidence**. Don't upload or reuse third-party reference art without permission.

## Palette — starting shader references, not exact sampled proof
- Blue-black indigo `#071631`, deep violet `#1B205A`, cosmic blue `#123C85`.
- Rich azure `#2189C9`, rim cyan `#70E2F4`.
- Nebula lilac `#985DC8`, pink glow `#E5A1CF`, warm sunrise `#F5D5B0`.
- HUD off-white `#E6F6FD`, attention orange accent `#F8BD78` only as secondary.
Avoid high-density noise everywhere. Compose with large calm blue areas and one luminous focal planet.

## Scene hierarchy
1. Empty space with soft blue-violet gradient and minimal star points (negative space).
2. Giant distant/close planets with layered rim Fresnel gradients and atmospheric glow.
3. Midground asteroid belt and select crystal rocks; distant layers desaturated, foreground silhouette.
4. Small high-contrast white spacecraft with soft cyan engine trails and readable orientation.
5. Minimal glassy vector HUD overlay with legible TV text, monitor/browser focus and accessibility.

## Code vs assets
Original procedural sphere meshes, gradient/noise shaders, instanced asteroids, volumetric-looking but inexpensive ray approximations, geometric hex modules. No PNG/GLB requirement in visual prototype; if actual real-time screenshots fail quality gate, request selective authored 3D assets before continuing. Not every AI-painted microdetail is possible at constant mobile FPS.

## Lighting
Thin luminous planet rim and selective bloom, 1 dominant directional sun with colour fill, light shafts only in strategic areas, limited translucent layers on browser GPU, bloom and particles scale by quality settings. No full-screen expensive fog as mandatory effect.

## Sound
Original/licensed minimal piano and pads, quiet binaural-feeling ambient movement without using copyrighted ABZU recording/composition. User-gesture audio start, mute and sound volume.

## Cameras
Perspective chase for fluid free-space piloting; distant camera option showing tiny craft against huge planet; orthographic/isometric for bases and experimental 2.5D comparison. Use same assets in tests. Flight remains free 3D preferred.

## Multi-platform visual tests
Desktop 16:9 1280x720 / 1920x1080 FIRST; optional Xbox/TV 10-foot legibility; mobile 360px responsive SECOND. Test true renderer output on real devices, measured frames and screen captures. Do not claim visually generated posters are running code.
