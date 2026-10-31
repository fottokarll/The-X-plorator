#!/usr/bin/env node
/**
 * Plays the game's music in Chromium through the standalone host (which uses
 * the same Web Audio path as Project 0's p0.sound) and records the mixed
 * output for three loops of the 24 s ambient pad. Reports:
 *   - the level of the music in the mix (RMS / peak),
 *   - silent gaps (|x| < 1e-4 for more than 5 ms) after the music started,
 *   - the sharpest discontinuities (second-difference spikes) and whether any
 *     lies near a loop boundary.
 * Needs `npm start`. Usage: node tools/audio-loop-check.mjs [--seconds 76] [--out docs/media/m2/audio-loop.json]
 * This is an objective check of the playback path; it does not replace
 * listening on real phones and speakers.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const seconds = Number(opt('seconds', 76));
const out = opt('out', 'docs/media/m2/audio-loop.json');
const LOOP = 24;

const headless = args.includes('--headless');
// Headed (GPU) by default: the software renderer competes with the audio thread.
const browser = await chromium.launch({
  headless,
  args: ['--autoplay-policy=no-user-gesture-required', ...(headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist'])],
});
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5500/?fresh=1&audiotap=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 120000 });
await page.evaluate(() => window.__audioTap.ready);
await page.keyboard.press('KeyX'); // a gesture that does nothing in the game
const t0 = Date.now();
await page.waitForFunction(() => [...window.__p0audio.playing.values()].some(s => s.loop && s.source), null, { timeout: 30000 });
// Discard what was recorded before the music source started.
await page.evaluate(() => window.__audioTap.take());
const startInfo = await page.evaluate(() => {
  const s = [...window.__p0audio.playing.values()].find(x => x.loop);
  return { path: s.path, startedAt: s.startedAt, offset: s.offset, ctxTime: window.__p0audio.ctx.currentTime, rate: window.__audioTap.rate };
});
await page.waitForTimeout(seconds * 1000);
const samples = await page.evaluate(() => Array.from(window.__audioTap.take()));
const after = await page.evaluate(() => window.__p0audio.ctx.currentTime);
await browser.close();

const rate = startInfo.rate;
const x = Float32Array.from(samples);
// The tap's first sample is at ctxTime minus the latency of one 4096 block, at most.
const recStart = after - x.length / rate;
// Loop boundaries in recording time: the source started at startedAt from `offset`.
const bounds = [];
for (let k = 1; k < 10; k++) {
  const t = startInfo.startedAt + (k * LOOP - startInfo.offset) - recStart;
  if (t > 0 && t < x.length / rate) bounds.push(t);
}
// Where the seams really are, from the sound itself: align the recording with
// the music file (envelope correlation over one loop, then a sample-level
// refinement), instead of trusting timestamps across threads.
function readWav(file) {
  const b = fs.readFileSync(file);
  const fileRate = b.readUInt32LE(24), n = (b.length - 44) / 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(44 + i * 2) / 32767;
  return { fileRate, s };
}
const wavPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', startInfo.path);
const { fileRate, s: src } = readWav(wavPath);
const ratio = rate / fileRate;
const loopLen = Math.round(src.length * ratio);
// The file at the output rate (linear interpolation is enough for alignment).
const ref = new Float32Array(loopLen);
for (let i = 0; i < loopLen; i++) { const p = i / ratio, j = Math.floor(p), f = p - j; ref[i] = src[j % src.length] * (1 - f) + src[(j + 1) % src.length] * f; }
const env = (a, win) => { const out = new Float32Array(Math.floor(a.length / win)); for (let k = 0; k < out.length; k++) { let e = 0; for (let i = k * win; i < (k + 1) * win; i++) e += a[i] * a[i]; out[k] = Math.sqrt(e / win); } return out; };
const WIN = Math.round(rate * 0.01);
const er = env(ref, WIN), ex = env(x.subarray(0, Math.min(x.length, loopLen * 2)), WIN);
let bestLag = 0, bestC = -Infinity;
for (let lag = 0; lag < er.length; lag++) {
  let c = 0;
  for (let k = 0; k < er.length && k + lag < ex.length; k++) c += ex[k + lag] * er[k];
  if (c > bestC) { bestC = c; bestLag = lag; }
}
let seam0 = bestLag * WIN, bestS = -Infinity, bestOff = seam0;
for (let o = Math.max(0, seam0 - WIN * 2); o < seam0 + WIN * 2; o++) {
  let c = 0;
  for (let i = 0; i < rate * 0.5 && o + i < x.length; i += 3) c += x[o + i] * ref[i];
  if (c > bestS) { bestS = c; bestOff = o; }
}
// Recorded sample where the file's first sample plays, and every loop after it.
const measuredBounds = [];
for (let b0 = bestOff; b0 < x.length; b0 += loopLen) if (b0 > rate * 0.02) measuredBounds.push(b0 / rate);
// Normalised correlation of the 2 s after the first seam with the file's first 2 s (1 = same waveform).
let sxy = 0, sxx = 0, syy = 0;
for (let i = 0; i < Math.min(rate * 2, x.length - bestOff); i++) { const a = x[bestOff + i], c = ref[i]; sxy += a * c; sxx += a * a; syy += c * c; }
const alignCorr = sxy / Math.sqrt(sxx * syy || 1);

let sum = 0, peak = 0;
for (const v of x) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
const rms = Math.sqrt(sum / Math.max(1, x.length));
// Gaps.
const gaps = [];
let run = 0;
for (let i = 0; i < x.length; i++) {
  if (Math.abs(x[i]) < 1e-4) run++;
  else { if (run > rate * 0.005) gaps.push({ at: +((i - run) / rate).toFixed(3), ms: +(run / rate * 1000).toFixed(1) }); run = 0; }
}
// Discontinuities: second difference relative to the local signal.
const d2 = new Float32Array(x.length);
for (let i = 1; i < x.length - 1; i++) d2[i] = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]);
const sorted = Array.from(d2).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const p999 = sorted[Math.floor(sorted.length * 0.999)];
const spikes = [];
const used = new Uint8Array(x.length);
for (let n = 0; n < 8; n++) {
  let best = -1, bv = 0;
  for (let i = 1; i < x.length - 1; i++) if (!used[i] && d2[i] > bv) { bv = d2[i]; best = i; }
  if (best < 0) break;
  for (let j = Math.max(0, best - rate * 0.05); j < Math.min(x.length, best + rate * 0.05); j++) used[Math.floor(j)] = 1;
  const t = best / rate;
  const nearest = measuredBounds.reduce((m, b) => Math.min(m, Math.abs(b - t)), Infinity);
  spikes.push({ at: +t.toFixed(3), d2: +bv.toFixed(5), ratioToP999: +(bv / p999).toFixed(2), nearLoopBoundaryMs: Number.isFinite(nearest) ? +(nearest * 1000).toFixed(1) : null });
}
// The same measure in a 20 ms window around each boundary vs. the whole recording.
const atBounds = measuredBounds.map(b => {
  const i0 = Math.max(1, Math.floor((b - 0.02) * rate)), i1 = Math.min(x.length - 1, Math.ceil((b + 0.02) * rate));
  let m = 0;
  for (let i = i0; i < i1; i++) m = Math.max(m, d2[i]);
  return { at: +b.toFixed(3), maxD2: +m.toFixed(5), ratioToP999: +(m / p999).toFixed(2) };
});
const report = {
  date: new Date().toISOString(), browser: `Chromium (Playwright, ${headless ? 'headless SwiftShader' : 'headed GPU'}, autoplay allowed)`, path: 'standalone host p0.sound (Web Audio buffer loop, as in Project 0)',
  file: startInfo.path, sampleRate: rate, recordedSeconds: +(x.length / rate).toFixed(1), loopSeconds: LOOP, loopsCovered: bounds.length,
  level: { rms: +rms.toFixed(4), peak: +peak.toFixed(4) }, gaps, d2: { median: +median.toFixed(6), p999: +p999.toFixed(5) },
  seamsFrom: 'alignment of the recording with the music file (envelope + sample correlation)',
  alignment: { firstSeamSeconds: +(bestOff / rate).toFixed(4), correlationWithFile: +alignCorr.toFixed(4), timestampEstimate: bounds.map(b => +b.toFixed(3)) },
  loopBoundaries: atBounds, sharpestSpikes: spikes, errors,
  wallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ level: report.level, gaps: gaps.length, alignment: report.alignment, loopBoundaries: atBounds, sharpest: spikes.slice(0, 3), errors: errors.length }, null, 1));
