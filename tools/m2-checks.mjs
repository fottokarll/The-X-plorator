#!/usr/bin/env node
/**
 * End-to-end checks for the M2 release candidate in the standalone game
 * (Chromium, real input events). Needs `npm start`. Writes
 * docs/media/m2/checks/report.json and screenshots. Each check prints PASS/FAIL.
 *   rotation   phone portrait -> landscape in the middle of the prologue keeps the panel
 *   ready      BEGIN cannot be used before the game is ready, and stays once shown
 *   gamepad    prologue, menu, vessel choice and steering with a standard controller
 *   oldsave    an M1-format save (signed-in player) loads, continues, keeps its progress
 *   exposure   the hangar at Low, Medium and High quality (screenshots)
 *   buttons    every flight HUD button (desktop): boost, scan, base, hangar, map, pause
 * Usage: node tools/m2-checks.mjs [--only rotation,ready,...] [--out docs/media/m2/checks]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'docs/media/m2/checks');
const only = opt('only', 'rotation,ready,gamepad,oldsave,exposure,buttons').split(',');
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:5500/standalone/';
const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const results = [];

async function open({ size = [1280, 720], touch = false, query = 'fresh=1', save = null, early = false } = {}) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (save) {
    await page.goto(`${BASE}?noown=1&fresh=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(s => localStorage.setItem('xplorator.save.v1', JSON.stringify(s)), save);
  }
  await page.goto(`${BASE}?${query}`, { waitUntil: 'domcontentloaded' });
  if (early) await page.waitForFunction(() => window.__xpOwnLoading !== undefined, null, { timeout: 30000 });
  else await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 120000 });
  const state = () => page.evaluate(() => window.__xpGame?.debugState() ?? null);
  const key = async (code, ms = 70) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
  // A standard controller through the host's test hook (window.__fakePad).
  // Presses as long as a person's (a 120 ms tap can fall inside one long frame).
  const pad = async (axes, button = -1, ms = 350) => {
    await page.evaluate(([a, b]) => { const buttons = Array(17).fill(0); if (b >= 0) buttons[b] = 1; window.__fakePad = { axes: [a[0], a[1], 0, 0], buttons }; }, [axes, button]);
    await page.waitForTimeout(ms);
    await page.evaluate(() => { window.__fakePad = { axes: [0, 0, 0, 0], buttons: Array(17).fill(0) }; });
    await page.waitForTimeout(250);
  };
  return { context, page, errors, state, key, pad, shot: name => page.screenshot({ path: path.join(out, `${name}.png`) }) };
}
async function check(name, fn) {
  if (!only.includes(name)) return;
  const t0 = Date.now();
  let ok = false, notes = [];
  try { ok = await fn(notes); } catch (e) { notes.push(`exception: ${e.message}`); }
  results.push({ name, ok, notes, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${notes.join(' | ')}`);
}

await check('rotation', async notes => {
  const g = await open({ size: [390, 844], touch: true });
  for (let i = 0; i < 2; i++) { await g.page.touchscreen.tap(290, 790); await g.page.waitForTimeout(300); }
  const before = (await g.state()).story;
  await g.shot('rotation-portrait');
  await g.page.setViewportSize({ width: 844, height: 390 });
  await g.page.waitForTimeout(800);
  const after = (await g.state()).story;
  await g.shot('rotation-landscape');
  notes.push(`portrait panel ${before.index + 1} (${before.layout}) -> landscape panel ${after.index + 1} (${after.layout})`, `errors ${g.errors.length}`);
  await g.context.close();
  return before.index === 2 && after.index === 2 && before.layout === 'single' && after.layout === 'cinema' && !g.errors.length;
});

await check('ready', async notes => {
  // Slow the boot on purpose (CPU throttling) so the last panel is reached first.
  const g = await open({ early: true, query: 'fresh=1' });
  const cdp = await g.context.newCDPSession(g.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await g.page.waitForTimeout(1500);
  await g.page.mouse.click(1180, 84); // SKIP STORY while preparing
  await g.page.waitForTimeout(500);
  let routedEarly = false;
  for (let i = 0; i < 8; i++) {
    await g.key('Space'); await g.page.waitForTimeout(250);
    const top = await g.page.evaluate(() => window.__xpGame?.debugState().top ?? 'story (booting)');
    if (top === 'menu') routedEarly = !(await g.page.evaluate(() => window.__xpReady === true));
  }
  await g.shot('ready-preparing');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await g.page.waitForFunction(() => window.__xpReady === true, null, { timeout: 180000 });
  await g.page.waitForTimeout(500);
  const s1 = await g.state();
  await g.page.waitForTimeout(10000); // nothing may move on its own
  const s2 = await g.state();
  await g.shot('ready-begin');
  await g.key('Space');
  await g.page.waitForTimeout(1500);
  const s3 = await g.state();
  notes.push(`menu before ready: ${routedEarly}`, `after ready: ${s1.top}/${s1.story?.primary}`, `10 s later: ${s2.top}/${s2.story?.primary}`, `after Space: ${s3.top}`, `errors ${g.errors.length}`);
  await g.context.close();
  return !routedEarly && s1.top === 'story' && s1.story.primary === 'begin' && s2.top === 'story' && s2.story.primary === 'begin' && s3.top === 'menu' && !g.errors.length;
});

await check('gamepad', async notes => {
  const g = await open({});
  await g.page.waitForTimeout(1500); // the remaining panels decode just after boot
  for (let i = 0; i < 6; i++) await g.pad([0, 0], 15); // d-pad right: next panel
  await g.pad([0, 0], 0); // A: BEGIN THE EXODUS
  await g.page.waitForTimeout(1500);
  const menu = (await g.state()).top;
  await g.pad([0, 0], 0); // A: New Journey
  await g.page.waitForTimeout(1500);
  const select = (await g.state()).top;
  await g.pad([0, 0], 0); // A on the selected Survivor: the free check
  await g.page.waitForTimeout(700);
  const choice = (await g.state()).top;
  await g.pad([0, 0], 0); // A: Continue free
  await g.page.waitForTimeout(6000);
  // The opening briefing: A moves it on, line by line (the ship holds meanwhile).
  const briefing = (await g.state()).tutorial.briefing;
  for (let i = 0; i < 8 && (await g.state()).tutorial.briefing; i++) { await g.pad([0, 0], 0); await g.page.waitForTimeout(1700); }
  const s0 = await g.state();
  // Left stick: steer, held until the game has counted 1 s of steering (game
  // time runs slower than the wall clock when frames are slow) or 5 s pass.
  await g.page.evaluate(() => { window.__fakePad = { axes: [0.9, 0, 0, 0], buttons: Array(17).fill(0) }; });
  for (let t = 0; t < 25 && (await g.state()).tutorial.step === 'steer'; t++) await g.page.waitForTimeout(200);
  await g.page.evaluate(() => { window.__fakePad = { axes: [0, 0, 0, 0], buttons: Array(17).fill(0) }; });
  await g.page.waitForTimeout(400);
  const s1 = await g.state();
  await g.shot('gamepad-flight');
  notes.push(`menu ${menu}, select ${select}, check ${choice}, mode ${s0.mode}, briefing ${briefing ? 'shown, heard with A' : 'NOT SHOWN'}`, `yaw ${s0.yaw.toFixed(2)} -> ${s1.yaw.toFixed(2)}`, `tutorial ${s0.tutorial.step} -> ${s1.tutorial.step}`, `errors ${g.errors.length}`);
  await g.context.close();
  return menu === 'menu' && select === 'select' && choice === 'choice' && s0.mode === 'flight' && briefing && !s0.tutorial.briefing && Math.abs(s1.yaw - s0.yaw) > 0.2 && s1.tutorial.step === 'speed' && !g.errors.length;
});

await check('oldsave', async notes => {
  // An M1 save as a signed-in player has it (no flags, tutorial or volume fields).
  const m1 = {
    v: 1, started: true, vessel: 'survivor',
    equipped: { engine: 2, hull: 1, reactor: 1, scanner: 1, cargo: 1, shield: 1, miner: 1 },
    inventory: ['scanner-2', 'engine-2'], cargo: { cryon: 3, ferrite: 0 }, bank: { cryon: 6, ferrite: 2 },
    mission: { id: 'first-light', step: 'free', delivered: 6, scanned: ['cryon-a'], collected: ['cryon-a'] },
    nodes: {}, base: [{ q: 0, r: 0, type: 'hub' }, { q: 1, r: 0, type: 'dock' }, { q: 0, r: 1, type: 'solar' }],
    powered: true, stats: { playSeconds: 812, crystals: 9, ore: 2, docks: 2 }, discovered: ['outer-verge'],
    settings: { quality: 'auto', handling: 'tranquil', invertY: false, sensitivity: 1, autoCruise: true, reducedMotion: false, cameraZoom: 1, hints: true, sound: true, music: false, bindings: {} },
  };
  const g = await open({ save: m1, query: '' });
  const s0 = await g.state();
  await g.shot('oldsave-first-visit');
  // First M2 visit: the prologue (new content), then Continue.
  if (s0.top === 'story') { await g.page.mouse.click(1180, 84); await g.page.waitForTimeout(1500); }
  const menu = (await g.state()).top;
  await g.key('Space'); // Continue (focused for a save)
  await g.page.waitForTimeout(6000);
  const s1 = await g.state();
  const saved = await g.page.evaluate(() => JSON.parse(localStorage.getItem('xplorator.save.v1')));
  notes.push(`first screen ${s0.top}, menu ${menu}, after Continue ${s1.mode}`, `bank ${s1.bank.cryon}/${s1.bank.ferrite}, engine Lv ${s1.equipped.engine}, step ${s1.step}, tutorial done ${s1.tutorial.done}`,
    `saved: prologueSeen ${saved?.flags?.prologueSeen}, music muted kept ${saved?.settings?.music === false}, musicVolume ${saved?.settings?.musicVolume}`, `errors ${g.errors.length}`);
  await g.context.close();
  return s0.top === 'story' && menu === 'menu' && s1.mode === 'flight' && s1.bank.cryon === 6 && s1.bank.ferrite === 2 && s1.equipped.engine === 2 && s1.step === 'free' && s1.tutorial.done === true
    && saved?.flags?.prologueSeen === true && saved?.settings?.music === false && !g.errors.length;
});

await check('exposure', async notes => {
  let ok = true;
  for (const quality of ['low', 'medium', 'high']) {
    const save = { v: 1, started: true, vessel: 'survivor', flags: { prologueSeen: true }, settings: { quality, music: false } };
    const g = await open({ save, query: '' });
    await g.page.waitForTimeout(1200);
    await g.key('Space'); // Continue
    await g.page.waitForTimeout(5500);
    await g.key('KeyH');
    await g.page.waitForTimeout(2500);
    await g.shot(`exposure-hangar-${quality}`);
    const q = (await g.state()).quality;
    notes.push(`${quality}: ${q}, errors ${g.errors.length}`);
    ok = ok && q === quality && !g.errors.length;
    await g.context.close();
  }
  return ok;
});

await check('buttons', async notes => {
  const save = { v: 1, started: true, vessel: 'survivor', flags: { prologueSeen: true }, tutorial: { done: true }, settings: { music: false } };
  const g = await open({ save, query: '', size: [1600, 900] });
  await g.page.waitForTimeout(1200);
  await g.key('Space');
  await g.page.waitForTimeout(6000);
  const v = await g.page.evaluate(() => window.__xpGame.ui.view);
  const u = v.u, pad = v.pad;
  const by = v.h - pad - 52 * u, gap = 92 * u, x0 = v.w / 2 - 2 * gap;
  const at = i => [x0 + i * gap, by];
  const seen = [];
  const press = async (pt, ms = 80) => { await g.page.mouse.move(pt[0], pt[1]); await g.page.mouse.down(); await g.page.waitForTimeout(ms); await g.page.mouse.up(); await g.page.waitForTimeout(600); };
  await press(at(0), 900); seen.push(`boost ${(await g.state()).mode}`);
  await press(at(1)); seen.push(`scan ${(await g.state()).scanning ? 'scanning' : 'no signal in range'}`);
  await press(at(3)); await g.page.waitForTimeout(1500); seen.push(`base ${(await g.state()).top}`); await g.key('Backspace'); await g.page.waitForTimeout(1200);
  await press(at(4)); await g.page.waitForTimeout(1500); seen.push(`hangar ${(await g.state()).top}`); await g.key('Backspace'); await g.page.waitForTimeout(1200);
  const r = Math.max(19 * u, 19 * u);
  const top = Math.max(v.p0Top, pad) > pad && v.phone ? v.p0Top : pad;
  const btn = i => [v.w - pad - r - i * (r * 2 + 12 * u), top + r - 4 * u];
  await press(btn(2)); await g.page.waitForTimeout(1200); seen.push(`map ${(await g.state()).top}`); await g.key('Backspace'); await g.page.waitForTimeout(1200);
  await press(btn(1)); await g.page.waitForTimeout(1500); seen.push(`hangar(top) ${(await g.state()).top}`); await g.key('Backspace'); await g.page.waitForTimeout(1200);
  await press(btn(0)); await g.page.waitForTimeout(800); seen.push(`pause ${(await g.state()).top}`);
  await g.shot('buttons-pause');
  await g.key('Backspace'); await g.page.waitForTimeout(600); seen.push(`resume ${(await g.state()).top}`);
  notes.push(seen.join(', '), `errors ${g.errors.length}`);
  await g.context.close();
  return seen.join(',').includes('base base') && seen.join(',').includes('hangar hangar') && seen.join(',').includes('map map') && seen.join(',').includes('pause pause') && seen.at(-1) === 'resume hud' && !g.errors.length;
});

await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ date: new Date().toISOString(), browser: 'Chromium (Playwright), headed, GPU', results }, null, 2));
const failed = results.filter(r => !r.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
