# Procedural Rendering Strategy — The X-plorator
Status: technical design / visual R&D, **not a finished game or a verified P0 integration**.

## Visual principle
Our AI concept boards are high-level art direction, not screenshots of runnable code. Copy the *visual grammar* — silhouettes, beautiful negative space, palette, lighting, rich planets, calm atmosphere — rather than attempting to reproduce every painted rock and tree pixel-by-pixel. Primary palette: #090E22, #16283D, #31C7C4, #E65C93, #F08A75, #F8C88D.

## Official Project 0 integration gate
Before coding an SDK adapter, read:
- https://project0.city/skill.md
- https://project0.city/guides/games.md
- https://project0.city/guides/assets.md

Record renderer ownership, Three.js version, frame-loop ownership, game packaging, render targets, mobile, shader use and session APIs with verified signatures in P0_API_AUDIT_VERIFIED.md. These Markdown pages were not readable in our browser environment. **Never add an independent WebGLRenderer, competing animation loop, arbitrary EffectComposer or second canvas into a P0 experience until integration is verified.** A local standalone renderer test is fine.

## Scene layering
1. Background: gradient starfield and large atmospheric distant planets (cheap uniforms/noise). Use sector coordinates, never one enormous universe coordinate system.
2. Playable 3D space: original low-poly modular spaceship, asteroid field, resource crystals and one station.
3. Landmark planets: SphereGeometry + ShaderMaterial/GLSL palette bands, gently warped procedural noise, simulated terminator, Fresnel-style rim highlight, translucent optional ring geometry. Same shared sphere shader supports multiple planet types via uniforms.
4. Orbital stations: hex snap grid and reusable 3D hex module kits; align modular ports using axial hex coords q/r, do not manually position each tile.
5. GUI: HTML/CSS/SVG if permitted by P0, with legible phone-size labels, 44px target buttons, strong contrast, safe area, mute and reduced motion.

## Which objects to write as pure code
| Object | Construction | Cost control |
|---|---|---|
| Planet | Shared sphere geometry + custom shader | 1 core shader with palette uniforms; limit costly fBM |
| Ring | Annulus, alpha or additive bands | Limit transparency overdraw and sorting |
| Starfield | Buffered points / batched sprites | Avoid one draw call per star |
| Asteroids | Low-poly IcosahedronGeometry + InstancedMesh | Batch hundreds of transforms, colors |
| Ship | Cached wedge/box/cone/cylinder geometry and modules | Clear silhouette first, details later |
| Hex base | Hex tile mesh + six connector sockets + 6-10 prefab variants | Reuse geometry/material and snap in grid |
| Atmospheric scene | Fake depth layers, colored fog, shader rim and subtle glow | Avoid full volumetric simulation |
| HUD | HTML/CSS/SVG | Keep interface separate from 3D scene |
| Piano / ambient | Original or properly licensed audio | Audio starts after user interaction |

### Sample procedural architecture
```
P0 verified lifecycle OR local test harness
  -> SceneController
       -> SectorFactory(seed)
       -> PlanetFactory(profile, sharedGeometry, shaderUniforms)
       -> AsteroidField(instanced shared mesh)
       -> ShipFactory(componentSlots, cached geometry)
       -> HexBase(grid coordinates, cached modules)
       -> CameraRig(mode: 'perspective-flight'|'orthographic-flight'|'orthographic-build')
       -> EffectsQuality(low|medium|high)
       -> HUD / accessibility / telemetry
```

## Camera decision requires a real A/B implementation
- **Full 3D perspective:** unlimited pitch/yaw/roll/free flight, camera behind ship. Highest exploratory freedom and challenging camera/control design.
- **2.5D isometric/orthographic:** STILL 3D meshes, but camera fixed above a largely planar 3D sector; ship freely roams in plane, with fake height and bank effects. Better composition and often easier mobile input, but not true unrestricted axial flight.
- **Build mode:** orthographic hex-grid camera in both approaches.
Use the **same planets, same ship geometry and same sector seed** for both flight cameras. Measure usability, performance and look with REAL captured screenshots and a working control test.

## What cannot be obtained 'for free' from code
- Hand-crafted hero assets, distinct mature biome silhouettes, plants, carved cliffs and intricate spacecraft plating all require either substantial procedural modelling time or authored/imported 3D meshes.
- A shader-painted distant world does not include explorable 3D terrain on its surface. Surface scenes are a separate technical phase.
- Multiple transparent atmosphere shells, glow passes and complicated noise functions may overwhelm mobile GPUs.
- A beautiful AI-generated static poster does not prove camera-space shadows, animation, 3D geometry, frame pacing or accessibility.

## Implementation sequence
A. One beautiful shader planet + 3 palette presets; screenshot real shader output.
B. One distinctive low-poly 3D ship with swappable modules, plus instanced asteroids.
C. Two flight cameras in same scene; compare visually and interactively.
D. Seven connected hex modules + simple building preview, day/night palette and mobile HUD.
E. Profile, simplify, review with owner. No live multiplayer, ATT checkout, expensive effects or public publishing during visual R&D.

## Code references
- Three.js ShaderMaterial: https://threejs.org/docs/pages/ShaderMaterial
- Three.js InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
- Three.js BufferGeometry: https://threejs.org/docs/pages/BufferGeometry.html
- Three.js WebGLRenderer info: https://threejs.org/docs/pages/WebGLRenderer.html

The separate downloadable **Code Visual Lab 001** is an educational, entirely code-drawn 2.5D test. It is NOT a live P0 game nor a substitute for the true 3D prototype.