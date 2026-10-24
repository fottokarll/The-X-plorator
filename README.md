# THE X-PLORATOR 🚀

**A serene cosmic exploration and colony-building game for Project 0 City (lot #323) and the browser.**
Status: **M1 "Outer Verge" playable prototype** (branch `dev/m1-outer-verge`), not yet published.

Humanity flees a devastated Earth. As pilot of a small evacuation ship, explore a luminous blue-violet
galaxy, scan and collect resources, upgrade your modular spacecraft, build hexagonal orbital bases and
work toward the **Genesis Initiative**: a sustainable new home for humanity.

## Play it now

```sh
cd ~/The-X-plorator && npm install && npm start     # then open http://127.0.0.1:5500/
```

Full instructions, controls, phone access, dev kit and tests: **[RUN.md](RUN.md)**.
What was built and verified: **[MORNING_REPORT.md](MORNING_REPORT.md)**.

## What M1 contains

- **One beautiful sector, the Outer Verge**: a shader-painted giant planet with a luminous cyan limb,
  atmosphere halo, sparkling orbital ring and god rays; moons; a baked cobalt/indigo/violet nebula sky;
  sparse faceted asteroids; Cryon crystal and Ferrite ore nodes; the hexagonal Haven Outpost.
- **A small original white ship** built entirely in code, with seven equipment sockets whose levels
  change the visible geometry (engine, hull, reactor, scanner, cargo, shield, mining beam).
- **Simple, relaxing flight**: one stick (or WASD / left thumb) steers, auto-cruise flies you, boost
  and brake are optional, automatic banking and gentle auto-level. Free-look is optional and recentres.
- **A distant cinematic camera**: the ship stays ~4-9% of the screen height (5-11% on phones),
  measured from the rendered ship, never a close chase view.
- **A complete loop**: explore → scan → collect → return → dock → mission complete → upgrade.
- **Screens**: main menu, Begin the Exodus vessel choice (ATT prices are locked design placeholders),
  ship hangar with top-down ship and socket callouts, galaxy map, orbital base builder, settings with
  key rebinding, pause, controls help.
- **Desktop first, phones fully playable** in portrait and landscape (own touch controls), Xbox-style
  controller support.
- **Project 0 ready**: the same module runs in the city's sandbox (verified in the official dev kit and
  by server validation for lot #323) and in a standalone browser host. A street build for lot #323 (a
  launch beacon with live shaders) is also built and validated. **Nothing is published yet.**

## Art direction (locked)

Owner-approved **IMG 07**: space as a luminous ocean of cobalt, indigo and violet, enormous softly lit
planets with cyan rims, delicate lilac nebulae, deep negative space and a tiny elegant white ship.
Other reference images define screen layouts only. See `docs/ART_BIBLE.md`.

## Project layout

```
src/                 Project 0 experience package root (experience.json + ES modules)
  main.js            entry: export default async function start(p0)
  game/              orchestrator, sector layout, mission rules, ships & modules, saves, base rules
  flight/            assisted one-stick flight (pure) + handling presets
  camera/            distant cinematic follow camera
  input/             keyboard bindings, gamepad + touch mappers, input hub, ID-less contact tracker
  render/            sky, planets, ship, asteroids, station, effects, pipeline (bloom, final pass)
  ui/                canvas UI kit, HUD, menus, hangar, galaxy map, base builder
  planet-generator.js  deterministic planet generator (also used by Planet_Lab.html)
standalone/          browser host implementing the documented subset of the p0 object
lot/                 lot #323 street build generator (LOD0/1/2, lot.json, shaders, build.js)
tools/               local server, Playwright capture/playtest/dev kit drivers, packaging, validation
tests/               node --test suites
docs/                design, decisions, P0 audit, lot build, publish checklist, media
```

## Project rules

- **Never modify STARBOX or Project 0 lot #696.** This game lives on lot #323.
- Do not publish, charge Attention Tokens, or put keys in source without explicit approval. Keys are
  read from `P0_KEY_FILE` / `P0_KEY` only.
- Original procedural art only; reference images stay private (never in this public repository).
- Read the current [skill.md](https://project0.city/skill.md),
  [games guide](https://project0.city/guides/games.md) and
  [assets guide](https://project0.city/guides/assets.md) before changing the integration; never
  invent SDK methods (see `docs/P0_API_AUDIT_VERIFIED.md`).

**Creator:** original concept developed collaboratively by a parent and child.
