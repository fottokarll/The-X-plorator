# Run THE X-PLORATOR (M2 release candidate)

Tested on this Linux machine with Node 22 and Chromium (Playwright). Nothing here needs a Project 0
key, an account or the internet, except the optional dev kit (step 4) and validation (step 6).

> This machine inherits `LD_LIBRARY_PATH` and `PYTHONHOME` from an AppImage extraction, which breaks
> TLS in curl/git/Chromium. Prefix network and browser commands with `LD_LIBRARY_PATH=` as shown.
> The game itself does not need this.

## 1. First time only

```sh
cd ~/The-X-plorator
git checkout dev/m2-exodus-comic-ship      # the live M1 build is tag m1-live-lot323
LD_LIBRARY_PATH= npm install
```

## 2. Play in your browser (standalone)

```sh
cd ~/The-X-plorator
npm start
```

Open **http://127.0.0.1:5500/** in Chrome, Firefox or Edge. Leave the terminal open while you play;
stop the server with `Ctrl+C`.

- Fresh start (ignore the saved game, see the prologue): http://127.0.0.1:5500/?fresh=1
- Force a pixel ratio (performance test): http://127.0.0.1:5500/?dpr=1
- Local test switches: `?perf=1` performance report, `?ship=m1` the M1 ship, `?guest=1` play as a
  guest (saves refused like the city's 401), `?story=1` always show the prologue, `?noown=1` behave
  like the dev kit (no own loading screen), `?failboot=world` / `?artfail=2` / `?artdelay=1500`
  failure and slow-art tests.
- Ship turntable (QA): http://127.0.0.1:5500/standalone/ship-viewer.html
- Your progress is saved in the browser (in Project 0 the city keeps it per player).
- Graphics quality: Settings → Graphics quality (Auto chooses High on desktop, Medium on phones).

### On your phone (same Wi-Fi)

```sh
npm start -- --host 0.0.0.0
```

Then open `http://<this-computer's-IP>:5500/` on the phone (find the IP with `hostname -I`).

## 3. Controls

| | Keyboard & mouse | Controller (Xbox layout) | Touch |
|---|---|---|---|
| Fly | auto-cruise is always on | auto-cruise | auto-cruise |
| Steer | W A S D or arrows | left stick | left thumb anywhere on the left |
| Boost | Shift or Space | RT (or RB) | hold BOOST |
| Brake / stop | C | LT | hold BRAKE |
| Scan | Q | X | SCAN |
| Collect / dock / launch | E | A | ACTION |
| Galaxy map | M | Y | map button (top right) |
| Hangar · Orbital base | H · B | d-pad ◀ · ▶ | pause menu |
| Pause | P (Esc in the standalone page) | Start | pause button |
| Look around (optional) | right-drag | right stick | drag on the right |
| Zoom (eases back) | mouse wheel, + / − | d-pad ▲ / ▼ | — |
| Menus | arrows + Space/E/Enter, Backspace back | stick/d-pad + A, B back | tap |
| Prologue | ← → turn, Space next, Backspace back | d-pad ◀ ▶, A | swipe or tap NEXT / BACK |

Keys can be rebound in Settings → Keyboard bindings (Enter, Esc, Tab, Ctrl and Alt are reserved).

### The prologue and the first flight

A fresh start opens the Exodus prologue while the game loads. Read it at your own pace (SKIP STORY
goes on as soon as the game is ready); BEGIN THE EXODUS opens the main menu, which can replay it
(Prologue). New Journey → choose the Survivor (free) → CONTINUE FREE. Mira of Haven Control then
guides the first mission one task at a time (Skip tutorial on her card or in the pause menu; Replay
tutorial in the pause menu).

### The first mission ("First Light")

1. Launch from Haven Outpost and follow the diamond marker to the Cryon signal.
2. In range, press **Scan**; then fly close and press **Collect** (the mining beam takes ~2 s).
3. Collect 6 Cryon from two crystal asteroids, then **return** and **dock** on the landing pad.
4. The station's beacon lights up; craft and equip upgrades in the **Hangar** with the delivered
   Cryon, and place new hex modules in the **Orbital Base** with Ferrite.

## 4. Run inside the official Project 0 dev kit (real sandbox, nothing published)

With `npm start` running, open:

```
https://project0.city/devkit?entry=http://localhost:5500/main.js&width=16&depth=16&height=30
```

Add `&phone=1` for the 390 × 844 phone view. Your browser may ask to let project0.city reach this
device: allow it. Automated version (screenshots, frame times, review run):

```sh
LD_LIBRARY_PATH= npm run devkit -- --review --out docs/media/devkit
LD_LIBRARY_PATH= npm run devkit -- --phone --review --out docs/media/devkit
LD_LIBRARY_PATH= node tools/devkit-touch.mjs --out docs/media/devkit
```

## 5. Tests

```sh
npm test                                              # 61 unit tests (M1's 36 + audio, prologue/boot, ship, tutorial)
LD_LIBRARY_PATH= npm run playtest -- --hangar         # prologue + full loop with real keyboard input + hangar upgrade
LD_LIBRARY_PATH= npm run playtest -- --tutorial       # the same, finishing the first-flight tutorial
LD_LIBRARY_PATH= node tools/m2-checks.mjs             # rotation, BEGIN-before-ready, controller, old save, exposure, HUD buttons
LD_LIBRARY_PATH= node tools/audio-loop-check.mjs      # records three music loops, measures gaps and seams
LD_LIBRARY_PATH= node tools/load-timing.mjs --net fast3g --size 390x844 --touch --three-local
LD_LIBRARY_PATH= bash tools/capture-m2.sh             # regenerate docs/media/m2/after screenshots
LD_LIBRARY_PATH= node tools/ship-shots.mjs            # real renders of the Explorer Mk2 from every angle
```

`npm run playtest` and the capture tools open a Chromium window (GPU) and need `npm start` running.

## 6. Project 0 packages (validate only)

```sh
npm run package            # dist/the-xplorator-experience.zip + local rule checks
npm run lot:build          # dist/lot/ (LOD0/1/2 GLBs, lot.json, shaders, build.js)
# Validation is free and publishes nothing. The key stays outside the repository:
P0_KEY_FILE=/path/to/your/key LD_LIBRARY_PATH= npm run p0:validate
P0_KEY_FILE=/path/to/your/key LD_LIBRARY_PATH= npm run lot:validate
```

Publishing to lot #323 (`tools/p0-publish.mjs`, lot 323 only) is documented in
`docs/P0_PUBLISH_CHECKLIST.md`; every publish needs your explicit approval. Lot #696 (STARBOX) is never
used by these tools. `node tools/live-visit.mjs` visits the live lot as a guest and takes screenshots.
