# Run THE X-PLORATOR (M1)

Tested on this Linux machine with Node 22 and Chromium (Playwright). Nothing here needs a Project 0
key, an account or the internet, except the optional dev kit (step 4) and validation (step 6).

> This machine inherits `LD_LIBRARY_PATH` and `PYTHONHOME` from an AppImage extraction, which breaks
> TLS in curl/git/Chromium. Prefix network and browser commands with `LD_LIBRARY_PATH=` as shown.
> The game itself does not need this.

## 1. First time only

```sh
cd ~/The-X-plorator
git checkout dev/m1-outer-verge
LD_LIBRARY_PATH= npm install
```

## 2. Play in your browser (standalone)

```sh
cd ~/The-X-plorator
npm start
```

Open **http://127.0.0.1:5500/** in Chrome, Firefox or Edge. Leave the terminal open while you play;
stop the server with `Ctrl+C`.

- Fresh start (ignore the saved game): http://127.0.0.1:5500/?fresh=1
- Force a pixel ratio (performance test): http://127.0.0.1:5500/?dpr=1
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

Keys can be rebound in Settings → Keyboard bindings (Enter, Esc, Tab, Ctrl and Alt are reserved).

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
npm test                                              # 36 unit tests (flight, input, mission, saves, base, camera...)
LD_LIBRARY_PATH= npm run playtest -- --hangar         # full loop with real keyboard input + hangar upgrade
LD_LIBRARY_PATH= bash tools/capture-suite.sh          # regenerate docs/media/m1 screenshots
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
