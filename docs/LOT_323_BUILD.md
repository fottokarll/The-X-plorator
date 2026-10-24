# Lot #323 street build: THE X-PLORATOR launch beacon

Status: **live on lot 323** since 24 Oct 2026 (owner-approved; version `02a57ea8b72b7df5-dc28e6a7f6bd1a2c`,
see docs/P0_PUBLISH_CHECKLIST.md). Lot #696 (STARBOX) and every other lot are untouched.

## Design

The lot holds an original cosmic docking beacon in the locked IMG 07 palette (abyss/indigo body,
ion-cyan neon, star-white hull, small restrained-gold accents). It is designed to read from all four
streets and from the air.

- **Plinth:** two lifted hexagonal tiers (top surfaces at 0.6 m and 0.95 m, so nothing sits on the
  street plane). Neon hex inlays, radial white spokes, twelve gold bollard lights, and stroke-built
  **X-PLORATOR** lettering on the +Z and −Z street faces. The lettering uses no font files.
- **Spire:** a tapered indigo hexagonal shaft rising to 26 m. A white crown, needle and amber beacon
  reach 29.56 m. Three edges carry continuous neon strips and the other three thin white pinstripes,
  with neon rungs at 6.6 m and 11.2 m.
- **Docking deck:** a hexagonal launch pad cantilevered toward the +Z street at 4.2 m. It has an
  under-cone, a column and a brace, a white rim band, an inner neon hex, gold edge lights, white
  landing chevrons and a cradle.
- **The explorer:** an original white ship, 5.5 m long. It has a lofted fuselage, swept wings, twin
  nacelles, a dark canopy, cyan leading-edge strips and amber engine glows. It hovers on the cradle,
  nose toward the street.
- **Two ogee arches** rise from the back plinth corners into the spire, each with a neon spine.
- **X-in-hexagon emblem** at 23.4 m: two crossed plates (gold X, cyan hex frame), readable from all
  four streets.
- **Three floating orbital rings** at 14.2, 17.9 and 21.1 m, with radii 4.8, 3.7 and 2.7 m. Each ring
  is a dark band with a neon edge, tilted and turning about the spire axis.

### Live build (`lot.json`)

| Material | Shader | Glow | Effect |
|---|---|---|---|
| `Neon` | `neon.glsl` | 1.6 | Bands of light rise up the strips (about 2.9 s a band); the hue drifts from cyan to violet; brighter when someone is near (`p0Near`) and on a `pulse`. |
| `Accent` | `accent.glsl` | 1.2 | Amber glow. The tip beacon breathes at about 0.4 Hz, far below the flashing limit; the engines shimmer softly. |
| `Body` | `body.glsl` | 0 | Indigo shell tinted cobalt at the base and violet toward the crown, with a faint cyan rim that never halos. |
| `Hull` | — | 0 | Plain white PBR. |

`build.js` turns `RingA`/`RingB`/`RingC` on the world clock, so every viewer sees the same motion. It
bobs and sways `Ship` by ±0.12 m and sends a light `pulse` on `tap` and `enter`. There is no network
access, no `eval` and no `postMessage`.

The shaders avoid `atan` and normalising possibly-zero vectors, so no NaN can reach the glow.

## Measured result vs lot #323 budgets

Budgets were read from `GET /api/agent/me` for lot 323: a medium tower, 16 × 16 × 30 m. The stats are
the server's own validation report from 2026-10-24.

| | Triangles | Draw calls | Materials | Textures | File | Bounds (m) |
|---|---|---|---|---|---|---|
| LOD0 | 19,264 / 70,000 | 14 / 14 | 4 / 4 | 3 / 8 (max 512 px) | 970 KB / 5 MB | x ±7.55, y 0–29.56, z −6.56…6.87 |
| LOD1 | 6,016 / 10,000 | 2 / 4 | 2 / 2 | 0 / 2 | 276 KB / 1 MB | same envelope |
| LOD2 | 932 / 1,000 | 1 / 1 | 1 / 1 | 1 / 1 (256 px) | 60 KB / 0.2 MB | same envelope |

- **LOD0** uses five named nodes: `Static`, `Ship`, `RingA`, `RingB` and `RingC`. Each node holds
  one primitive per material (`Body`, `Hull`, `Neon`, `Accent`). The textures are procedural: a
  512 px indigo panel texture, a 256 px hull panel texture and a 16 px white texture, so the shaded
  materials keep their UVs.
