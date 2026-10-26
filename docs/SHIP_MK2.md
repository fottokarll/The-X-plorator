# XPLORATOR_EXPLORER_MK2 (M2, Gate C)

The free Survivor now flies the white and orange Explorer Mk2, modelled in code
(`src/render/ship-mk2.js`) from the owner's turnaround sheet and hero image (private handoff, not in
this repository). It replaces the M1 ship everywhere the Survivor appears: flight, launch and docking,
the hangar, the vessel cards and other explorers in the session.

## What it is

- **Fuselage**: an elongated wedge of flat-topped faceted sections (8 stations) from a narrow dark
  nose to broad shoulders; light grey belly and a dark keel.
- **Shoulders**: broad swept planes with a slight anhedral (a low, wide Λ from behind), graphite
  rear tips, an orange leading-edge stripe.
- **Canopy**: compact, faceted, deep tinted glass near the front and top, with a white frame bar.
- **Two separate large engine housings** (graphite with metal bands), open nozzles with a dark
  throat and a **cyan core**; the engine glow and the contrails are blue in flight (the sheet's
  orange nozzles are unlit mood light). Always two engines, at every module level.
- **Fins**: canted graphite dorsal fins with orange marks, small ventral fins.
- **Accents**: sparse orange stripes and patches, graphite recess panels, side intakes, a few seams.
- **Modules** still change visible geometry: engine size, rings and vanes; wingtip fins and canards
  (hull); dorsal reactor core; scanner mast and dish; belly cargo pods; shield emitters at the
  shoulder tips; mining prongs under the nose. Hangar callouts use the same seven sockets.

Palette from the sheet (sRGB): white `#eef0f3`, graphite `#33363d`, recess `#4a4f58`, metal
`#7b818b`, belly `#a9afb7`, orange `#f2861f`, tinted glass `#0a0f19`.

## Budget and behaviour (measured, `tests/m2-ship.test.mjs`)

| Loadout | M1 Survivor | Explorer Mk2 |
|---|---|---|
| Lv 1 | 678 triangles, radius 1.641 m | 1,522 triangles, visual radius 1.494 m, **gameplay radius 1.641 m** |
| Lv 2 | 806, 1.701 m | 1,682, 1.535 m, **1.701 m** |
| Lv 3 | 1,006, 1.788 m | 1,770, 1.578 m, **1.788 m** |

- Three meshes (hull, canopy, lights) and three shared materials: **three draw calls** per ship.
- **Same frame** as M1: +Z nose, +Y up, metres, pivot at the origin; nozzles at -Z, prongs at +Z.
- **Gameplay unchanged**: the Mk2 reports the M1 Survivor's radius for the same loadout
  (`hitRadius`), used by collisions and the avoidance assist; docking and mining use fixed distances.
  The camera frames the ship by its measured on-screen size: in flight it sits at 5.0 % of the view
  height (target 4-9 %, unchanged distant camera).
- **Materials**: matte-satin white with a faint rim (0.16, M1's was 0.55 and glared), tinted glass
  with environment reflections, unlit lights. No textures.
- **Frame rate** on this PC (Intel HD Graphics 6000, 1920 × 1080, High), measured interleaved with
  the untouched M1 baseline build under the same conditions: baseline 10.6 / 13.2 / 31.7 fps, M2 with
  the Mk2 37.9 / 30.0 / 30.9 fps. No regression is visible; the absolute values are low because the
  GPU was shared with a running desktop browser that night (M1's report measured 51 fps).

## Rollback and comparison

- Settings → Developer → **Ship model: Explorer Mk2 / M1 (previous)** switches the flying ship at once.
- Locally: `?ship=m1` on the standalone page.
- The planned paid vessels (Pioneer, Colony Ship, Exodus Vessel) keep their M1 preview shapes, so the
  four cards stay distinct; they are previews only, not purchasable.

## QA turntable

`npm start`, then open `http://127.0.0.1:5500/standalone/ship-viewer.html`: the game's own sky,
lights, materials and post pipeline; drag to turn, wheel to zoom, buttons for exact views and models.
`node tools/ship-shots.mjs` writes the real renders in `docs/media/m2/ship/` (front, rear, left,
right, top, bottom, three-quarter front and rear, the flight camera's angle, Lv 3 loadout, sheet-grey
backgrounds, and M1 / Mk2 side by side).
