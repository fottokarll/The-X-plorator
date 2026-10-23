# Platform targets — The X-plorator

Decision: **PC browser is primary; phone browsers MUST be fully playable, not merely shrink-to-fit.** Optional Xbox Edge controller support is experimental and must be tested. The cosmic blue/violet style from owner-approved IMG 7 remains LOCKED; other screenshots are references for UI layout only.

## Supported targets
1. **PC desktop browsers** in Project 0 — primary target. Mouse/keyboard, optional Xbox gamepad. Preferred aspect 16:9.
2. **Phone browsers** in Project 0 — required target. **Portrait and landscape, real touch controls, fully navigable UI and adaptive scene framing.** Do not require a keyboard, hover, scroll wheel or Bluetooth controller to play.
3. **Standalone browser demo** — secondary development/test runtime outside P0, allowing child-appropriate family play separately without P0 account/ATT/payment/chat.
4. **Xbox Series X|S Edge** — optional browser compatibility, not verified. Browser shortcuts may capture B/X/Y/LB/RB. On-console smoke test mandatory before any compatibility claim.
5. **Native Xbox installation** — out of scope for MVP.

## PHONE IS A REAL GAME CLIENT: acceptance rules
- **Design targets:** 360×800, 390×844 portrait, 800×360 and 844×390 landscape, plus desktop 1280×720/1920×1080. Include tablet layout when inexpensive.
- Prefer landscape for expressive free-flight space/visibility, but **portrait remains fully playable** using taller framing, increased camera distance/FOV if sensible, lighter HUD and collapsible panels. Do not disable gameplay in portrait.
- On phone, place a floating **left-thumb joystick** inside the safe zone for yaw/pitch, **right-thumb thrust/brake/boost and scan/interact**, and a touch camera-look region or contextual drag. Expose roll as optional simplified toggle/autolevel; no need for simulated six-axis controls at once.
- Keep touch buttons ≥44×44 CSS pixels where possible and space them for thumbs; UI must work without hover; menus use accessible semantic controls, not tiny on-canvas hit targets.
- Use mobile safe areas via `env(safe-area-inset-*)`, viewport-fit=cover when appropriate, `dvh` where supported. Account for phone browser bars and notches.
- Canvas/render sizing tracks CSS viewport and internal pixel ratio **independently**; never stretch a fixed 16:9 screenshot to fill portrait.
- Reframe 3D camera independently by aspect ratio: keep ship readable, avoid hiding nearby targets behind thumbs or HUD, relocate mission and compass into compact mobile regions.
- Touch: Pointer Events + explicit `touch-action:none` only on game touch controls, correct pointer capture/cancel/visibility handling, avoid blocking normal UI scrolling elsewhere.
- Default graphic **quality=mobile**: lower pixel ratio if needed, disable expensive bloom/volumetric passes, reduce particle density, reduce shader noise/octaves. Keep the signature luminous planet edge/blue-violet mood at lower cost.
- Target aspirational 30 FPS on representative lower/midrange phones; use real measured frame time and battery/thermal observation. This is NOT a verified P0 performance guarantee.
- Smooth transition on resize/orientation change without losing progress, pointer gestures or render context; no forced orientation requirement.
- Clear pause/settings/help, mute and reduced motion; audio starts after gesture.
- Manual QA: one-handed accessibility is a future option; full basic flight should work with both thumbs and no external hardware.

## Shared input model
All controls feed ONE semantic `InputActions`: yaw/pitch/roll/thrust/brake/boost/camera/interact/scan/map/back/pause. The existing `src/input/gamepad.mjs` is gamepad mapping only. Add `src/input/touch.mjs` without introducing another render loop or changing P0's input hooks until SDK audited. Keyboard/mouse remains desktop default. Switch displayed button hints based on last active input device.

## Xbox/TV support
- 16:9 TV 1280×720/1920×1080 with large, readable high-contrast menu text/focus indicators and ~5% safe margin.
- Test standard Gamepad API access in P0 sandbox and Xbox Edge; Microsoft's Edge browser may intercept B/X/Y/LB/RB for browser navigation. No guarantee Xbox browser can run the game/controller.
- PC-to-TV with two controllers is the easiest future local family play mode. Native Xbox port/splitscreen are later choices.

## Family/account restriction
Project 0's current terms state 16+ and one account/person: https://project0.city/terms . Child testing goes through a **separate standalone age-appropriate build**, not a younger child's P0 login or use of parent's account to bypass eligibility. Offline local co-op is not Project 0 multiplayer.

## Reference links
- https://project0.city/skill.md
- https://project0.city/guides/games.md
- https://project0.city/guides/assets.md
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
- https://www.microsoft.com/en-us/edge/learning-center/how-to-use-microsoft-edge-on-xbox

**SDK integration remains unverified:** check current official docs before implementing P0's renderer lifecycle, frame callbacks, save or session APIs.
