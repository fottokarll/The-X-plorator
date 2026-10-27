# M2 update report: THE X-PLORATOR v1.1 polish + v1.2 Exodus prologue, new ship and tutorial

**Release candidate on branch `dev/m2-exodus-comic-ship`. Nothing was published.** Lot #323 still
runs the M1 build; lot #696 was not touched; no ATT was spent; no Project 0 key was used or stored.

**Test this first:** run `npm start`, open **http://127.0.0.1:5500/?fresh=1** on your PC with sound
on, read the prologue to *BEGIN THE EXODUS*, then start a New Journey and follow Mira through the
first mission.

Then, in this order:
1. On your phone (same Wi-Fi, `npm start -- --host 0.0.0.0`, open `http://<PC IP>:5500/?fresh=1`):
   the prologue in portrait, rotate to landscape, then fly. Listen to the music for a full minute or
   more (it loops every 24 s): is the seam gone, and is the balance right at your usual volume?
2. Settings: the Music and Effects sliders, mute, Pilot portrait; Developer → Ship model to compare
   the new Explorer Mk2 with the M1 ship.
3. The hangar, the orbital base and the vessel cards: is the white still clean (no glare)?
4. The official dev kit (link in RUN.md), desktop and `&phone=1`.
5. If you like it: run the free server validation with your key, then approve a publish
   (docs/P0_PUBLISH_CHECKLIST.md). I will not publish without your explicit go-ahead.

### Owner playtest, round 1 (26 Oct 2026): three notes, three fixes

| Your note | What was wrong | Fix | How it was checked |
|---|---|---|---|
| *"In some images text in the bubble covered people"* | When a line did not fit the drawn balloon at the game's minimum size, the game drew a bigger oval centred on it. On the desktop page at 1920 and 1280 px that oval covered faces in panels 1, 2, 3 and 5 (panel 3's was also cut by the caption). | Each balloon now has a **free room**: plain background measured on the panel, no people in it. A bigger balloon may only grow there, below the caption plate; the text gets smaller before the balloon grows onto anyone. Its tail ends on the drawn tail's tip. The page keeps the comic's own lettering size where it fits. | All 7 panels captured at 1920 × 1080, 1366 × 768, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844, 360 × 800 and 844 × 390: no balloon over a face. |
| *"At the beginning it is too fast, I didn't even notice it and it disappeared, and I was answering back"* | Haven's first lines changed by a reading timer (about 4 s), in a small card at the side, while the ship was already flying: you saw your own reply without having read Mira. | No tutorial line moves on by itself any more. The first flight opens with an **Incoming transmission** briefing at the bottom of the screen; the **ship holds position**; each line types in and waits for **Continue** (Space / E, controller A, tap or click). The last button is *Take the controls*. *Skip tutorial* is a small corner link. Later lines stay on the HUD card until their task is done, with the radio chirp and a short glow. | Unit test; keyboard playthrough (ship position unchanged while the briefing is open); controller check with A; phone portrait and landscape with taps. |
| *"On the image should be a character similar to those from our comic"* | Mira and the pilot portraits were flat, simple shapes. | Redrawn in code in the **prologue's style**: ink outlines, large eyes with highlights, flat colour with one shade, the fleet's white-and-orange uniforms. Mira is modelled on the hangar engineer of panel 4 (bun, round glasses, crew jacket with an orange patch) and has a headset. The woman, man and visor pilot options use the same style. | Rendered at every size used (HUD card, briefing, phones). |

---

## 1. Baseline, branch and commits

Verified before starting (25 Oct 2026, `git fetch`, `gh pr list`): `dev/m1-outer-verge` = `0c23a19`,
identical to `origin/dev/m1-outer-verge`; draft PR #9 open; no newer commits anywhere. The previous
report was accurate: lot #323 runs the experience published from `f337a9f`, and `0c23a19` adds two
validated UI fixes that were never published.

| Tag (pushed) | Commit | What |
|---|---|---|
| `m1-live-lot323` | `f337a9f` | the build live on lot #323 (experience `2ad35ac72d7916ec`) |
| `m1-baseline` | `0c23a19` | M2 starting point (M1 + the two unpublished UI fixes) |

Branch **`dev/m2-exodus-comic-ship`** (from `0c23a19`), commits oldest first:

