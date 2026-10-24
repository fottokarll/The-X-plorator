# Lot #323 publication checklist

**Published on 24 Oct 2026 with the owner's explicit approval.** Both parts are live on lot 323.
Every publish replaces what the lot shows for everyone and runs the city's review. Publishing again
needs the owner's go-ahead. **Never use lot 696 (STARBOX)**: `tools/p0-publish.mjs` only accepts
lot 323.

## Live

| Deliverable | Source | Build | Live version |
|---|---|---|---|
| Street build "THE X-PLORATOR · Launch Beacon" (LOD0/1/2 + lot.json shaders + build.js) | `lot/` | `npm run lot:build` → `dist/lot/` | `02a57ea8b72b7df5-dc28e6a7f6bd1a2c` (submission 10771, `200 live`) |
| Experience: THE X-PLORATOR M1 | `src/` (package root) | `npm run package` → `dist/the-xplorator-experience.zip` | `2ad35ac72d7916ec` from `f337a9f` (submission 10772, `200 live`, no warnings) |

## Before every publish

1. `npm test` passes; `npm run playtest` passes (full loop with real input).
2. Play the build: standalone (`npm start`) and in the dev kit (RUN.md), desktop and phone.
3. Rebuild and revalidate (free) from the approved commit:
   `P0_KEY_FILE=… npm run lot:validate`, `P0_KEY_FILE=… npm run p0:validate`.
4. Keep the key out of the repository: it is read from `P0_KEY_FILE` / `P0_KEY` only.

## Publish (lot 323 only)

```sh
P0_KEY_FILE=/path/to/key node tools/p0-publish.mjs street       # dist/lot/ + manifest.json name/description
P0_KEY_FILE=/path/to/key node tools/p0-publish.mjs experience   # dist/the-xplorator-experience.zip
P0_KEY_FILE=/path/to/key node tools/p0-publish.mjs check <address>   # follow a 202
```

These send the documented requests (`POST /api/agent/lots/323/publish` with `manifest`, `lod0-2` and
`file` fields; `POST /api/agent/lots/323/experience` with `package`). `200` = live, `202` = review
still running (follow the returned `check` address, do not republish meanwhile), `422` = refused with
reasons. Responses are saved to `dist/publish-*.json` with the key redacted.

## After publishing

- `node tools/live-visit.mjs` (and `--phone`) visits the live lot as a guest, presses Play and saves
  screenshots plus console lines to `dist/live/`. Guests cannot save, so their save answers `401`.
- Enter signed in on a PC and a real phone to check saves and touch.
- Optional, owner's choice: `POST /api/agent/lots/323/box {"box":"subtle","color":"#70e2f4"}` and a
  lot note.

## Not part of M1

No entry price, prizes, items, purchases, events or duels are configured. ATT prices shown on vessel
cards are design placeholders and cannot be bought.
