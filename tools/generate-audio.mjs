#!/usr/bin/env node
/**
 * Synthesises THE X-PLORATOR's original sounds (no samples, no third-party
 * audio): a calm seamless ambient pad and short interface / action cues.
 * Output: src/assets/audio/*.wav (16-bit PCM mono, 22.05 kHz).
 * Usage: node tools/generate-audio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });

function wav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(outDir, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s  ${((44 + data.length) / 1024).toFixed(0)} KB`);
}

const TAU = Math.PI * 2;
const note = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
let seed = 3230323;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// One-pole low-pass for softness.
function lowpass(samples, cutoff) {
  const a = 1 - Math.exp(-TAU * cutoff / RATE);
  let y = 0;
  return samples.map(x => (y += a * (x - y)));
}

// ------------------------------------------------------------- ambient pad
// 24 s loop. Every partial completes a whole number of cycles in the loop and
// every swell has a period that divides it, so the loop is seamless.
{
  const seconds = 24, n = seconds * RATE;
  const out = new Float32Array(n);
  const snap = f => Math.round(f * seconds) / seconds; // whole cycles per loop
  // Two calm chords (D major 9 -> B minor 9), crossfading every 12 s.
  const chords = [[50, 57, 62, 66, 69, 76], [47, 54, 62, 66, 69, 73]];
  for (let c = 0; c < 2; c++) {
    for (const [k, m] of chords[c].entries()) {
      const f = snap(note(m)), detune = snap(note(m) * 1.003);
      const amp = 0.08 / (1 + k * 0.25);
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        // Chord weight: 0.5 - 0.5 cos crossfade with a 24 s period.
        const w = c === 0 ? 0.5 + 0.5 * Math.cos(TAU * t / seconds) : 0.5 - 0.5 * Math.cos(TAU * t / seconds);
        const swell = 0.75 + 0.25 * Math.sin(TAU * t * (k + 1) / seconds + k);
        out[i] += amp * w * swell * (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * detune * t) + 0.18 * Math.sin(TAU * 2 * f * t));
      }
    }
  }
  // A faint high shimmer (whole cycles too) with slow tremolo.
  const sh = snap(note(81));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] += 0.012 * (0.5 + 0.5 * Math.sin(TAU * t * 3 / seconds)) * Math.sin(TAU * sh * t);
  }
  wav('verge-ambient', lowpass(Array.from(out), 2200));
}

// ------------------------------------------------------------- cues
function cue(seconds, fn, cutoff = 6000) {
  const n = Math.round(seconds * RATE), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, i / n);
  return lowpass(out, cutoff);
}
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// Scan: a soft rising sweep with a ring.
wav('scan', cue(0.9, (t) => {
  const f = 520 + 900 * Math.min(1, t / 0.35) ** 0.7;
  return 0.5 * env(t, 0.02, 0.28) * Math.sin(TAU * f * t) + 0.2 * env(t, 0.05, 0.4) * Math.sin(TAU * f * 1.5 * t);
}));

// Scan complete: two bright bell notes.
wav('scan-done', cue(1.2, (t) => {
  const a = env(t, 0.005, 0.35) * Math.sin(TAU * note(76) * t);
  const b = t > 0.12 ? env(t - 0.12, 0.005, 0.5) * Math.sin(TAU * note(83) * (t - 0.12)) : 0;
  return 0.45 * (a + b) + 0.08 * (a + b) * Math.sin(TAU * 3 * note(76) * t);
}));

// Collect: a sparkling three-note arpeggio with a little shimmer.
wav('collect', cue(1.3, (t) => {
  let s = 0;
  [81, 85, 88].forEach((m, k) => {
    const t0 = k * 0.09;
    if (t > t0) s += env(t - t0, 0.004, 0.32) * Math.sin(TAU * note(m) * (t - t0));
  });
  return 0.4 * s + 0.03 * env(t, 0.01, 0.4) * rnd();
}));

// Dock / mission chord: a warm low bloom.
wav('dock', cue(2.4, (t) => {
  let s = 0;
  [45, 52, 61, 64].forEach((m, k) => { s += Math.sin(TAU * note(m) * t + k) / (1 + k * 0.3); });
  return 0.32 * s * env(t, 0.25, 0.9);
}, 2600));

// Launch: a filtered breath of noise rising in pitch.
{
  let y = 0;
  wav('launch', cue(1.4, (t) => {
    const a = 0.02 + 0.25 * Math.min(1, t / 1.0);
    y += a * (rnd() - y);
    return 0.6 * y * env(t, 0.5, 0.35) + 0.12 * env(t, 0.6, 0.3) * Math.sin(TAU * (90 + 140 * t) * t);
  }, 3000));
}

// UI: a short soft tick.
wav('ui', cue(0.09, (t) => 0.35 * env(t, 0.002, 0.018) * Math.sin(TAU * 1100 * t), 8000));
