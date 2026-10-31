#!/usr/bin/env node
/**
 * Measures the real loading of the standalone game in Chromium, optionally on
 * an emulated slow network (Chrome DevTools network conditions):
 *   - when the first prologue frame was drawn and when panel 1 was decoded,
 *   - when start() finished (the game ready), from the game's own console lines,
 *   - bytes transferred per kind (JS, comic art, audio, three.js).
 * Needs `npm start`. Usage:
 *   node tools/load-timing.mjs [--net none|fast3g|slow3g] [--size 390x844] [--touch] [--three-local] [--out file.json]
 * Times are page milliseconds since navigation on THIS machine and browser; a
 * phone or the city will differ. The city also serves files from its own
 * cache, so this is an upper bound for a second visit there.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const net = opt('net', 'none');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const touch = args.includes('--touch');
const out = opt('out', `docs/media/m2/loading-${net}-${W}x${H}${args.includes('--three-local') ? '-three-local' : ''}.json`);
const NETS = {
  none: null,
  // DevTools presets (download/upload in bytes per second, latency in ms).
  fast3g: { offline: false, latency: 563, downloadThroughput: 1.6 * 1024 * 1024 / 8 * 0.9, uploadThroughput: 750 * 1024 / 8 * 0.9 },
  slow3g: { offline: false, latency: 2000, downloadThroughput: 500 * 1024 / 8 * 0.8, uploadThroughput: 500 * 1024 / 8 * 0.8 },
};

const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (NETS[net]) await cdp.send('Network.emulateNetworkConditions', NETS[net]);
const bytes = {};
const kind = url => (url.includes('/assets/comic/') ? 'comic art' : url.includes('/assets/audio/') ? 'audio' : url.includes('/vendor/three/') ? 'three.js (platform-provided in Project 0)' : url.endsWith('.js') ? 'game JavaScript' : 'other');
const files = {};
cdp.on('Network.loadingFinished', e => { const f = files[e.requestId]; if (f) { bytes[f] = (bytes[f] ?? 0) + e.encodedDataLength; } });
cdp.on('Network.requestWillBeSent', e => { files[e.requestId] = kind(e.request.url); });
const events = [];
page.on('console', m => {
  const t = m.text();
  const first = t.match(/first prologue frame at (\d+) ms/); if (first) events.push({ event: 'first prologue frame', ms: +first[1] });
  const art = t.match(/prologue art (\S+) ready in (\d+) ms \(at (\d+) ms\)/); if (art) events.push({ event: `art ${path.basename(art[1])}`, ms: +art[3], decodeMs: +art[2] });
  const done = t.match(/start\(\) finished after (\d+) ms/); if (done) events.push({ event: 'start() finished (game ready)', bootMs: +done[1] });
});
// --three-local: three.js comes from memory, as in Project 0 where the city
// has already loaded it (the experience shares its pinned copy).
const threeLocal = args.includes('--three-local');
if (threeLocal) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'node_modules', 'three');
  await page.route('**/vendor/three/**', route => {
    const rel = new URL(route.request().url()).pathname.replace('/vendor/three/', '');
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(root, rel)) });
  });
}
const t0 = Date.now();
await page.goto('http://127.0.0.1:5500/?fresh=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 300000 });
const readyAt = await page.evaluate(() => performance.now());
events.push({ event: 'game ready (page)', ms: Math.round(readyAt) });
await page.waitForTimeout(NETS[net] ? 20000 : 3000); // let the remaining art and audio arrive
const report = {
  date: new Date().toISOString(), machine: 'this Linux PC (4 cores, Intel HD Graphics 6000)', browser: 'Chromium (Playwright), headed, GPU, cache disabled',
  network: net, conditions: NETS[net], threeFromMemory: threeLocal, view: `${W}x${H}${touch ? ' touch dpr2' : ''}`, wallSeconds: (Date.now() - t0) / 1000,
  events: events.sort((a, b) => (a.ms ?? 1e9) - (b.ms ?? 1e9)),
  kilobytes: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, +(v / 1024).toFixed(1)])),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
