# Design Decisions — 2026-10-23 (updated mobile requirement)

## Confirmed by owner
- **The X-plorator**, original game about humanity escaping a ruined Earth, seeking Genesis Initiative and rebuilding civilization.
- **PC web browser is PRIMARY**; **mobile phone browser is REQUIRED AND PLAYABLE**, not just responsive screenshots. Full touch input and layout/camera adaptation in portrait AND landscape are release requirements. Optional Xbox Edge/TV controller support is a later experimental goal.
- Locked aesthetic: owner-approved **IMG 7** — blue-violet serene space, luminous planets, graceful tiny spaceship. Other reference pictures specify MENU/HANGAR/BASE layouts only.
- Free roaming in real-time, preferred full 3D flight; 2.5D camera experiment allowed, not approved replacement.
- Only a spaceship avatar (no walking astronaut). Ship modules, future bigger ships/fleet, resource collection, hex space bases.
- Planet generation by seed (type, size, visual, resource deposits, claim quote); first starter planet free/limited. ATT planet purchase ideas 2-20 plus future resale ONLY after proven authoritative P0 purchase/ownership APIs.
- Starting passengers free or optional 2/5/10 ATT design idea; no payments in prototype; free path remains viable.
- Automatic online mining/logistics, capped offline production and manual shipment approval on reconnect; shared and independent multiplayer progression desired.
- No compulsory PvP; relaxed co-op, discovery, missions (SOS, scan, deliver). Lawfully researched movement mechanics via REA optional.

## Next engineering decision
One game core and procedural render system across PC, phone and optional TV — input/camera/HUD presets per platform. **Do not fork separate mobile game logic** or reduce portrait mode to a static menu.

## Further design ideas / not yet locked
Warp between sectors, initial 8h offline cap, endgame balancing, standalone local couch-coop, possible optional tactical hex combat. Xbox-native distribution postponed.

## P0 and family
Project 0 terms currently require age 16+ and one account/person. Child co-creator playtesting uses an age-appropriate standalone version outside Project 0, without purchases/chat. P0 publication for eligible audience remains separate.

## Not in the first slice
Real ATT checkout, shared planet trading, native Xbox, mandatory combat, on-foot avatar, large online economy, full fleet or live P0 publishing.

## Known tech risks
Official P0 SDK render/input/save/relay/asset bundling not yet audited, platform sandbox gamepad/touch compatibility, mobile GPU shader cost and thermal limits, responsive UI/camera, access and permissions.
