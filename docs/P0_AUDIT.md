# Project 0 API audit status — NOT YET VERIFIED

Official docs to inspect directly in Cloud Codex:
- https://project0.city/skill.md
- https://project0.city/guides/games.md
- https://project0.city/guides/assets.md

User's 2026-10-21 screenshot announces that games **can now save per-player progress across visits and devices once makers implement it**, and existing sessions persist through server updates. User reports multiplayer is available.

Still unverified here: exact `p0` SDK namespaces, required bundle structure, allowed Three.js imports, render lifecycle, save API and quotas, session relay/authority, Android touch runtime, game audio policy, transaction confirmation/receipts, shared planet ownership, precise publish/lot payload. Do not conflate announcements with verified API calls.

**Codex first action:** attempt to read all three official docs and record exact method signatures/versions with examples to `docs/P0_API_AUDIT_VERIFIED.md`. Test a minimal local boot. If docs fail to load, report failure and use mocks; never guess APIs or publish. Any necessary lot/API credentials are provided securely in the user's environment, never requested for publication in GitHub Issues or committed.
