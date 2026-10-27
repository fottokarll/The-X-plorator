# The Exodus prologue (M2, Gate B)

A seven-beat comic that tells why the player is out here, shown **while the game really loads** and
read at the player's own pace. Story, art direction and composition: the owner's approved Exodus
comic (two composites, desktop and phone). Every word is set by the game from
`src/story/strings.en.js`; the illustrations carry none.

## Flow

```
code arrives -> prologue (panel 1) ............ reader moves with NEXT / BACK / swipe / keys / pad
                   |  boot tasks run underneath: world, systems, engines, interface (+ sound)
                   v
last panel: PREPARING YOUR JOURNEY (real progress) -> BEGIN THE EXODUS (only when ready, stays)
                   v
main menu (never straight into flight) -> New Journey -> vessel -> free check -> flight
```

- **SKIP STORY**: straight to the menu when the game is ready, otherwise to the last panel to wait.
- **Never automatic**: no timer moves the story; BEGIN, once shown, stays until it is used
  (`src/story/story-state.js`, tested in `tests/m2-story.test.mjs`).
- **Returning players** (the saved flag `flags.prologueSeen`): a short welcome card (panel 7 art,
  preparing status, *Replay prologue*), then the menu once the game is ready. **Guests** have no
  saved flag (Project 0 keeps no guest saves), so they see the prologue again next visit and can skip it.
- **Main menu → Prologue** replays it any time; BEGIN returns to the menu.
- **Errors**: a failed boot step shows *Something went wrong while preparing (step)* with **RETRY**
  (reading goes on); the step runs again after cleaning up its partial work. A panel image that fails
  shows *Illustration not loaded* with **LOAD AGAIN**; its text stays readable. A stalled step (no
  change for 25 s) says *Still preparing: this device needs a little longer*, never a fake error.

## Layouts (one story array, one set of events)

| | When | Art | Shows |
|---|---|---|---|
| Page | wide windows (≥ 900 × 520, landscape) | `wide` set | The approved desktop page: panels clipped to their angled outlines, white gutters, ink frame. The current panel is lit, read panels stay, the next ones are veiled with their number. Narration line, dots, BACK / NEXT. |
| Single | portrait (phones, narrow windows) | `tall` set | One panel per step in a comic frame (the panel cropped around its focus point), caption plate in the frame, the spoken line in the drawn balloon (or a balloon of the game's own when the drawn one is out of view), narration on a paper card. |
| Cinema | landscape phones | `tall` set | One wide frame on the left, title, narration and controls on the right. |

Rotating or resizing keeps the current panel. The interface canvas redraws only when something
changes; the "preparing" spinner is a GPU sprite (no full-canvas uploads per frame). The panels are
drawn into the interface canvas: no WebGL texture is created for the comic.

## Text and translation

`src/story/strings.en.js` holds every string by stable id (`story.3.bubble`, `story.ui.begin`, ...),
plus an image description per panel. A translation is another table with the same ids
(`setStrings()`). Fitting: caption plates grow with their text. A spoken line is written into the
drawn balloon when it fits there at a readable size (desktop page: the comic's own lettering size,
at least 11.5 px; phone frames 13-20 px). When it does not (a small page, a longer language, a plate
over the balloon), the game draws a balloon of its own over the drawn one, **only inside that
balloon's free room**: a rectangle of plain background around it, measured on each panel with no
people in it, below the caption plate. The text then gets smaller (down to 10-11 px) rather than the
balloon growing onto anyone. The new balloon's tail ends on the drawn tail's tip, so it still points
at the speaker. (Owner playtest: *"in some images text in the bubble covered people"*: at 1920 and
1280 px the old enlarged balloons covered faces in panels 1, 2, 3 and 5; checked again at eight
screen sizes.)

**Accessibility.** The current panel's text goes to `p0.hud` (the city's own HTML text, readable by
screen readers; it is folded away with `"ui": "minimized"` but can be opened). TRANSCRIPT opens all
seven panels as text with their image descriptions. Keyboard: ← → turn, Space next, Backspace back,
↑ ↓ move between buttons (focus ring). Controller: d-pad / stick, A, B. Touch: swipe or buttons
(44 px or more). Reduced motion: the game's own setting stops the spinner; a worker cannot read the
system's `prefers-reduced-motion`.

## Art: provenance and processing

