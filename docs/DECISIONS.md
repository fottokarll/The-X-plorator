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

## Update 2026-10-24 — launch lot and simplified controls
- **New Project 0 plot: lot #323, Medium Tower 16×16m, 30m** (owner screenshot; 6 ATT purchase). Purpose: The X-plorator launch portal / beacon, pending verified P0 API and explicit publishing review. **STARBOX lot #696 remains untouched.** Full game-space extent inside an experience still unverified.
- **ONE-STICK assisted flight is now the primary control design.** Left stick steers yaw/pitch, auto-cruise provides forward momentum without continuously holding RT; LT brakes; RT or RB boosts; camera follows automatically. Right stick is OPTIONAL look, gently recentering on release. Keyboard and touch maps share this handling.
- ABZÛ references **visual atmosphere first**; its mandatory two-stick plus RT input is explicitly rejected. REA remains a lawful, optional research tool for flight smoothing rather than a reason to copy ABZÛ control bindings.
- See `docs/FLIGHT_CONTROLS_LOCKED.md` and `docs/P0_LOT_323.md`.

## Update 2026-10-24 — M1 "Outer Verge" implementation decisions (dev/m1-outer-verge)
- **Camera locked to a distant cinematic follow** (handoff v2, CAMERA_WIDE_FOLLOW_LOCKED): ship ~4-9% of viewport height on desktop, 5-11% on phones; distance solved from the ship's bounding sphere and FOV, corrected by the measured projected height. No close chase view (hard clamp at 11%).
- **Floating origin**: Project 0 keeps the experience camera near the lot and fills the screen only while the camera is inside the 16 × 16 × 30 m box, so the camera stays at the lot centre and the universe moves. The sector is ~5 km wide; the lot does not limit gameplay space.
- **All UI is canvas-drawn** (OffscreenCanvas texture + GPU sprites): Project 0 runs experiences in a Web Worker with no DOM. The same module runs in the standalone host.
- **Input**: one-stick steering (+ auto-cruise) on every device; keyboard Shift/Space boost, C brake, Q scan, E collect/dock (Enter/Esc/Ctrl avoided); Xbox layout as briefed; touch via a floating stick and right-thumb buttons. Project 0 pointer events have no pointer id (verified), so fingers are matched by their previous endpoint.
- **Economy stays in game resources**: Cryon (crystal) and Ferrite (ore) collected in flight, delivered to the station bank, spent on module crafting and base modules. ATT vessel prices are inert placeholders; only the free Survivor is selectable.
- **Mission "First Light"** proves the loop: 6 Cryon from two crystal asteroids → dock → station power restored → hangar upgrades unlocked. Nodes regrow after 4 minutes for free exploration.
- **Persistence** via `p0.saved` / `p0.save` (≤ 16 KB, sanitised on load, never trusted for anything of value). **Presence**: other session players are drawn as small ships from `p0.players` (positions mapped into the lot box and back).
- **Quality**: High (bloom, MSAA, 1024 sky), Medium (phones), Low (software renderer / slow devices); dynamic resolution; shaders compile at warm-up, never mid-game.
- **Shared modules renamed .mjs → .js** for the Project 0 package rule; three pinned to r186 (the city's version).
- Lot #323 street build: slender launch beacon with live neon shaders (validated, not published). Lot #696 untouched.
