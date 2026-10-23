# Art Bible v0.3 — LOCKED cosmic art direction

## Locked visual north star
Owner-approved **IMG 7**: tranquil *blue-violet luminous space ocean*. Avoid flat black. Giant cyan/azure planet rim glow, indigo/violet haze, delicate lilac nebula, sparse star specks, atmospheric shafts, soft bloom, tiny graceful white spaceship with cyan engine trail. Deliberate negative space, painterly gradients and restrained sci-fi UI. Other mockups are for MENU/HANGAR/BUILD/FLIGHT LAYOUT only, NOT new art styles.

## Palette, illustrative shader parameters
- Deep indigo `#071631`, violet `#1B205A`, cosmic blue `#123C85`.
- Azure `#2189C9`, rim cyan `#70E2F4`.
- Nebula lilac `#985DC8`, blush `#E5A1CF`, warm sunrise `#F5D5B0`.
- HUD `#E6F6FD`, muted amber accent `#F8BD78` for secondary focus.

## Visual layering
1. Large quiet colour field / blue-to-violet starfield.
2. Huge soft-lit planet with thin luminous rim, orbital curves and distant haze.
3. Sparse faceted asteroids/crystals and atmospheric particles.
4. Small clear high-contrast spaceship and natural-looking boost trail.
5. Elegant vector-like HUD with limited visible controls.

## Technology
Low-poly 3D meshes, GPU shaders, seeded planets, instanced rocks, simple glow/limited full-screen passes, vector HTML/CSS/SVG for interface if platform permits. We do NOT need PNG or GLB for initial code-art test; later selectively authored meshes permitted if runtime quality misses visual target. Concept image is not a screenshot from a real running game.

## Camera and composition across devices
- **PC landscape:** free 3D chase camera with optional wide/cinematic pullback, spacious unobstructed central flight region.
- **Phone landscape:** same gameplay but compact HUD at corners, left touch-stick, right touch actions, primary target above ship with safe thumb zones.
- **Phone portrait:** reframe camera, shrink/or reposition distant background objects based on composition, move ship to a thumb-safe zone; bottom controls and collapsible mission panel. No stretching or zoom/crop that hides gameplay; must remain playable.
- **Build:** orthographic hex isometric camera, multi-row build tray or bottom-sheet modal on phone.
- **Hangar:** ship top view and equipment arranged into scrollable touch-friendly cards, not desktop 7-sidebars shrunk to 360px.
- **Map:** free pan/zoom and touch-friendly selection; desktop node view can be spacious.

## Sound and accessibility
Original/licensed soft piano and ambient synth, sound unlock on user gesture, mute/reduced motion, readable contrast and scalable UI. Avoid copyrighted ABZU music/art.

## Visual quality tests
Real running-code screenshots for desktop 1920×1080, phone portrait 390×844 and phone landscape 844×390, all from same seed; no generated images masquerading as in-game captures. Check that small ship remains readable and planet focal glow remains identifiable at lower-quality presets. Record actual FPS/frame pacing where available.