- **LOD1** is static, with the rings and ship baked at rest. It has two materials whose names match
  LOD0: a vertex-coloured `Body` (indigo, white and gold) and `Neon`, so `neon.glsl` still applies.
- **LOD2** is a single mesh with one material and a 256 px swatch texture. It keeps the silhouette,
  the white deck rim and ship, and cyan rings.
- **Envelope:** the rings sweep at most 4.97 m from the axis while turning, and the ship's bob stays
  within the box. `build-lot.mjs` checks these with a 0.3 m margin and refuses to write a build that
  leaves the box.

## Validation (free; publishes nothing)

`POST /api/agent/lots/323/validate` with `lod0`/`lod1`/`lod2`, plus `lot.json`, the GLSL files and
`build.js` as `file` fields:

```
HTTP 200  ok: true
lod0  ok: true  errors: []  warnings: []
lod1  ok: true  errors: []  warnings: []
lod2  ok: true  errors: []  warnings: []
```

The validate response reports only the three LODs. The **live-build files (`lot.json`, shaders and
`build.js`) are compiled and timed only at publish**, so they are not server-verified yet. Local
checks so far:

- All three GLSL files compile without errors in Chromium (three r186, WebGL2). They were injected
  into standard materials with the `P0Surface` fields from skill.md.
- `build.js` ran 3,090 frames against a mock `b`: valid node names, finite transforms, and
  positions inside the box.

The raw response is written to `dist/lot/validation.json`.

## Previews (local Chromium renders, not city captures)

`docs/media/lot323/`:

- LOD0: `lod0-front.png`, `lod0-threeq.png`, `lod0-side.png`, `lod0-back.png`, `lod0-top.png`,
  `lod0-street.png`
- LOD0 at dusk with glow: `lod0-threeq-dusk.png`, `lod0-street-dusk.png`
- LOD1: `lod1-threeq.png`, `lod1-threeq-dusk.png`, `lod1-far.png`
- LOD2: `lod2-threeq.png`, `lod2-far.png`

The previews use three's standard PBR plus the approximated `p0Surface` injection, with an ink
outline of the lot box. The city's own lighting, veil and halo will differ.

## Rebuild, preview, validate

```sh
cd /home/karll/The-X-plorator   # or the worktree that holds lot/
node lot/build-lot.mjs           # writes dist/lot/{lod0,lod1,lod2}.glb, lot.json, *.glsl, build.js, manifest.json, stats.json
node lot/preview-lot.mjs         # renders docs/media/lot323/*.png (P0_HEADLESS=1 for headless SwiftShader)
P0_KEY_FILE=/path/to/private/keyfile node lot/validate-lot.mjs   # validate only; key read in-process, never printed
```

On this machine, prefix node commands with `LD_LIBRARY_PATH=`. The inherited squashfs library path
breaks TLS.

## Publish (each publish needs the owner's explicit approval)

Use `tools/p0-publish.mjs street` (lot 323 only). The equivalent request:

```sh
cd dist/lot
curl -s -X POST https://project0.city/api/agent/lots/323/publish \
  -H "Authorization: Bearer $P0_KEY" -H 'User-Agent: xplorator-agent/1.0' \
  -F "manifest=$(cat manifest.json)" \
  -F lod0=@lod0.glb -F lod1=@lod1.glb -F lod2=@lod2.glb \
  -F file=@lot.json -F file=@neon.glsl -F file=@accent.glsl -F file=@body.glsl -F file=@build.js
```

- `200` means it is live; `422` returns the review's reasons; `202` means check the returned address
  later. There is a limit of 30 publishes an hour.
- After it goes live, the owner may want the box faint and cyan with
  `POST /api/agent/lots/323/box {"box":"subtle","color":"#29d3ff"}`. That is also a live write, so ask
  first.
- `manifest.json` name: "THE X-PLORATOR · Launch Beacon" (30 characters), plus a short description
  with the GitHub link.

Files: `lot/build-lot.mjs`, `lot/lib/png.mjs`, `lot/preview-lot.mjs`, `lot/validate-lot.mjs`,
`lot/assets/{lot.json,neon.glsl,accent.glsl,body.glsl,build.js,manifest.json}`.
