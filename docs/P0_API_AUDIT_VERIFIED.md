# Project 0 API audit: verified (2026-10-24)

Sources read in full on 2026-10-24 (raw Markdown, not summaries):
`https://project0.city/skill.md`, `/guides/games.md`, `/guides/assets.md`.
Where this file says **observed**, it was seen in the official dev kit or in a
server response during this session. Everything else is quoted from the docs.
skill.md wins if the guides and skill.md disagree.

## Lot #323 (read-only `GET /api/agent/me`, 2026-10-24)

| Field | Value |
|---|---|
| id / shape / tier | 323 / tower / medium |
| box | width 16 × depth 16 × height 30 m, altitude 0, zone city |
| state | `version: null`, `experience: null`, `game: null` (empty lot) |
| LOD0 budget | 70,000 tris · 14 draw calls · 4 materials · 8 textures ≤ 1024 px · 8 clips · 2 skinned · 64 bones · 5 MB |
| LOD1 budget | 10,000 tris · 4 draw calls · 2 materials · 2 textures ≤ 512 px · 1 MB |
| LOD2 budget | 1,000 tris · exactly 1 draw call · 1 material · 1 texture ≤ 256 px · 0.2 MB |

Lot #696 (STARBOX) was listed in the same response and was **not touched**.

## Two deliverables, two APIs

1. **Street build (lot box)**: three GLBs per lot, made by us:
   `POST /api/agent/lots/LOT_ID/validate` (free, publishes nothing; fields `lod0`, `lod1`, `lod2`) and
   `POST /api/agent/lots/LOT_ID/publish` (manifest + LODs, at most 30 publishes an hour). Optional
   `lot.json` with GLSL surface shaders and a sandboxed `build.js` script.
2. **Experience (what players enter)**: a package (`experience.json` + ES modules + assets),
   `POST /api/agent/lots/LOT_ID/experience/validate` (free) and
   `POST /api/agent/lots/LOT_ID/experience` (publish, then review).

## Experience runtime facts that shaped the architecture

- Runs in **a Web Worker inside an isolated frame**: no DOM, no storage, no network beyond our
  own files. Refused: `eval`/`new Function`, WebAssembly, `fetch` to other sites,
  `WebSocket`/`XMLHttpRequest`/`EventSource`, `indexedDB`/`caches`, workers, WebGPU,
  `postMessage`, computed `self[...]`. **Consequence:** all UI is drawn into an `OffscreenCanvas`
  texture (src/ui/overlay.js); no DOM APIs anywhere in `src/`.
- Imports: own files, `three` (**r186**, shared with the city) and `three/addons/...`, plus a short
  list of libraries (cannon-es, three-mesh-bvh, yuka, ...). We use only three + addons.
- Readable modules only: no line over 1,000 characters, no string literal over 20 KB, ≤ 4 MB JS.
- Package files: `*.js` modules and `.glb .vrm .png .jpg .webp .ogg .mp3 .wav .json .txt` assets.
  **Consequence:** shared modules were renamed from `.mjs` to `.js`.
- **Camera:** kept within two lot sizes of the lot's centre (another sentence says ten lot widths);
  FOV clamped to 20-120°. "Seen from outside the lot's box, your game is clipped to the box's outline
  on screen; with the camera inside the box it fills the screen." **Consequence:** floating origin.
  The camera never leaves the lot centre; the universe group moves (src/render/world.js). The
  16 × 16 m lot does not limit the playable sector.
- `p0.me.position` is clamped into the lot box before others see it: we map the sector into the box
  (scale ≈ 0.0025) and back for remote explorers (game.js `syncPresence`).
- The page renders `p0.scene` with `p0.camera` unless `p0.autoRender = false` (we render ourselves
  through an EffectComposer). The renderer is **transparent**: every final pixel must be opaque.

## p0 members used by THE X-PLORATOR (all documented)

