# Changelog

## 0.3.0-m2 — 2026-10-26 (branch `dev/m2-exodus-comic-ship`, release candidate, not published)

Full report: [M2_UPDATE_REPORT.md](M2_UPDATE_REPORT.md).

### Added
- **Exodus prologue**: the owner's approved seven-beat comic as the loading screen (`"loading":
  { "own": true }`), desktop page / phone portrait / phone landscape layouts from one story array,
  every word as real text from `src/story/strings.en.js`, honest boot progress, BEGIN only when ready,
  SKIP, transcript, retry on errors, replay from the main menu (`docs/EXODUS_PROLOGUE.md`).
- **XPLORATOR_EXPLORER_MK2**: the new white and orange explorer, procedural, three draw calls, same
  gameplay radius as M1; the M1 ship stays for rollback (`docs/SHIP_MK2.md`).
- **First-flight tutorial** with Mira of Haven Control, event-driven, skip/resume/replay; optional pilot
  portrait (`docs/TUTORIAL.md`).
- Music and effects volume sliders; developer performance report; developer ship A/B switch.
- Tools: `audio-loop-check.mjs`, `load-timing.mjs`, `comic-art.py`, `ship-shots.mjs`, ship turntable
  `standalone/ship-viewer.html`, `m2-checks.mjs`, `capture-m2.sh`; 25 new unit tests (61 total).

### Fixed
- Music loop seam (filter start, the streamed music player, resampling at decode) and the mix (effects
  now 8-9 dB under the music; a soft sonar chord replaces the harsh scan) (`docs/AUDIO.md`).
- Foggy, low-contrast vessel previews; white glare on the ship, hangar and station (bloom threshold,
  exposure, materials).
- Overlapping HUD messages on phones; small top-right buttons; a mouse drag switching to the touch HUD.
- Guests' refused saves (HTTP 401) retried all session.
- The final loading message was dropped by the host's 250 ms throttle (bar stuck at 97 %).

### Changed
- Vessel cards: Survivor selected and free; 2/5/10 ATT vessels clearly *locked previews of planned
  ships*; a pressure-free CONTINUE FREE / VIEW OTHER SHIPS check.
- Saves: still version 1, new fields only; M1 saves load unchanged.
- One shared shader program for every white hull (faster start on software renderers).

### Not done / not verified
- Server validation (needs the owner's key), the live city, physical phones and controllers.
- The prologue art is cleaned crops of the approved composites, not production masters.

## 0.2.1-m1 — 2026-10-24 (branch `dev/m1-outer-verge`)

### Published
- Lot #323 is live with the owner's approval: street build `02a57ea8b72b7df5-dc28e6a7f6bd1a2c` and
  experience `2ad35ac72d7916ec` (from `f337a9f`). The review passed with no warnings.
- Lot description: adds "Fly up and press Enter to play".
- `tools/p0-publish.mjs` (lot 323 only) and `tools/live-visit.mjs` (guest visit of the live lot).

### Fixed (validated, not yet republished)
- The desktop flight HUD counters start below the city's fullscreen button in the top-left corner.
- Vessel screen: confirming the already selected Survivor starts the journey.

## 0.2.0-m1 — 2026-10-24 (branch `dev/m1-outer-verge`)

First playable vertical slice, "Outer Verge".

### Added
- Integration branch combining PR #2 (pre-production), PR #6 (input/mobile, lot #323, one-stick
  flight) and PR #4 (procedural rendering research).
- Project 0 experience package in `src/` (verified API only; `docs/P0_API_AUDIT_VERIFIED.md`).
- Procedural IMG 07 world: baked nebula sky cube, shader planet with luminous limb, atmosphere,
  orbital ring, moons, god rays, stars, space dust, instanced asteroids, Cryon/Ferrite nodes,
  hexagonal Haven Outpost.
- Modular code-built ship (7 sockets, visible module levels, 4 vessel shapes), ribbon contrails.
- Distant cinematic follow camera with measured screen-space framing; floating origin so the camera
  stays inside the lot box while the sector spans kilometres.
- Mission "First Light": explore → scan → collect → return → dock; regrowing nodes; free exploration.
- Screens: main menu, vessel choice (ATT placeholders, no payments), HUD, hangar (craft/equip with
  in-game resources), galaxy map, orbital base builder, settings (quality, handling, auto-cruise,
  invert, sensitivity, camera distance, reduced motion, key rebinding), pause, help, dialogs.
- Touch controls (floating stick, Boost/Brake/Scan/Action, drag-look), multitouch without pointer ids,
  Xbox-style gamepad, configurable keyboard; desktop and phone portrait/landscape layouts.
- Saves through `p0.saved`/`p0.save` (validated and size-checked), standalone host with browser
  storage.
- Quality presets, software-renderer detection, warm-up compile, dynamic resolution, NaN-safe bloom.
- Lot #323 street build: launch beacon LOD0/1/2 with live neon shaders and `build.js`.
- Tools: local server, standalone host, Playwright capture suite, end-to-end playtest, dev kit
  drivers (desktop, phone, touch), package builder with rule checks, validate-only scripts.
- 13 new unit tests (36 total).

### Changed
- Shared modules renamed `.mjs` → `.js` (Project 0 package rule); three pinned to r186.
- `assisted-flight.js`: optional gentle auto-level (off in the default profile).

### Verified
- Project 0 server validation for lot 323: experience and street build both `ok`, 0 errors/warnings.
- Official dev kit: runs in the sandbox with no errors; review profile 14 s at 59.4 fps (GPU).
- Nothing published; no ATT transactions; lot #696 untouched.

## 0.1.0 — 2026-10-23
- Created The X-plorator repository and pre-production documents.
- Defined isolated P0 integration audit, M1 task, asset rights and safeguards.
- No live published game or real currency transaction.
