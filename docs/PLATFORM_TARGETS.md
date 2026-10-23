# Platform targets — The X-plorator

Decision date: 2026-10-23. **PC WEB BROWSER FIRST.** Visual art style remains the *approved locked* serene blue-violet/cyan cosmic gameplay direction (the owner-designated **IMG 7**). Earlier menu/ship/station screenshots indicate preferred **layout** only, not a new art style.

## Priority and scope

1. **P0 City in PC browser — primary production target.** Desktop Chromium/Firefox where supported, keyboard + mouse, optional Xbox-compatible gamepad, true 3D flight with chase camera. P0 API and packaging must be verified, never guessed.
2. **Standalone browser demo — secondary testing surface.** Run same original gameplay core outside P0 through an independent adapter where technically/legal permitted; no P0 sessions, Attention Tokens or simulated real purchases. Ideal place to test gamepad, couch co-op, and non-P0 family play. Secure saves/multiplayer would require a separate design.
3. **Xbox Edge browser — experimental future compatibility target.** Xbox Series X|S has Edge (Microsoft official guide). It is not yet confirmed that the P0 page, its sandbox, pointer lock, Gamepad API permissions or shaders work there; test on actual console. The game may be accessible via Edge **without native installation**. Do not promise installable Xbox PWA from general Windows Edge PWA documentation.
4. **Natively installed Xbox game — out of scope.** Different build/publishing path (for commercial retail, ID@Xbox/GDK); UWP games are no longer accepted in Xbox Store. Do not plan a native Xbox package in M1.

## Family play safety / platform age limits

Project 0 Terms of Service (2026-10-21) state P0 is for **ages 16 and older**, and requires one account per person. Child co-creator is younger. **Do not create or use a P0 account for a child under 16**. Instead build age-appropriate **standalone browser local playtest** (optionally PC connected to TV + two controllers), with no P0 log-in, ATT transactions or public chat. Online co-op for standalone users is a distinct networking task, not automatically provided by P0.
Official P0 terms: https://project0.city/terms

## Controls — gamepad-first optional, not gamepad-only
- Keyboard/mouse remains primary, controller optional; one logical action schema drives both.
- Xbox controller recommended mapping in `codex/TASK_INPUT_001.md`.
- Remappable actions and sensitivity; separate camera and ship controls.
- UI operable entirely with controller via focus, D-pad and A/B, not a cursor-only UI.
- Account/password/monetisation pages remain outside custom controller shortcuts and must respect platform UI.
- Do not assume `navigator.getGamepads()` is enabled inside P0's sandboxed frame. Check Gamepad API availability, secure context, user gesture, Permissions-Policy and focus on real P0 instance.
- Test disconnect/reconnect, two-controller enumeration, drift/deadzone and no-controller fallback.

## TV / 10-foot interface

- 16:9 1920x1080 and 1280x720; 1366x768 also useful; 4K TV via responsive upscale, not native 4K render requirement.
- Keep selectable menu targets large, obvious focus rings and legible fonts at viewing distance; target ~22+ CSS px for menu body at nominal 1080p TV layout subject to browser scaling.
- Safe margins ~5% screen on TV to avoid overscan; account for Xbox browser bars and safe areas.
- Avoid mouse-hover-only controls, long text in small HUD, any hard mobile portrait assumptions.
- Quality settings and a lower-cost planet/ring/shader fallback if frame pacing drops.

## Couch co-op — separate milestone

Option A, easiest: connect PC browser to living-room TV, use one controller for ship and second for scanner/navigation/crew role (one-screen/asymmetric co-op), no external multiplayer network requirement. UI needs clear shared roles.

Option B: two players on separate devices in a standalone build. Requires independent identity/session/lobby/networking and synchronized game state — NOT automatically inherited from P0 multiplayer.

Option C: native split-screen two ships: much higher rendering cost and more implementation; assess after solid single-player performance. Keep optional.

## Exact acceptance test on Xbox
- Open Edge on console and navigate to test URL.
- Check actual JS/WebGL support, input events, gamepad polling, controller navigation and fullscreen/pointer lock behavior.
- Run rendered 3D flight for 10+ minutes, monitor crashes, FPS/frame times if measurable, input latency, text legibility, controller reconnect.
- Report console model, browser version, test build, screenshots/video and limitations. Never claim a pass without running it.
- If P0 version blocked, try standalone browser URL independently and report the distinction.

## Trusted references
- Microsoft Xbox Edge official guide: https://www.microsoft.com/en-us/edge/learning-center/how-to-use-microsoft-edge-on-xbox
- MDN Gamepad API: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
- Microsoft current Xbox publication path: https://learn.microsoft.com/en-us/gaming/game-publishing/publishing-processes/managed-creators/overview
- Microsoft UWP Xbox FAQ (UWP games not accepted for Xbox Store): https://learn.microsoft.com/en-us/windows/uwp/xbox-apps/frequently-asked-questions
- P0 terms: https://project0.city/terms

No native app development, paid store, or Xbox install until independently justified.
