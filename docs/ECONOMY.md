# Economy & Attention Tokens — design only

**Two separate ledgers:** mined resources inside game versus real **Project 0 Attention Tokens (ATT)**. Planet objects within the game are NOT Project 0 lots.

## Generator model
Immutable planet: seed+generatorVersion, ID, class, size, palette/visual profile, initial deposits, resource diversity, habitability, and **suggested** ATT claim price. Mutable save: remaining deposits, discovered/owner identifiers, owner revision, outposts, local storage, last-production timestamp. NEVER recreate depletable inventory from immutable generator seed.

## Claim price
Proposed 2–20 ATT depending on resource rarity/amount, size and habitability; starter planet `Haven-01` free and resource-limited. Future resale requires atomic ownership transfer, transaction receipt validation, conflict handling and refunds. Do NOT implement paid features until official P0 APIs and explicit owner approval are in place. Free gameplay must remain viable.

## Survivors
Free small starting crew; optional larger packages tentatively at 2, 5, 10 ATT, only if fair and compliant. Crew could affect habitat production, but shouldn't lock essential story content behind spending.

## Offline production
`produced = min(remainingDeposit, availableStorage, floor(ratePerHour * min(elapsedHours, offlineCapHours)))`. Tentative cap 8 hours. Prefer trusted server timestamps; if unavailable disable economically valuable offline production. On reconnect stage results, then require explicit acceptance of transport; while online routes may dispatch normally.

## Safeguards
Never trust raw client amounts for paid planet ownership. Idempotent receipt handling, anti-double-spend, save migrations, replay protection, and no automatic cash transfers. Planet Lab is a mock visual design tool, not a store.
