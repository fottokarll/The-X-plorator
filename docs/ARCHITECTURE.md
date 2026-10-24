# Technical Architecture v0.1

## Runtime target
Project 0 City immersive playable experience. Prefer browser-based JavaScript/TypeScript and Three.js **if allowed by the current P0 SDK**. Official Project 0 platform integration must be audited first. Prototyping can be local-only with a mock adapter if documentation unavailable. **No Godot runtime** for P0 delivery.

## Modular design
- `platform/`: interface with mock implementation; real P0 adapter only after verified SDK signatures.
- `game/`: authoritative-style state models separated from rendering; saves schema versioned.
- `render/`: procedural planet shaders, ship mesh, asteroid field, station geometry, lighting, camera rigs.
- `flight/`: independent physics/input/controller parameters; fixed timestep where useful.
- `building/`: axial coordinates for flat hex bases, snapping, placement previews and connectivity.
- `world/`: seeded planet catalogue and resource profiles.
- `ui/`: mobile-safe touch overlays, map, settings, live status, accessibility.
- `audio/`: planet sound profiles with user-gesture activation.

## Safety and concurrency
Player-profile persistence is NOT the same as a server-authoritative shared universe. Cross-player planet claims must be atomic or are NOT released. Separate gameplay resource units from ATT. Keep secrets server-side, never commit keys. Avoid large infinite world-coordinate floats: use sectors + local floating origin.

## Platform-ready boundaries
Documented interface targets: `getCurrentPlayer`, `readPlayerProgress`, `writePlayerProgress`, `sendSessionMessage`, `purchasePlanet`; THESE ARE CONCEPTUAL adapter responsibilities, **NOT** verified Project 0 method names. Do not implement real adapter until confirmed.

## Performance
Dynamic pixel ratio; instanced star/asteroid meshes where relevant; lean shader complexity; quality tiers; prevent expensive full-screen volumetric passes on mobile. Debug FPS only if measured, not invented.
