# Roadmap & gates

- **M0 Foundation** (current PR): source of truth, workflow, initial design tool; accepted when docs coherent and owner reviews.
- **M1 Visual & Flight Prototype** (TASK_001): free 3D flight, one procedural sector, 3 distinct planets, asteroids, seven-tile hex station, switchable cameras and mobile HUD. Gate: playable desktop + mobile viewports; screenshots; actual measured performance; owner visual/handling sign-off.
- **M2 Mine & upgrade:** scanning, three minerals, bounded ship inventory, swappable modules; gate: deterministic inventory tests and a satisfying 5-minute loop.
- **M3 Station & starter planet:** hex snap and connectivity, free resource-limited Haven-01, persistence data migrations.
- **M4 P0 multiplayer & per-player saves:** confirmed official APIs, two test players, reconnect, cross-device saves and safe recovery; no premature deploy.
- **M5 Logistics / Genesis:** missions, population growth, capped offline mining, manual offline shipment claim, interplanetary supply.
- **M6 ATT & ownership:** optional only after verified platform purchase/receipt + atomic trading safety, economic balancing and owner authorization.
- **M7 Fleet / trade / optional tactics:** after core cooperative experience is delightful.

Ticket lifecycle: scope → measurable acceptance → create branch → implement → automated tests → desktop/mobile playtest & screenshots → human review → checkpoint/tag → approved release.
