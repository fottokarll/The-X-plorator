# Planet Lab — first functioning code artifact

A small dependency-free, visual 2D demonstration of planet palettes, size, rings, planet class, habitability, resource deposits, and suggested ATT claim price. It shares the deterministic `src/planet-generator.js` module with Node tests. This is NOT 3D gameplay, real purchase UI, or the P0 SDK.

## Run it
From the repository root, use `python3 -m http.server 8080` and open http://localhost:8080/Planet_Lab.html . Alternatively use any static HTTP server. This is needed because ES modules are restricted under `file://` in many browsers.

## Automated tests
Requires Node 22+; `npm test` executes `tests/planet-generator.test.mjs` with Node built-in test runner. Same seed, same world; price proposals remain 2–20 ATT (starter = 0), and deposits are non-negative.

## Scope and safety
- No network/API calls or third-party libraries; all geometry drawn by HTML Canvas 2D and gradients.
- Resource amount, class, proposed price and habitability are mock design data only.
- P0 purchasing and ownership must be implemented separately using verified platform APIs after human approval.
- Palette/seed can later inform procedural 3D shaders, but the image itself is not a 3D preview.
