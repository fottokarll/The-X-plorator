# Audio: the music loop, the mix and how they were checked (M2)

All sounds are original and synthesised by `tools/generate-audio.mjs` (no samples). Files are
16-bit mono WAV at 22.05 kHz in `src/assets/audio/`.

## The loop seam: what was actually wrong

Three separate causes, each verified:

1. **The file.** The M1 generator low-passed the pad with a one-pole filter that started from rest.
   The file opened at `0.0000` after ending at `-0.0862`, a step twice as large as any inside the
   loop, so every 24 s there was a click. M2 filters the periodic signal in steady state (one pass
   over the loop warms the filter), so the last sample flows into the first.
2. **Project 0's music player.** Reading the city's sandbox shell (`https://project0.city/sandbox/shell.js`,
   2026-10-25) shows that `p0.music` streams the track through an HTML `Audio` element with
   `loop = true`. Media-element loops are not sample-accurate (a short gap at the seam) and its
   `volume` is ignored on iOS. `p0.sound` instead decodes the file and plays it through a Web Audio
   `AudioBufferSourceNode` with `loop`, which is sample-accurate. M2 plays the pad as **one** looping
   `p0.sound` (never overlapping copies), with `p0.music` only as a fallback for hosts without
   `p0.sound`.
3. **Resampling on decode.** Players' browsers run their audio at 44.1 or 48 kHz, so
   `decodeAudioData` resamples the 22.05 kHz file, and the resampler bends the first and last few
   samples (it treats the buffer ends as edges). Rendering the loop offline in Chromium showed a
   curvature spike of 0.11 exactly at the seam (0.002 elsewhere), at both 44.1 and 48 kHz, and none
   at 22.05 kHz. M2 rotates the periodic loop so that it starts where the waveform crosses zero
   almost flat (|x| ≈ 0.0007): the resampler has nothing to bend. The music is unchanged; it only
   starts at another moment of the same 24 s cycle.

## Checks

- `npm test` (`tests/m2-audio.test.mjs`): seam curvature no larger than inside the loop, the seam
  near-silent and flat but no silent padding, the pad louder than every cue, exactly one looping
  music sound, mute pauses and resumes in place, a new music volume restarts once from the current
  position after the slider settles, effects mute never stops the music.
- `node tools/audio-loop-check.mjs` (needs `npm start`): plays the game's music in Chromium through
  the standalone host, whose `p0.sound` mirrors the city's shell, records the mixed Web Audio output
  on the audio thread (AudioWorklet) for 76 s (three loops), **finds the seams in the recording by
  aligning it with the music file** (envelope correlation, then sample-level; correlation with the
  file at the found seam: 1.000) and measures gaps and discontinuities there.
  Result on 2026-10-26 (headed Chromium, GPU): **0 gaps; at the three seams the sharpest curvature
  is 0.56 × the recording's 99.9th percentile; the sharpest point of the whole recording is the
  music's own content 5.96 s into each loop (1.26 × p99.9), exactly where the offline render has it.**
  Music level in the mix: RMS 0.16. Report: `docs/media/m2/audio-loop.json`.
- Two measurement mistakes were found and fixed on the way, so they are recorded here: a
  `ScriptProcessorNode` recorder produced false spikes (buffers repeated on the main thread), and
  estimating the seam positions from timestamps across threads was unreliable (in one run it was
  11 s off). The AudioWorklet recorder and the alignment replace both.

Not done: listening on real phones and speakers, and inside the live city (the dev kit runs the same
shell, but its audio is in a cross-origin frame that a script cannot record). Please listen to three
loops on your phone: the first test in `M2_UPDATE_REPORT.md`.

## The mix

| | File level (RMS) | Default player volume | Trim | Effective |
|---|---|---|---|---|
| Ambient pad | 0.20 | Music 80 % | 1.0 | 0.160 |
| Scan (new soft sonar chord, 2.6 s) | 0.14 active | Effects 55 % | 0.75 | 0.058 |
| Scan complete | 0.14 active | 55 % | 0.70 | 0.054 |
| Collect | 0.14 active | 55 % | 0.80 | 0.062 |
| Dock | 0.14 active | 55 % | 0.85 | 0.065 |
| Launch | 0.14 active | 55 % | 0.70 | 0.054 |
| Interface tick | 0.14 active | 55 % | 0.40 | 0.031 |

M1 for comparison: pad RMS 0.083 played at 0.32 (0.027 effective) under a bright rising scan sweep at
0.45 (0.070 effective): the scan was about 8 dB louder than the music, collect about 11 dB. M2 puts
every cue 8 to 9 dB under the pad. The city applies its own master volume to both alike (players
start at half volume).

The scan is now a soft D major add-9 chord voiced around D5 that pulses three times, with a breath
of filtered air and a gentle tail; scan-complete, collect and dock are lower, rounder and slower to
attack than in M1 (raised-cosine attacks, no noise sparkle).

## Player settings

Settings → **Music volume** and **Effects volume** sliders (0-100 %: ←/→ in 10 % steps, or drag or tap the bar;
Space or A toggles mute). Mute keeps the level. Saved with the profile for signed-in players;
guests keep them until they leave (Project 0 answers a guest's save with HTTP 401).
