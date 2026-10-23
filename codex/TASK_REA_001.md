# TASK_REA_001 — Flight Feel Research (ABZÛ-inspired, original implementation)

**Scheduling:** Start REA readiness NOW; run focused mechanics research **as soon as the first steerable prototype exists**, before locking the 3D flight controller. This is part of M1, not a late polish task and not a blocker to bootstrapping the first scene.

## Why and what
Goal: make our original little spaceship move with the calm, gliding *feel* observed in underwater exploration games such as ABZÛ. Research these observable mechanics, **not copyrighted assets/code or the precise commercial implementation**:
- Input-to-acceleration response curve and speed buildup
- Momentum retention and active/passive braking (drag)
- Yaw, pitch, roll angular acceleration, maximum angular velocity and return-to-neutral
- Banking into turns, delayed alignment, auto-stabilize/auto-level
- Third-person follow camera offset, ease/lag and distance changes with speed
- Transition to boost and release
- Mobile touch and gamepad accessibility without losing the same core dynamics

## Sources and rights gate
- Begin with permitted gameplay observation, reference capture, manual measurement and review of openly licensed **game movement controllers**.
- REA link: https://github.com/morluto/rea
- REA is most helpful when information actually depends on inspecting **an authorized executable or runtime** rather than full accessible source. For source-available projects, use ordinary code investigation first.
- Never obtain an unauthorized binary, bypass DRM, copy protected shaders/art/music/source, redistribute decompiled code or present analysis of commercial ABZÛ internals as permitted by default. Check rights/licence before inspecting any shipped executable. If unapproved or unavailable, use permitted video observations and our own independent model.
- Do not claim measured original ABZÛ constants without reproducible evidence.
- This document does **not** grant permission to disassemble ABZÛ.

## Setup / environment gate (read latest official REA docs)
REA official source: https://github.com/morluto/rea, https://reverseengineeranything.co/
Official documented setup at time of writing:
```bash
node --version
npm --version
npx rea-agents setup
```
Follow tool prompts to select supported agent (Codex or compatible local agent), inspect proposed MCP/config edits, and explicitly approve installation. REA needs compatible Node.js (official site describes 22.x >=22.19, 24.x >=24.11, or 26+); Linux workflows may need `ps` from procps. Native reverse engineering may require local Hopper/Ghidra/IDA, depending on target. Skill-only install does **not** register the MCP server.

**Cloud warning:** Cloud Codex cannot examine a copy of the game installed on a private PC unless the agent is appropriately configured and has permitted access to target bytes/workspace. Do NOT ask to upload proprietary game binaries into public GitHub. Local authorized analysis can yield a *measurement report* that Cloud Codex can use.

## Deliverable 1 — flight research matrix BEFORE tuning
Make `docs/FLIGHT_FEEL_STUDY.md` comparing:
| Component | Observed behavior | Measurement and method | Confidence | Proposed original parameter |
|---|---|---|---|---|
| Acceleration | ... | footage + frame timing | high/medium/low | ... |
| Velocity drag | ... | release input tests | ... | ... |
| Yaw/pitch/roll | ... | isolated rotations | ... | ... |
| Camera lag | ... | path samples | ... | ... |
| Boost | ... | input and release | ... | ... |

Label every field *measured, visually estimated or invented original design*. If REA unavailable, record why. A measured mechanical feel is more important than repeating an unverified marketing claim of 'exact' binary constants.

## Deliverable 2 — independent parameterized movement controller
Create a small reusable `FlightDynamics` module with a configurable flight profile. For example:
```ts
type FlightProfile = {
  acceleration:number; maxSpeed:number; braking:number;
  linearDamping:number; angularResponse:number;
  pitchRate:number; yawRate:number; rollRate:number;
  autoLevelStrength:number; boostMultiplier:number;
  cameraLag:number; cameraDistance:number;
}
```
Keep all units explicit (metres, seconds, radians). Choose reasonable **original** defaults; values are placeholders until measured/testing. Integrate via input action schema used by desktop keyboard/gamepad and mobile touch. Avoid binding gameplay physics directly to FPS; use stable delta-time handling. Keep visuals and player control deterministic enough to regression-test.

## Deliverable 3 — interactive A/B test
Create two presets from the same spaceship/sector:
- A: arcade responsive (reference baseline)
- B: serene gliding / diver-like (research-driven, original)

Test turning, braking, stopping, boosting, fast direction changes, camera smoothing on PC browser and phone portrait/landscape. Record playable screen capture and feedback. Test motion comfort and ability to scan/land/dock precisely.

## Exit gate
Deliver research report, parameter table with evidence and limitations, two working controller presets, tests and draft PR. Owner approves feel before adding complex ship systems.

Do not modify STARBOX, any Project 0 production lot, or the locked blue-violet IMG 7 art direction.

## Owner control correction (2026-10-24)
The owner explicitly rejects ABZÛ's simultaneous left-stick + right-stick + RT controls. Do not treat ABZÛ control binding as the target. Research only *feel* (smoothing, momentum and camera response) with permitted observation. We have a one-stick + automatic cruise prototype at `src/flight/assisted-flight.mjs`. Use REA later **only** if lawful, source-available references/recordings cannot answer a meaningful motion question. Its lack must not block a playable build.
