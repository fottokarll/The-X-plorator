# First-flight tutorial (M2, Gate D)

Answer to the playtest note *"Beautiful, but what am I supposed to do?"*: Haven Control talks the
new pilot through one complete loop, one task at a time, on top of the existing First Light mission.

| # | Task | Finished by (a real game event, never a button) | Radio (Mira, Haven Control) |
|---|---|---|---|
| 1 | Steer | 1 s of real steering input | **Opening briefing** (the ship holds, each line waits for Continue): "Explorer, this is Haven Control. Your crew is safe. Let's get you moving." · You: "Copy, Haven. Ready to fly." · "Gentle on the controls. Auto-cruise is active. Steer toward the beacon." |
| 2 | Boost and brake | 0.4 s of boost and 0.3 s of brake | "Nice and smooth. Try a short boost, then ease off with the brake." |
| 3 | Follow the beacon | entering scan range of the Cryon target | "Follow the beacon. The Cryon signal is just ahead." |
| 4 | Scan | a completed scan | "Scan that crystal, then collect a sample. We'll need every unit." |
| 5 | Collect | Cryon actually mined into the hold | "Clean scan. Now bring the crystal aboard." |
| 6 | Fill the hold (first mission only) | 6 Cryon aboard | "Good. One more crystal and the hold is ready for Haven." |
| 7 | Return | within docking range with cargo | "Bring it home. Docking at Haven will deliver your cargo." |
| 8 | Dock | docked, cargo delivered | "You are over the pad. Dock when you are ready." |
| 9 | Orbital base | the base screen opened | "You did it. This little outpost is our first foothold. Take a look at the base." |
| 10 | Free | the next launch | "Modules are built with Cryon and Ferrite, the gold ore in the field. The rest is up to you." |

- **Rules** (`src/tutorial/tutorial.js`, `tests/m2-tutorial.test.mjs`): it only listens to events the
  game already confirms; it grants nothing and never changes the mission or the camera (auto-cruise
  and the distant camera stay as they are). A pilot who is ahead (scans before trying the brake) is
  caught up to the next task; the first launch of a journey never skips anything. No line ever moves
  on by itself; tasks change only with events.
- **Opening briefing** (owner playtest: *"too fast, I didn't even notice it and it disappeared"*):
  when the first flight begins, an *Incoming transmission* panel opens at the bottom of the screen
  and the ship holds position. Mira speaks from the left, the pilot answers from the right, each line
  types in (instantly with reduced motion) and waits for **Continue** (Space / E, controller A, a tap
  or click anywhere on the panel); the last button is *Take the controls*. *Skip tutorial* is a small
  link in the panel's corner, away from Continue (and in the pause menu); B / Esc opens the pause menu.
  Afterwards the steering line stays on the HUD card with its task. Later lines appear on that card
  with the radio chirp and a short cyan glow, and stay until their task is done
  (`src/ui/transmission.js`).
- **Device-adaptive tasks**: keyboard tasks name the player's own (rebindable) keys, controller tasks
  the Xbox-layout buttons, touch tasks the on-screen buttons.
- **Skip / resume / replay**: *Skip tutorial* on the card and in the pause menu; the step is saved
  with the profile and resumes next visit (signed-in players); *Replay tutorial* in the pause menu
  (steps of the first mission are passed over once it is done). Every new journey starts it; saves
  from M1 do not (their pilots know the way).
- **People**: Mira, Haven's flight controller, is drawn in code in the style of the Exodus prologue
  (ink outlines, large eyes with highlights, flat colour with one shade): she is modelled on the
  hangar engineer of panel 4 (dark hair in a bun, round glasses, white crew jacket with an orange
  patch) and wears a headset. The optional pilot portrait (Settings → Pilot portrait: neutral visor
  helmet, a woman with long brown hair, a man with short black hair) uses the same style and the
  fleet's white-and-orange flight suit; it appears on the pilot's lines. Round portraits on the HUD
  card, comic-panel portraits in the briefing (`src/ui/portraits.js`). No purchases of any kind.
- **Text** by stable ids in `src/tutorial/text.en.js`; a soft two-tone radio chirp (synthesised,
  under the effects volume) before Haven's lines.

Verified with `npm run playtest -- --tutorial` (real keyboard input): the briefing opened with the
ship holding position and closed after three Continue presses; every step advanced on its own
event, then the tutorial ended at the next launch; 0 errors. `node tools/m2-checks.mjs --only gamepad`
goes through the briefing with the controller's A button.