Source: the owner's private handoff `XPLORATOR_M2_HANDOFF_v4` (kept outside this repository,
`inbox/attachments/2026-10-25/` in the Mr Mak workspace): `exodus_comic_desktop_approved.png`
(1672 × 941) and `exodus_comic_phone_approved.png` (941 × 1672), described in its manifest as
AI-generated design studies made in the owner's game conversation and approved as the art direction.
Only processed panel crops are committed; the composites, the turnaround sheet and the hero image are
not.

`tools/comic-art.py <handoff>/references` (Pillow) rebuilds everything:

1. Panel outlines were measured on the composites (white-gutter probes at both ends of every gutter,
   the black outer frame by brightness profile) and are the polygons in the tool.
2. **Balloons**: the white interior is flood-filled from a seed, the enclosed words are found as the
   holes of that region, and the whole interior is cleared to the balloon's white. The drawn balloon
   shape, outline and tail stay; `art-layout.js` records where the words were, the balloon's box, its
   tail tip (the balloon pixel farthest from the words, set by hand for three balloons) and its free
   room (measured by eye on the panels, listed in the tool).
3. **Caption plates** (cream boxes): found the same way and **painted out** (diffusion from the
   surrounding art blended with a softened mirror of the scene to the right). The result is a soft
   patch where the plate was; the game always draws its own plate over that corner, so the patch is
   not seen in the page, single or cinema layouts.
4. Saved as WebP (quality 80), measured, and the layout module written.

**Not production masters.** These are cleaned crops of the approved composites, not clean layered
illustrations: the balloon shapes and positions are fixed by the art, the plate areas are repainted
algorithmically, and the source resolution is low (desktop panels about 800 px wide, phone panels
902 px), so phone frames are upscaled about 3× on high-density screens and look soft. Before a public
release, text-free masters at about 2× resolution (with separate balloon placement) would replace
them; the tool, the layout module and the viewer are ready for that.

## Sizes (measured, `tools/comic-art.py` output)

| Panel | Wide (desktop page) | Tall (phones) |
|---|---|---|
| 1 | 825 × 242, 38.7 KB | 902 × 243, 46.6 KB |
| 2 | 833 × 242, 37.0 KB | 902 × 246, 46.7 KB |
| 3 | 858 × 216, 34.1 KB | 902 × 234, 41.0 KB |
| 4 | 785 × 240, 48.5 KB | 902 × 284, 67.4 KB |
| 5 | 743 × 222, 35.6 KB | 902 × 245, 51.8 KB |
| 6 | 918 × 202, 43.4 KB | 902 × 215, 48.2 KB |
| 7 | 1624 × 183, 60.7 KB | 902 × 256, 52.9 KB |
| **Set** | **298 KB** | **354 KB** |

A device downloads one set (the one its layout needs), in story order, one file at a time, starting
with the panel on screen; decoded panels stay in memory for the session (replays download nothing).

## Loading: what is shown when (measured)

`experience.json` now has `"loading": { "own": true }`. Project 0's sandbox runtime then runs the
frame loop from the moment the code arrives, while `start(p0)` is still working (read in
`https://project0.city/sandbox/runtime.js`, 2026-10-25), so the prologue is the loading screen. The
boot waits at most 0.9 s for the first panel to decode before the heavy, thread-blocking world build.
Boot tasks (`src/boot/boot-state.js`): profile, world, systems, engines (shader warm-up), interface
(canvas warm-up) required; sound optional. `p0.loading` reports the same honest fraction.

`node tools/load-timing.mjs` (standalone page, Chromium with GPU on this PC, browser cache off):

| | First prologue frame | Panel 1 drawn | Game ready |
|---|---|---|---|
| No throttling, 1280 × 720 (final build) | 0.57 s | 0.94 s | 6.1 s (before the first-panel wait, panel 1 came at 2.97 s) |
| Fast 3G emulated, phone 390 × 844, three.js already present | 9.1 s | 10.0 s | 13.5 s |

The Fast 3G figure is pessimistic for Project 0: the standalone page loads about 35 unbundled,
uncompressed modules one import level at a time (563 ms latency each), whereas Project 0 bundles the
package on publish and the city already has three.js. It has not been measured in the city (that
needs a publish).

Official dev kit (real sandbox, does **not** apply `experience.json`, so it shows its own veil until
`start()` returns and the prologue appears ready): final build started in 4.9 s (49 files, 493 KB),
0 errors, panel 1 decoded in 105-138 ms inside the worker.
