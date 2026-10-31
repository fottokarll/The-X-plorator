# Changelog

## 0.3.2-m2 — 2026-10-31 (live on lot #323)

### Changed
- The name players see is now **The-X-plorator** (owner request): the city's experience name and
  credits, the lot name "The-X-plorator · Launch Beacon" and its description, the main menu logo, the
  prologue header and panel 7's caption, the standalone page. The coloured X stays. Save keys, log tags
  and the lot's neon sign ("X-PLORATOR", uppercase stroke letters) are unchanged.

### Fixed
- Phone prologue: the caption plate shrinks its text to fit the frame (the longer panel 7 caption
  touched the edge at 390 px).

### Published
- Experience `4254c6d684ea9bdb` from `e48f752` (submission 13536) and the street build with the new
  name (submission 13534, geometry unchanged: `02a57ea8b72b7df5-dc28e6a7f6bd1a2c`), both `200 live` with
  no warnings, owner-approved. Tag `m2.1-live-lot323`.

## 0.3.1-m2 — 2026-10-26 (owner playtest fixes; live on lot #323 since 2026-10-29)

### Published
- Lot #323 runs M2 with the owner's approval (29 Oct 2026): experience `eb537c7b15a1fbb5` from `0a649d5`
  (submission 13114, `200 live`, server validation 0 errors and 0 warnings), tag `m2-live-lot323`. The
  street build was unchanged and was not republished. Lot #696 untouched.

### Fixed
- **Prologue balloons covered people** (panels 1, 2, 3 and 5 on the desktop page): a line that does
  not fit the drawn balloon now gets a balloon of the game's own only inside that balloon's measured
  free room (no people there, below the caption plate), with its tail on the drawn tail's tip; the
  text gets smaller before the balloon grows. Checked at eight screen sizes.
- **The opening radio lines went by too fast** ("I didn't even notice it and it disappeared"): no
  tutorial line moves on by itself any more. The first flight opens with an *Incoming transmission*
  briefing: the ship holds, each line types in and waits for Continue (Space / E, A, tap); Skip is a
  small corner link. New lines on the HUD card glow for a moment.

### Changed
- Mira and the pilot portraits are redrawn in the prologue's comic style (ink outlines, large eyes,
  white-and-orange crew uniforms); Mira is modelled on the hangar engineer of panel 4.

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
