# First-flight tutorial (M2, Gate D)

Answer to the playtest note *"Beautiful, but what am I supposed to do?"*: Haven Control talks the
new pilot through one complete loop, one task at a time, on top of the existing First Light mission.

| # | Task | Finished by (a real game event, never a button) | Radio (Mira, Haven Control) |
|---|---|---|---|
| 1 | Steer | 1 s of real steering input | "Explorer, this is Haven Control. Your crew is safe. Let's get you moving." · You: "Copy, Haven. Ready to fly." · "Gentle on the controls. Auto-cruise is active. Steer toward the beacon." |
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
  caught up to the next task; the first launch of a journey never skips anything. Radio lines change
  with reading time; tasks change only with events.
- **Device-adaptive tasks**: keyboard tasks name the player's own (rebindable) keys, controller tasks
  the Xbox-layout buttons, touch tasks the on-screen buttons.
- **Skip / resume / replay**: *Skip tutorial* on the card and in the pause menu; the step is saved
  with the profile and resumes next visit (signed-in players); *Replay tutorial* in the pause menu
  (steps of the first mission are passed over once it is done). Every new journey starts it; saves
  from M1 do not (their pilots know the way).
- **People**: Mira, Haven's flight controller, is an original character in a high-collared navy
  uniform with a headset, drawn in code as a small portrait. The pilot never walks; their optional
  portrait (Settings → Pilot portrait: neutral visor, woman, man) appears on their radio line. No
  purchases of any kind.
- **Text** by stable ids in `src/tutorial/text.en.js`; a soft two-tone radio chirp (synthesised,
  under the effects volume) before Haven's lines.

Verified with `npm run playtest -- --tutorial` (real keyboard input): every step advanced on its own
event, then the tutorial ended at the next launch; 0 errors.
