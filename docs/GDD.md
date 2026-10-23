# Game Design Document v0.1

## Narrative and goal
After the Earth's ecological and nuclear collapse, pilots carry survivors into deep space. Search for a sustainable home and complete the five Genesis objectives: (1) discover habitable planet (2) protect/grow population (3) construct resilient home settlement (4) establish food/energy/resource trade (5) activate Genesis Initiative. Continue after campaign completion.

## Real-time gameplay loop
**Fly → explore/scan → mine or rescue → return to dock → upgrade ship → extend hex base → discover planet → establish logistics → grow colony → advance Genesis.** Exploration should be satisfying even without missions or combat.

## Navigation
Full 3D arcade flight with pitch/yaw/roll, strafing/altitude, adjustable response, boost and optional stabilisation; smooth chase camera. Within a star sector: unrestricted exploration, planets, asteroids, outposts. Galaxy map: optional point-to-point warp and missions. Separate isometric camera for modular base construction.

## Resource and base systems
Starter internal resources proposed: iron, ice and crystal. Finite cargo hold; scanner/laser and dock interaction; materials for upgrades/production. Space station is a snapped hex grid: command node, storage, power, refinery, habitat, drone hangar and docks. Module requirements and connectivity matter, but visually simple placement is the priority.

## Ship progression
Interchangeable slots ENGINE / MINING / CARGO / SCANNER / SHIELD / UTILITY, visually changing hull appearance where possible. Larger ship classes and automated transport/mining fleet come later. No pilot-on-foot feature.

## Planet catalogue
Each deterministic seed yields a stable ID, class, size, visual palette/biome/atmosphere, planet profile, mineral types, quantities, habitability, and suggested in-game acquisition price. First starter world is free with limited deposits. Planet purchase/resale in ATT is a concept until the secure transaction architecture is proven. In-game planets are not P0 lots.

## Missions without mandatory combat
Locate SOS beacons, recover lost technology, escort relief supplies, map anomalies, scan for breathable worlds, repair relays, rescue stranded passenger ships. Galaxy map points complement rather than restrict free exploration.

## Population
Player starts with a small evacuation crew. Early optional larger passenger packages (free/2/5/10 ATT proposal) might affect output capacity; no mandatory payments to reach Genesis. Crew care requires food, energy and housing in future milestones.

## Multiplayer / saves
Players can fly together or form independent bases. Shared world changes and planet claims require an authoritative/conflict-safe backend, not just player save API. Player progress includes ship/modules/cargo/crew/visited discoveries; shared planet ownership must be validated separately.

## Offline production
When online: active conveyors can transport automatically. Offline: produce to a capped elapsed time, deposit and storage limit. On next visit: player explicitly approves shipment. Trusted clock and idempotency needed before economically valuable offline production.

## M1 playable vertical slice ONLY
One star sector; one low-poly ship and six-axis flight; three very different procedural 3D planets with rings/gradient atmospheres; a modest asteroid cluster; seven hex tiles on a small station; switching flight/build camera; desktop/mobile controls and quality options. No PvP, ATT, automated mining, real economy, server multiplayer or publishing until separate acceptance gates.