| Member | Use |
|---|---|
| `p0.createRenderer({ antialias:false, powerPreference })` | before first use; MSAA is done in our HDR target |
| `p0.renderer`, `p0.scene`, `p0.camera`, `p0.autoRender = false` | own render pipeline |
| `p0.loop(fn(dt, time))` | single frame loop (no second loop) |
| `p0.controls.mode = 'none'`, `controls.vertical = false` | we move the camera ourselves |
| `p0.bodies.visible = false` | own ship models for players |
| `p0.input.keys` (Set of codes), `p0.input.gamepad` ({axes, buttons}), `p0.input.pad` | polled input |
| `p0.on('keydown'/'pointerdown'/'pointermove'/'pointerup'/'wheel'/'resize'/'pad'/'pointerlock'/'update')` | events |
| `p0.width`, `p0.height`, `p0.pixelRatio` | layout + render sizes |
| `p0.saved` / `await p0.save(data)` | per-player save, plain JSON ≤ 16 KB, at most once a second |
| `p0.hud(text)` | "How to play" text (≤ 400 chars; ours is 231 / 147) |
| `p0.loading(fraction, label)` | entry progress |
| `p0.me` (`position`, `yaw`), `p0.players` (Map) | session presence |
| `p0.log(...)` | dev kit console |
| `p0.lot` | box size for the floating-origin anchor |

`experience.json`: `entry`, `name`, `description`, `maxPlayers: 8`, `"ui": "minimized"`,
`"stick": false` (own touch controls), `loading` colours, `credits`.

## Observed in the official dev kit (`https://project0.city/devkit?entry=http://localhost:5500/main.js&width=16&depth=16&height=30`)

- The game starts in the real sandbox: `started "THE X-PLORATOR" in 2.3-9.0 s (35 files, 297 KB)`,
  **no errors**, `p0.save: 1.1 KB kept in this browser`.
- `devkit.review(14)` (the review's 640 × 360, pixel ratio 1, simulated keys) in phone mode:
  **ran 14 s at 59.4 fps, worst frame 30.6 ms, first frame 17 ms**, 0 errors (GPU Chromium, Intel
  HD Graphics 6000). The software renderer used by the real review was **not** measured here.
- **Pointer events carry `t, k, x, y, dx, dy, buttons, button, touch`** (logged from the game on a
  real touch). There is **no pointer id**, as the STARBOX team also found; our contact tracker
  matches fingers by their previous endpoint `(x - dx, y - dy)`. Two simultaneous fingers (stick +
  Boost) worked in the dev kit.
- The city toolbar sits across the top centre on desktop and **the full width on phones**; the HUD
  keeps that band clear (`view.p0Top = 58`).
- The dev kit loads only the entry module, so `experience.json` keys (`stick:false`, `ui`) are not
  applied there: the dev kit shows the city's touch stick over our controls. In the city, `stick:false`
  removes it (documented, not yet observed live).

## Server validation (free, publishes nothing): lot 323

| What | Result |
|---|---|
| Experience package (36 files, 305 KB) | **HTTP 200, `ok: true`, 0 errors, 0 warnings, 0 findings**, candidate hash `d2ca06e64ae8459a` (later revisions revalidate with `npm run p0:validate`) |
| Street build LOD0/1/2 | **HTTP 200, `ok: true`, 0 errors, 0 warnings** (see docs/LOT_323_BUILD.md) |

A validation hash is **not** a published version. Nothing was published; no `/status`, `/box`,
`/note`, `/game` or `/event` call was made.

## Not verified / out of scope for M1

- The automatic content review that runs on publish (only on publish).
- Behaviour on a physical phone (Chromium device emulation and dev kit phone mode only).
- The real review's software renderer frame rate.
- Multiplayer with two real accounts (presence code uses documented `p0.me` / `p0.players`).
- Prizes, items, purchases, duels, notes: deliberately unused in M1 (no ATT, no rewards).
