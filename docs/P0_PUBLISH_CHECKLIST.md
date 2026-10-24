# Lot #323 publication checklist (owner approval required)

**Nothing has been published.** Both deliverables pass the server's free validation for lot 323.
Publishing is a deliberate owner decision: it replaces whatever the lot shows for everyone and starts
the city's review. **Never use lot 696 (STARBOX).**

## Ready

| Deliverable | Source | Build | Validate (free) | State |
|---|---|---|---|---|
| Street build: launch beacon (LOD0/1/2 + lot.json shaders + build.js) | `lot/` | `npm run lot:build` → `dist/lot/` | `P0_KEY_FILE=… npm run lot:validate` | validated ok, 0 errors/warnings |
| Experience: THE X-PLORATOR M1 | `src/` (package root) | `npm run package` → `dist/the-xplorator-experience.zip` | `P0_KEY_FILE=… npm run p0:validate` | validated ok, 0 errors/warnings |

## Before publishing

1. `npm test` passes; `npm run playtest` passes (full loop with real input).
2. Play it yourself: standalone (`npm start`) and in the dev kit (RUN.md), desktop and phone.
3. Rebuild and revalidate both deliverables from the commit you approve.
4. Decide the lot name/description (manifest below) and whether to make the lot box faint.
5. Keep the key out of the repository: it is read from `P0_KEY_FILE` / `P0_KEY` only.

## Publish commands (documented, NOT executed)

```sh
# Street build (LODs + lot.json, shaders, build.js from dist/lot/)
curl -s -X POST https://project0.city/api/agent/lots/323/publish -H "Authorization: Bearer $P0_KEY" \
  -H 'User-Agent: xplorator-agent/1.0' \
  -F 'manifest={"name":"THE X-PLORATOR","description":"A launch beacon to a serene blue-violet galaxy. Enter to fly, scan and build. github.com/fottokarll/The-X-plorator"}' \
  -F lod0=@dist/lot/lod0.glb -F lod1=@dist/lot/lod1.glb -F lod2=@dist/lot/lod2.glb \
  -F file=@dist/lot/lot.json -F file=@dist/lot/neon.glsl -F file=@dist/lot/accent.glsl -F file=@dist/lot/body.glsl -F file=@dist/lot/build.js

# Experience
curl -s -X POST https://project0.city/api/agent/lots/323/experience -H "Authorization: Bearer $P0_KEY" \
  -H 'User-Agent: xplorator-agent/1.0' -F package=@dist/the-xplorator-experience.zip
```

`200` = live, `202` = review still running (check the returned address; do not republish meanwhile),
`422` = refused with reasons. After going live: enter the lot from a second browser (guest) and an
account, check entry, controls, saves and the street view. Optional afterwards (owner's choice):
`POST /api/agent/lots/323/box {"box":"subtle","color":"#70e2f4"}` and a lot note.

## Not part of M1

No entry price, prizes, items, purchases, events or duels are configured. ATT prices shown on vessel
cards are design placeholders and cannot be bought.
