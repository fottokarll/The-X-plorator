#!/usr/bin/env node
/**
 * Synthesises THE X-PLORATOR's original sounds (no samples, no third-party
 * audio): a calm seamless ambient pad and short, soft interface / action cues.
 * Output: src/assets/audio/*.wav (16-bit PCM mono, 22.05 kHz) and a level
 * report on stdout.
 * Usage: node tools/generate-audio.mjs
 *
 * M2 changes (see docs/AUDIO.md):
 * - The ambient loop is filtered in steady state (the filter runs over the
 *   loop once before the kept pass), so the last sample flows into the first.
 *   M1 started the low-pass from rest: the file opened at 0.0 after ending at
 *   -0.086, a click at every loop.
 * - Loudness: the pad is levelled to an RMS of 0.2 (it was 0.083, peak 0.33)
 *   and every cue to a common active RMS, so the in-game mix is set by the
 *   volumes in src/game/audio.js rather than by accidents of synthesis.
 * - Scan is a soft, airy, pulsing sonar chord with a gentle tail instead of a
 *   bright rising sweep; collect, dock and interface cues are quieter and warmer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });

const rms = s => Math.sqrt(s.reduce((a, v) => a + v * v, 0) / Math.max(1, s.length));
const peakOf = s => s.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
// RMS over the part of a cue that is actually sounding (within 20 dB of its peak).
function activeRms(s) {
  const p = peakOf(s), win = Math.round(RATE * 0.02);
  const parts = [];
  for (let i = 0; i + win <= s.length; i += win) {
    const seg = s.slice(i, i + win);
    if (peakOf(seg) > p * 0.1) parts.push(...seg);
  }
  return rms(parts);
}

function level(samples, { targetRms, maxPeak = 0.9, active = false }) {
  const r = active ? activeRms(samples) : rms(samples);
  let gain = targetRms / Math.max(r, 1e-9);
  const p = peakOf(samples) * gain;
  if (p > maxPeak) gain *= maxPeak / p;
  return samples.map(v => v * gain);
}

const report = [];
function wav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(outDir, `${name}.wav`), Buffer.concat([header, data]));
  report.push({ name, seconds: +(samples.length / RATE).toFixed(2), kb: Math.round((44 + data.length) / 1024), rms: +rms(samples).toFixed(3), activeRms: +activeRms(samples).toFixed(3), peak: +peakOf(samples).toFixed(3) });
}

const TAU = Math.PI * 2;
const note = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
let seed = 3230323;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// One-pole low-pass for softness (starts from rest: fine for cues that begin silent).
function lowpass(samples, cutoff) {
  const a = 1 - Math.exp(-TAU * cutoff / RATE);
  let y = 0;
  return samples.map(x => (y += a * (x - y)));
}

// The same low-pass for a periodic signal: the filter first runs over one
// whole period, so the kept period starts in the state the previous one ended.
function lowpassLoop(samples, cutoff) {
  const a = 1 - Math.exp(-TAU * cutoff / RATE);
  let y = 0;
  for (const x of samples) y += a * (x - y);
  return samples.map(x => (y += a * (x - y)));
}

// Players' browsers decode the file into an AudioContext running at 44.1 or
// 48 kHz, so the 22.05 kHz loop is RESAMPLED on decode, and the resampler
// treats the buffer's ends as edges: the first and last few samples bend, a
// click at every seam (measured with OfflineAudioContext: curvature 0.11 at
// the seam, 0.002 elsewhere). Rotating the periodic loop so it starts where
// the waveform is almost silent and almost flat leaves the resampler nothing
// to bend. The music itself is unchanged; it simply starts at another moment.
function rotateToQuietSeam(samples) {
  const n = samples.length;
  let best = 0, bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    const a = samples[(i - 1 + n) % n], b = samples[i], c = samples[(i + 1) % n];
    const score = Math.abs(b) / 0.2 + (Math.abs(b - a) + Math.abs(c - b)) / 0.05;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return samples.slice(best).concat(samples.slice(0, best));
}

// ------------------------------------------------------------- ambient pad
// 24 s loop, musically unchanged from M1 (D major 9 -> B minor 9 and back).
// Every partial completes a whole number of cycles in the loop and every swell
// has a period that divides it, so the raw signal is exactly periodic.
{
  const seconds = 24, n = seconds * RATE;
  const out = new Float32Array(n);
  const snap = f => Math.round(f * seconds) / seconds; // whole cycles per loop
  const chords = [[50, 57, 62, 66, 69, 76], [47, 54, 62, 66, 69, 73]];
  for (let c = 0; c < 2; c++) {
    for (const [k, m] of chords[c].entries()) {
      const f = snap(note(m)), detune = snap(note(m) * 1.003);
      const amp = 0.08 / (1 + k * 0.25);
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const w = c === 0 ? 0.5 + 0.5 * Math.cos(TAU * t / seconds) : 0.5 - 0.5 * Math.cos(TAU * t / seconds);
        const swell = 0.75 + 0.25 * Math.sin(TAU * t * (k + 1) / seconds + k);
        out[i] += amp * w * swell * (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * detune * t) + 0.18 * Math.sin(TAU * 2 * f * t));
      }
    }
  }
  const sh = snap(note(81));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] += 0.012 * (0.5 + 0.5 * Math.sin(TAU * t * 3 / seconds)) * Math.sin(TAU * sh * t);
  }
  wav('verge-ambient', rotateToQuietSeam(level(lowpassLoop(Array.from(out), 2200), { targetRms: 0.2, maxPeak: 0.92 })));
}

// ------------------------------------------------------------- cues
// Every cue is levelled to the same active RMS; src/game/audio.js sets the mix.
const CUE_RMS = 0.14;
function cue(seconds, fn, cutoff = 6000) {
  const n = Math.round(seconds * RATE), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i / n);
  // A short fade-out so no cue ends on a step.
  const fade = Math.round(RATE * 0.03);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return level(lowpass(out, cutoff), { targetRms: CUE_RMS, maxPeak: 0.8, active: true });
}
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
// Smooth (raised-cosine) attack: no click, no percussive edge.
const softEnv = (t, attack, decay) => (t < attack ? 0.5 - 0.5 * Math.cos(Math.PI * t / attack) : Math.exp(-(t - attack) / decay));
const tone = (f, t, warmth = 0.12) => Math.sin(TAU * f * t) + warmth * Math.sin(TAU * 2 * f * t);

// Scan: a soft, airy sonar chord that pulses three times and fades on a tail.
// D major add 9 voiced around D5, plus a breath of filtered air under each ping.
{
  let air = 0, air2 = 0;
  const chord = [62, 69, 74, 76, 81].map(note);
  const pulses = [0, 0.46, 0.92];
  wav('scan', cue(2.6, (t) => {
    let amp = 0;
    pulses.forEach((p0, k) => { if (t >= p0) amp += softEnv(t - p0, 0.06, 0.34 + k * 0.18) * (1 - k * 0.22); });
    let s = 0;
    chord.forEach((f, k) => { s += tone(f, t, 0.06) * (k === 0 ? 0.7 : 1) / (1 + k * 0.35); });
    // Gentle shimmer: a slow beat between two close partials.
    s += 0.25 * Math.sin(TAU * chord[4] * 1.004 * t);
    air += 0.18 * (rnd() - air); air2 += 0.18 * (air - air2);
    return 0.16 * s * amp + 0.35 * air2 * amp;
  }, 3200));
}

// Scan complete: two soft bell tones, a fifth apart, lower than M1's.
wav('scan-done', cue(1.6, (t) => {
  const a = softEnv(t, 0.012, 0.45) * tone(note(74), t, 0.08);
  const b = t > 0.14 ? softEnv(t - 0.14, 0.012, 0.6) * tone(note(81), t - 0.14, 0.08) : 0;
  return 0.5 * a + 0.42 * b;
}, 3600));

// Collect: a warm three-note arpeggio (D, F#, A) without the M1 noise sparkle.
wav('collect', cue(1.5, (t) => {
  let s = 0;
  [74, 78, 81].forEach((m, k) => {
    const t0 = k * 0.11;
    if (t > t0) s += softEnv(t - t0, 0.01, 0.38) * tone(note(m), t - t0, 0.15) * (1 - k * 0.12);
  });
  return 0.4 * s;
}, 3800));

// Dock / mission chord: a warm low bloom that resolves to D major.
wav('dock', cue(2.6, (t) => {
  let s = 0;
  [50, 57, 62, 66].forEach((m, k) => { s += Math.sin(TAU * note(m) * t + k) / (1 + k * 0.3); });
  const resolve = t > 0.5 ? softEnv(t - 0.5, 0.2, 0.9) * Math.sin(TAU * note(69) * t) * 0.35 : 0;
  return 0.3 * s * softEnv(t, 0.3, 0.95) + resolve;
}, 2400));

// Launch: a filtered breath of air rising in pitch, with a low hum.
{
  let y = 0;
  wav('launch', cue(1.5, (t) => {
    const a = 0.02 + 0.2 * Math.min(1, t / 1.0);
    y += a * (rnd() - y);
    return 0.55 * y * softEnv(t, 0.5, 0.35) + 0.12 * softEnv(t, 0.6, 0.3) * Math.sin(TAU * (90 + 120 * t) * t);
  }, 2600));
}

// UI: a short, soft wooden tick.
wav('ui', cue(0.12, (t) => 0.35 * softEnv(t, 0.004, 0.025) * tone(660, t, 0.3), 5000));

for (const r of report) console.log(`${r.name.padEnd(14)} ${String(r.seconds).padStart(5)} s  ${String(r.kb).padStart(5)} KB  rms ${r.rms}  active rms ${r.activeRms}  peak ${r.peak}`);