| Commit | Gate | Summary |
|---|---|---|
| `c016db3` | A | M1 baseline screenshots for the before/after comparison |
| `36ccaf8` | A | Seamless music loop, balanced mix, soft sonar scan, music/effects volumes |
| `6042f26` | A | Legible vessel choice, honest previews, no white glare, calmer HUD, dev performance report |
| `fb876ef` | B | Prologue art pipeline, story text by id, boot state |
| `00658c5` | B | The prologue is the loading screen; BEGIN leads to the main menu |
| `c6e2555` | C | XPLORATOR_EXPLORER_MK2, the white and orange explorer |
| `3633752` | D | First-flight tutorial with Haven Control |
| `d7a99b0` | E | Software-renderer boot parity, prologue framing, review findings |
| (last) | E | This report, docs, measurements, screenshots |

## 2. Gate status

| Gate | Status | Notes |
|---|---|---|
| **A** Audio, UI, lighting, ship cards, HUD | **DONE** | Safe areas: fixed margins (a worker cannot read the device's insets). The guest 401 path was verified with a simulated guest, not in the city. |
| **B** Exodus prologue in the real boot | **DONE** with prototype art | Every word is real text from a data file; the art is cleaned crops of the approved composites, not production masters (section 9). |
| **C** New 3D ship | **DONE** | Procedural Explorer Mk2 everywhere the Survivor appears; M1 kept for rollback/A-B. |
| **D** Tutorial and pilot identity | **DONE** | Pilot identity is the optional portrait in Settings (non-blocking); there is no pilot picker at New Journey. |
| **E** Validation, screenshots, report, PR | **DONE**, except server validation | `npm run p0:validate` needs your key (not provided in this session). |

Touched files (beyond `docs/` and `docs/media/`):
- **A**: `src/game/audio.js`, `src/game/profile.js`, `src/assets/audio/*.wav`, `tools/generate-audio.mjs`, `tools/audio-loop-check.mjs`, `standalone/host.js`, `src/game/game.js`, `src/game/ships.js`, `src/input/input-hub.js`, `src/render/pipeline.js`, `src/render/station.js`, `src/ui/{base-builder,hangar,hud,kit,screens,ui,perf-report}.js`, `tests/m2-audio.test.mjs`, `tools/play-loop.mjs`.
- **B**: `src/experience.json`, `src/story/{strings.en,story,story-state,art-layout}.js`, `src/boot/boot-state.js`, `src/ui/story-screen.js`, `src/assets/comic/{wide,tall}/panel_0[1-7].webp`, `src/game/game.js`, `src/ui/{kit,screens}.js`, `tools/comic-art.py`, `tools/load-timing.mjs`, `tools/{capture,devkit,play-loop}.mjs`, `tests/m2-story.test.mjs`.
- **C**: `src/render/{ship-mk2,ship-builder,ship-model,world,station}.js`, `src/game/game.js`, `standalone/ship-viewer.{html,js}`, `tools/ship-shots.mjs`, `tests/m2-ship.test.mjs`.
- **D**: `src/tutorial/{tutorial,text.en}.js`, `src/ui/{portraits,hud,screens}.js`, `src/game/{game,profile,audio}.js`, `src/assets/audio/radio.wav`, `tests/m2-tutorial.test.mjs`.
- **E**: `tools/m2-checks.mjs`, `tools/capture-m2.sh`, `src/story/story.js`, `src/ui/story-screen.js`, docs.

### What changed, in short

**Gate A**
- **Music loop**: three real causes found and fixed (details in section 7). Effects 8-9 dB under the
  music (the scan was about 8 dB louder than the music, collect 11). New scan sound: a soft, airy
  D major add-9 chord that pulses three times and fades; warmer, quieter collect, dock and UI cues.
- **Settings**: Music volume and Effects volume sliders (arrows, drag or tap; Space mutes; mute keeps
  the level and pauses the music in place). Saved for signed-in players, kept for the session for guests.
- **Vessel choice**: the Survivor is selected by default with a SELECTED badge; crew and cargo on every
  card; the 2/5/10 ATT vessels say *Locked preview · N ATT planned* and the intro says nothing can be
  bought. The ships sit in clear windows on a dark stage (M1 drew a 35 % veil over them). Starting asks
  once, without pressure: **CONTINUE FREE** / **VIEW OTHER SHIPS**, two equal buttons.
- **No white glare**: bloom threshold 1.5 instead of 0.92 (sunlit white hulls and decks bloomed), lower
  bloom and exposure in the hangar, vessel cards and base, a softer station material. The flight look
  (planet limb, crystals, engines) is unchanged (compared side by side).
- **HUD**: objective, warning, toasts and scan card stack instead of overlapping on phones; 46 px
  top-right buttons on phones; fixed side margins in landscape; long text fits instead of overflowing.
  Fixed: a mouse look-drag switched the desktop HUD to its touch layout.
- **Guests**: after the first refused save (HTTP 401 in the city) the game stops saving for the
  session, says so once and plays on (verified: one save attempt per guest session).
- **Developer performance report** (Settings → Developer, or `?perf=1`): CSS view, DPR, 3D render size
  and effective scale (quality × dynamic × software), quality, fps/avg/p95/max, whole-frame draw calls
  and triangles, GPU string, interface canvas size. First finding with it: on this PC at 1280 × 720 the
  dynamic resolution had dropped to 0.61 (3D at 786 × 442), so on weak GPUs softness comes from render
  resolution, not from the models.

**Gate B: the Exodus prologue** (`docs/EXODUS_PROLOGUE.md`)
- Seven beats, one story array, three layouts: the approved desktop **page** (panels clipped to their
  angled outlines, white gutters, revealed one by one), phone **portrait** (one framed panel per step
  with a narration card) and phone **landscape** (a wide frame with the text beside it). Rotation keeps
  the panel.
- **Every word is real text** (`src/story/strings.en.js`, stable ids, image descriptions included):
  the baked captions were painted out of the art and the balloon words cleared, so nothing is
  duplicated. Text fits the drawn balloons; when it does not, the game's own balloon grows only into
  the balloon's measured free room, never over people (owner playtest fix, above).
- **Real loading**: `experience.json` `"loading": { "own": true }` (Project 0 then runs the frame loop
  while `start()` works), so the prologue is the loading screen from the first frames. Boot tasks with
  honest progress; *PREPARING YOUR JOURNEY* only on the last panel while the game is not ready; *BEGIN
  THE EXODUS* only when ready, never automatic, never withdrawn. Errors show RETRY (step re-run after
  cleanup) or LOAD AGAIN for a panel image. SKIP STORY, TRANSCRIPT, keys, controller, swipe.
- BEGIN leads to the **main menu** (never into flight); the menu has **Prologue** to replay it.
  Returning signed-in players see a short welcome card; guests see the prologue each visit (no saved
  flag) and can skip it.

**Gate C: the Explorer Mk2** (`docs/SHIP_MK2.md`)
- Procedural, 1,522-1,770 triangles, three draw calls, no textures; built from the turnaround: faceted
  wedge, swept shoulders, tinted canopy, **two** big engine housings with cyan cores and blue exhaust,
  canted fins, sparse orange accents. Module levels still change visible parts; always two engines.
- Same frame as M1 (+Z nose, +Y up); the gameplay radius is the M1 Survivor's for the same loadout, so
  collisions, docking and mining are unchanged. Planned paid vessels keep their M1 preview shapes.
- Settings → Developer → Ship model (or `?ship=m1`) brings back the M1 ship. QA turntable:
  `standalone/ship-viewer.html`.

**Gate D: first-flight tutorial** (`docs/TUTORIAL.md`)
- Mira of Haven Control (an original character, drawn in code in the prologue's comic style) opens the
  first flight with a briefing that waits for the player while the ship holds, then talks the pilot
  through steer → boost and brake → beacon → scan → collect → fill the hold → return → dock → orbital
  base → free exploration. Each step ends only on its real game event; nothing is granted; skip, resume, replay;
  device-adaptive tasks using the player's own keys; a soft radio chirp. M1 saves are not forced into it.

## 3. How to run

| | |
|---|---|
| Install (first time) | `cd ~/The-X-plorator && git checkout dev/m2-exodus-comic-ship && LD_LIBRARY_PATH= npm install` |
| Play in the browser | `npm start`, open http://127.0.0.1:5500/ (`?fresh=1` new start, `?perf=1` performance report, `?ship=m1` old ship, `?guest=1` act as a guest, `?story=1` always show the prologue, `?noown=1` behave like the dev kit) |
| Phone on Wi-Fi | `npm start -- --host 0.0.0.0`, open `http://<PC IP>:5500/` |
| Project 0 dev kit | with `npm start` running: https://project0.city/devkit?entry=http://localhost:5500/main.js&width=16&depth=16&height=30 (add `&phone=1`) |
| Mr Mak | open the THE X-PLORATOR card in Workspace; the commands above work from its terminal |
| Ship turntable | http://127.0.0.1:5500/standalone/ship-viewer.html |
| Tests | `npm test`; `LD_LIBRARY_PATH= npm run playtest -- --hangar` (or `--tutorial`); `LD_LIBRARY_PATH= node tools/m2-checks.mjs`; `LD_LIBRARY_PATH= node tools/audio-loop-check.mjs`; `LD_LIBRARY_PATH= node tools/load-timing.mjs --net fast3g --size 390x844 --touch --three-local`; `LD_LIBRARY_PATH= bash tools/capture-m2.sh`; `LD_LIBRARY_PATH= node tools/ship-shots.mjs` |
| Package (validate only) | `npm run package`, then `P0_KEY_FILE=/path/to/key LD_LIBRARY_PATH= npm run p0:validate` |
| Rebuild assets | `node tools/generate-audio.mjs`; `python3 -I tools/comic-art.py <handoff>/references` |

## 4. Test results

All runs on this Linux PC (4 cores, Intel HD Graphics 6000, Chromium 1248 via Playwright), 26 Oct 2026.

| Test | Result |
|---|---|
| `npm test` | **61 tests, 61 pass, 0 fail** (36 from M1 + 25 new: audio 7, story/boot 7, ship 4, tutorial 7) |
| `npm run playtest -- --hangar` 1920 × 1080, real keyboard only | **PASS**, 0 errors: prologue read with the keys → menu → vessel → free check → opening briefing (ship held position, 3 × Continue) → scan, mine × 2 → return → dock → mission complete → craft + equip Ion Drive II (re-run after the playtest fixes) |
| `npm run playtest -- --tutorial` 1280 × 720 | **PASS**, 0 errors: the briefing opened with the ship holding position and closed after 3 Continue presses; every tutorial step advanced on its own event, ended at the next launch (re-run after the playtest fixes) |
| `node tools/m2-checks.mjs` | **6/6 PASS**: rotation keeps panel 3 (single → cinema); BEGIN never reached the menu before ready under 6× CPU throttling and was still waiting 10 s after ready; controller through prologue, menu, vessel, free check, the briefing (A) and steering; an M1-format signed-in save loaded, continued and kept bank 6/2, engine Lv 2, mission *free*, music muted, with the tutorial off; hangar at Low/Medium/High; every desktop HUD button (boost, scan, base, hangar, map, hangar, pause, resume). The controller check was made robust to slow frames after two runs lost a short simulated press (Project 0 gives controllers as polled state only; M1 behaves the same); after the playtest fixes its first run lost one simulated press in the main menu again and passed on the second run (`checks/report.json` notes both). |
| Fresh guest (`?guest=1`) | 1 save attempt per session, one toast, play continues |
| Slow network | Fast 3G emulation, phone: prologue first, game ready later (section 6) |
| Load failure / retry | `?failboot=world&artfail=2`: boot error with RETRY, then the world step ran a second time and the game became ready; panel 2 *Illustration not loaded* → LOAD AGAIN → loaded |
| Second visit (signed in) | welcome card, then the main menu when ready |
| Skip / replay | SKIP STORY while preparing → last panel, *PREPARING YOUR JOURNEY*, then BEGIN; when ready → menu at once; Main menu → Prologue replays |
| Audio loop × 3 | 76 s recorded, seams found by aligning the recording with the file (correlation 1.000): 0 gaps, seams at 0.56 × p99.9 curvature (section 7) |
| Official dev kit, desktop + `devkit.review(14)` | started in 4.9 s (49 files, 493 KB), **review 59.6 fps, worst frame 27.6 ms, 0 slow frames, 0 errors, 0 violations** |
| Official dev kit, phone + review | started in 3.3 s, **review 59.2 fps, worst 27.6 ms, 0 errors, 0 violations** |
| Dev kit on a software renderer (headless SwiftShader, like the review) | started; review restart in 10.1 s, **6.1 fps, 0 errors, 0 violations** (M1 baseline the same night: 9.1 s, 6.3 fps). First cold start 22.6 s (M1: 21.6 s). Before the fix in `d7a99b0` M2 needed 27 s and the review did not start within 25 s. |
| Official dev kit after the playtest fixes (27 Oct, PC heavily loaded: load average 14-16 on 4 cores from other apps) | 0 errors; the briefing ran in the real sandbox (3 × Space). Cold start 38.0 / 38.9 s, **the same as the last commit before the fixes measured in between (41.2 / 40.5 s)**; shader warm-up 24.2 vs 24.3 s. The review restart did not start within the dev kit's 25 s limit for either build at that load (the earlier build once made it in 22.8 s). The unloaded results above stand; please re-run `npm run devkit -- --review` on an idle PC. With the briefing open the game ran at 31.9 fps, while typing 37.2, then 21.6 in flight (same load, same session): no cost from the panel. |
| `npm run package` | local checks **OK**: 72 files, 462.1 KB JS, zip 2,221.2 KB (after the playtest fixes; before: 71 files, 439.8 KB, 2,213.8 KB) |
| Server validation (`p0:validate`) | **not run**: needs your key |
| Browser console | 0 errors in every run above. Logged by design: `[xplorator]` diagnostics; one-off "slow frame" lines at the start of a journey (about 0.5 s while the ship, station and nodes are rebuilt; M1 rebuilt the same) and during the software-renderer warm-up. |

**Not tested**: physical phones (iPhone Safari, Android Chrome), a real Xbox controller (simulated
standard controller only), the live city (needs a publish), two real accounts, and listening on real
speakers (objective measurements only).

## 5. Screenshots (real renders of the running game)

All in `docs/media/m2/`, captured by `tools/capture-m2.sh`, `tools/m2-checks.mjs`, `tools/play-loop.mjs`,
`tools/ship-shots.mjs` and the dev kit driver. Desktop at DPR 1, phones at DPR 2 with touch emulation.

| | Files |
|---|---|
| Before (M1 baseline) | `before/desktop-1920-{menu,select,flight,hangar,base}.jpg`, `before/phone-portrait-{menu,select,flight}.jpg`, `before/phone-landscape-{select,flight}.jpg` |
| After, desktop 1920 × 1080 | `after/desktop-1920-{prologue-booting,prologue-panel4,prologue-begin,menu,select,free-check,briefing,briefing-reply,flight-tutorial,flight-turn,hangar,base,pause,settings}.jpg` |
| After, 1280 × 720 with the performance report | `after/desktop-1280-{prologue,select,flight-perf}.jpg` |
| After, phone portrait 390 × 844 | `after/phone-portrait-{prologue-1,prologue-3,prologue-7,menu,select,free-check,briefing,flight-tutorial,hangar}.jpg` |
| After, small phone 360 × 800 | `after/phone-360-{prologue,menu,select,flight}.jpg` |
| After, phone landscape 844 × 390 | `after/phone-landscape-{prologue-1,prologue-3,menu,select,briefing,flight-tutorial}.jpg` |
| Ship Mk2, real renders | `ship/mk2-{front,rear,left,right,top,bottom,34front,34rear,flight}.jpg`, Lv 3 loadout `-lv3`, sheet-grey `-grey`, M1 next to Mk2 `ship/both-{34front,top,rear}.jpg` |
| Exposure Low / Medium / High (hangar) | `checks/exposure-hangar-{low,medium,high}.jpg` |
| Checks | `checks/{rotation-portrait,rotation-landscape,ready-preparing,ready-begin,gamepad-flight,oldsave-first-visit,buttons-pause}.jpg` |
| Full loop and tutorial | `playtest/*.jpg` (launch, briefing, scan, mine, return, dock, complete, hangar, upgraded), `playtest-tutorial/{01b-briefing,09-tutorial-last-line}.jpg` |
| Dev kit | `devkit/desktop-*.jpg`, `devkit/phone-*.jpg`, `devkit/software-*.jpg` (prologue, menu, select, free check, flight) + reports |

Best before/after pairs for the video: `before/desktop-1920-select.jpg` ↔ `after/desktop-1920-select.jpg`,
`before/desktop-1920-hangar.jpg` ↔ `after/desktop-1920-hangar.jpg`, `before/desktop-1920-base.jpg` ↔
`after/desktop-1920-base.jpg`, `before/phone-portrait-select.jpg` ↔ `after/phone-portrait-select.jpg`.

## 6. Measured sizes, timings and frame rates

**Package** (`npm run package`, 26 Oct 2026): 71 files; JavaScript 439.8 KB (M1: 305 KB), 132 KB
gzipped; audio 1,479 KB (WAV, see section 9); prologue art 298 KB (desktop set) + 354 KB (phone set,
each device loads one set); zip 2,213.8 KB.

| Asset | Size |
|---|---|
| Prologue panel 1 (first image loaded) | desktop 38.7 KB, phone 46.6 KB |
| Prologue panels 2-7 | 34-61 KB desktop, 41-67 KB phone (table in `docs/EXODUS_PROLOGUE.md`) |
| Ambient music loop | 1,034 KB (24 s, 22.05 kHz mono 16-bit WAV) |
| Effects (7 cues incl. new radio chirp) | 18-112 KB each, 445 KB total |
| Explorer Mk2 | 1,522 triangles (Lv 1) to 1,770 (Lv 3), 3 draw calls, generated in code (0 bytes of asset) |

**Loading** (`tools/load-timing.mjs`, standalone page, cache off, this PC):

| | First prologue frame | Panel 1 drawn | Game ready |
|---|---|---|---|
| No throttling, 1280 × 720 | **0.57 s** | **0.94 s** | **6.1 s** |
| Fast 3G emulation (563 ms latency, 1.44 Mbps), phone 390 × 844, three.js already present (as in the city) | 9.1 s | 10.0 s | 13.5 s |

The Fast 3G figure is pessimistic for Project 0: the standalone page fetches about 35 unbundled,
uncompressed modules one import level at a time, while Project 0 bundles the package on publish (and
its network compresses it). It cannot be measured in the city without publishing. Dev kit (real
sandbox): started in 4.9 s desktop, 3.3 s phone; panel 1 decoded in 105-138 ms inside the worker.

**Frame rates** (shared machine: a desktop browser was using the same GPU, so absolute numbers are
low and noisy; comparisons were interleaved):
- Dev kit review profile (640 × 360, DPR 1): 59.6 fps desktop, 59.2 fps phone; software renderer 6.1 fps.
- Flight 1920 × 1080 High, three interleaved runs each: **M1 baseline 10.6 / 13.2 / 31.7 fps, M2 with
  Mk2 37.9 / 30.0 / 30.9 fps**: no regression visible. Dynamic resolution sat at 0.5-0.6 on this GPU in
  these runs (3D at about 960 × 540 to 1180 × 660 for a 1920 × 1080 window). M1's report measured
  51 fps on a quieter machine.

**Audibility** (objective, not by ear): music RMS in the mix 0.16 at the default 80 %; effects at their
defaults 8-9 dB below it; M1's scan was about 8 dB above the music. Please judge by ear on your
phone and PC (first test above).

## 7. The music seam: what was wrong and how it was tested

1. **The file**: the generator's low-pass filter started from rest: the loop opened at `0.0000` after
   ending at `-0.0862`, a step twice the largest inside the loop. Now the periodic signal is filtered in
   steady state.
2. **The host player**: reading Project 0's sandbox shell (`/sandbox/shell.js`) showed `p0.music` streams
   through an HTML `Audio` element with `loop` (not sample-accurate; volume ignored on iOS), while
   `p0.sound` plays decoded buffers through Web Audio with a sample-accurate `loop`. The pad now plays as
   **one** looping `p0.sound` (never overlapping copies; `p0.music` only as a fallback). Volume changes
   restart it once at the estimated position after the slider settles; mute pauses and resumes in place.
3. **Resampling on decode**: players' audio runs at 44.1 or 48 kHz, so the browser resamples the
   22.05 kHz file on decode and bends its first and last samples. Offline rendering in Chromium showed a
   curvature spike of 0.11 exactly at the seam at both rates and none at 22.05 kHz. The loop now starts
   at a near-silent, flat zero crossing of the same 24 s cycle: afterwards the seam is 0.0007 and the
   sharpest point of the whole render is the music's own content.

**Tested**: unit tests on the file and the playback logic; `tools/audio-loop-check.mjs` plays the game's
music through the standalone host (whose `p0.sound` mirrors the shell), records the real Web Audio
output on the audio thread for three loops and finds the seams by aligning the recording with the
music file (correlation 1.000): **0 gaps; seams at 0.56 × the recording's 99.9th-percentile curvature;
the sharpest point of the recording is the music's own content 5.96 s into each loop (1.26 ×)**. Two
earlier measurement flaws were fixed on the way and are noted in `docs/AUDIO.md` (a main-thread
recorder that faked spikes; seam positions estimated from timestamps, once 11 s off). **Not tested**: inside the
live city or the dev kit (its audio runs in a cross-origin frame that a script cannot record), on phones
and speakers. Details: `docs/AUDIO.md`.

## 8. Saves: guests, signed-in players and old saves

- Saves stay version 1 with **added** fields only (`settings.musicVolume`, `settings.sfxVolume`,
  `settings.pilot`, `settings.perfOverlay`, `settings.shipModel`, `flags.prologueSeen`, `tutorial`).
  M1 saves load unchanged with defaults (unit test + the e2e check with an M1-format save). If a player
  meets an M2 save in the M1 build (players inside the city keep their version until they re-enter), M1
  ignores the new fields.
- **Signed-in players**: settings, the prologue flag and the tutorial step are saved; New Journey keeps
  the prologue flag and restarts the tutorial; old M1 saves are not put into the tutorial (Pause →
  Replay tutorial).
- **Guests**: Project 0 refuses their saves (HTTP 401): the game tries once, says *Guest: progress
  lasts until you leave*, and keeps everything in memory for the session. They see the prologue again
  next visit.

## 9. Risks and limitations

- **Prologue art**: cleaned crops of the approved composites, not production masters. Balloon shapes
  and positions are fixed by the art; the caption plates were painted out algorithmically (soft patches,
  always under the game's own plates); the source resolution is low (desktop panels about 800 px,
  phone panels 902 px wide), so phone frames are upscaled about 3× and look soft. Text-free masters at
  about 2× resolution would replace them without code changes (`tools/comic-art.py`).
- **Public repository**: the processed prologue panels are committed and were pushed to the public
  GitHub repository with this branch. The raw composites, the turnaround sheet and the hero image were
  not committed (they stay in the private handoff). The owner confirmed on 2026-10-26 that the panels
  can stay public.
- **Art rights**: the handoff describes the comic and ship images as AI-generated design studies made
  in your game conversation. Please confirm that the generator's terms allow you to use them in a
  published game; `experience.json` credits the illustrations as AI-assisted and commissioned by you.
  The characters are original; there are no real people, logos or trademarks (no "Elo Max / XSpace"
  either: it was not needed).
- **ATT**: no purchase exists. The 2/5/10 ATT vessels are labelled as locked previews of planned ships.
- **Untested**: physical phones (iOS audio policy in particular), a real Xbox controller, the live city
  (own loading screen, `p0.hud` with `ui: minimized`, two accounts), server validation.
- **Dev kit limitation**: it loads only `main.js`, so it does not apply `loading.own`; the prologue
  appears there once `start()` returns (already ready).
- **Software renderers**: a cold start takes about 22 s on this PC (parity with M1, which passed the
  real review); the reader is in the prologue meanwhile on hosts that apply own loading.
- **Music as WAV** (1 MB): compressed formats would bring encoder padding back into the loop; WAV is
  the format that loops exactly in every browser. It is loaded by the host after the game starts.
- **Interface**: safe areas are fixed margins; the system's reduced-motion setting cannot be read in a
  worker (the game's own setting applies); the canvas interface is not readable by screen readers
  except the text sent to `p0.hud` (the current prologue panel); a one-off frame of about 0.5 s when a
  journey starts.
- **Pilot identity**: an optional portrait in Settings (visor, woman, man), shown on the pilot's radio
  line; no picker at New Journey, no avatars to buy.
- **Portraits are drawn in code**, in the prologue's style (outlines, eyes, uniforms), not painted
  like the comic. Painted portraits that match the comic exactly would need an image generator with
  the comic as reference: a small paid job that sends your art to that service, so it is not done
  without your go-ahead (the game would then load them as two small images).
- **Balloon rooms** are measured by hand on these panels; replacement art needs its rooms measured
  again (listed in `tools/comic-art.py`).

## 10. Publication status

Not published. Nothing was sent to Project 0 except free read-only page loads of the documentation, the
dev kit and its sandbox scripts. To release after your review: `npm run package`, then the free
`P0_KEY_FILE=… npm run p0:validate`, then, with your explicit approval, the publish steps in
`docs/P0_PUBLISH_CHECKLIST.md` (lot 323 only). Lot #696 is never used by these tools.
