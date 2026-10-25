#!/usr/bin/env node
/**
 * End-to-end playtest of the M1 loop with REAL keyboard input only:
 *   menu -> new journey -> fly to Cryon -> scan (Q) -> collect (E) -> repeat
 *   -> return to Haven Outpost -> dock (E) -> mission complete.
 * The pilot reads the game state through the read-only debugState() snapshot
 * (standalone host only) and steers with W/A/S/D, brakes with C. There are no
 * teleports or state setters. Screenshots at each milestone; exits non-zero on
 * failure. Usage: node tools/play-loop.mjs [--size 1920x1080] [--out dir] [--headless]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const [W, H] = opt('size', '1600x900').split('x').map(Number);
const out = opt('out', 'docs/media/playtest');
fs.mkdirSync(out, { recursive: true });
const headless = args.includes('--headless');
const browser = await chromium.launch({ headless, args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
const log = [];
const note = s => { const line = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; log.push(line); console.log(line); };
const t0 = Date.now();

await page.goto(`http://127.0.0.1:5500/?fresh=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 90000 });
const state = () => page.evaluate(() => window.__xpGame.debugState());
const shot = name => page.screenshot({ path: path.join(out, `${name}.png`) });
const tap = async (code, ms = 70) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
const held = new Set();
const hold = async (code, on) => {
  if (on && !held.has(code)) { await page.keyboard.down(code); held.add(code); }
  if (!on && held.has(code)) { await page.keyboard.up(code); held.delete(code); }
};
const releaseAll = async () => { for (const c of [...held]) await hold(c, false); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

await page.waitForTimeout(2500);
await tap('Space'); // New Journey (focused on a fresh profile)
await page.waitForTimeout(1500);
// Start Journey: focus moves down from the Survivor card to the buttons.
await tap('ArrowDown'); await page.waitForTimeout(150);
let s = await state();
if (s.top === 'select') { await tap('ArrowRight'); await page.waitForTimeout(150); await tap('Space'); }
// M2: a pressure-free check opens ("Continue free" / "View other ships"); Continue free is focused.
await page.waitForTimeout(400);
s = await state();
if (s.top === 'choice') { await tap('Space'); }
await page.waitForFunction(() => window.__xpGame.debugState().mode === 'flight', null, { timeout: 20000 });
note('flight started');
await shot('01-launch');

const milestones = new Set();
let lastStep = '';
let stuck = { pos: null, since: Date.now() };
const deadline = Date.now() + Number(opt('timeout', 300)) * 1000;
let ok = false;
while (Date.now() < deadline) {
  s = await state();
  if (s.step !== lastStep) { note(`mission step: ${s.step} (cargo ${s.cargo.cryon} Cryon)`); lastStep = s.step; }
  if (s.top === 'complete') { note('MISSION COMPLETE panel shown'); await releaseAll(); await page.waitForTimeout(800); await shot('06-complete'); ok = true; break; }
  if (s.mode === 'docking') { await releaseAll(); if (!milestones.has('dock')) { milestones.add('dock'); await page.waitForTimeout(1200); await shot('05-docking'); } await page.waitForTimeout(200); continue; }
  if (s.mode !== 'flight' || !s.target) { await releaseAll(); await page.waitForTimeout(150); continue; }
  const d = [s.target[0] - s.pos[0], s.target[1] - s.pos[1], s.target[2] - s.pos[2]];
  const dist = Math.hypot(...d);
  // Aim a little above node centres (crystals sprout upward), straight at the dock.
  const aimY = s.kind === 'node' ? d[1] + 10 : d[1] + 6;
  const yawErr = wrap(Math.atan2(d[0], d[2]) - s.yaw);
  const pitchErr = Math.asin(Math.max(-1, Math.min(1, aimY / Math.max(1, dist)))) - s.pitch;
  // Positive yaw (toward +x) is the A key in this game (screen-left looking down +z).
  await hold('KeyA', yawErr > 0.04); await hold('KeyD', yawErr < -0.04);
  await hold('KeyW', pitchErr > 0.04); await hold('KeyS', pitchErr < -0.04);
  const near = s.kind === 'node' ? 60 : 55;
  await hold('KeyC', dist < near + 25 || Math.abs(yawErr) > 1.2);
  if (s.kind === 'node') {
    const scanned = s.scanned.includes(s.targetId);
    if (!scanned && dist < s.scanRange && !s.scanning) {
      await tap('KeyQ'); note(`scan ${s.targetId} at ${Math.round(dist)} u`);
      await page.waitForTimeout(500);
      if (!milestones.has('scan')) { milestones.add('scan'); await shot('02-scanning'); }
    } else if (scanned && s.interact === 'collect' && !s.mining) {
      await tap('KeyE'); note(`collect ${s.targetId} at ${Math.round(dist)} u`);
      await page.waitForTimeout(700);
      if (!milestones.has('mine')) { milestones.add('mine'); await shot('03-mining'); }
    }
  } else if (s.kind === 'station' && s.interact === 'dock') {
    await releaseAll(); await tap('KeyE'); note(`dock at ${Math.round(dist)} u`);
    if (!milestones.has('return')) { milestones.add('return'); }
  }
  if (s.step === 'return' && !milestones.has('return-shot')) { milestones.add('return-shot'); await shot('04-returning'); }
  // Stuck detection: if barely moving toward the target for 6 s, back off.
  if (!stuck.pos || Math.hypot(s.pos[0] - stuck.pos[0], s.pos[2] - stuck.pos[2]) > 25) stuck = { pos: s.pos, since: Date.now() };
  else if (Date.now() - stuck.since > 6000) { note('unsticking'); await releaseAll(); await hold('KeyW', true); await page.waitForTimeout(900); await hold('KeyW', false); stuck = { pos: null, since: Date.now() }; }
  await page.waitForTimeout(90);
}
await releaseAll();
// Optional: spend the delivered Cryon in the hangar (craft + equip Ion Drive II).
if (ok && args.includes('--hangar')) {
  await tap('Space'); // 'Open Hangar' is the default focus on the completion panel
  await page.waitForFunction(() => window.__xpGame.debugState().top === 'hangar', null, { timeout: 8000 });
  await page.waitForTimeout(1500);
  await shot('07-hangar');
  const box = await page.evaluate(() => { const r = window.__xpGame.ui; return r.view; });
  // Action button in the detail panel (desktop layout): computed from the same layout rules.
  const u = Math.max(0.78, Math.min(1.6, Math.min(box.w / 1280, box.h / 720)));
  const pad = Math.round(16 * u);
  const detailW = Math.max(300 * u, box.w * 0.25), detailX = box.w - pad * 1.5 - detailW;
  const top = Math.max(58, pad), midY = top + 54 * u + 6 * u, bottomH = Math.max(150 * u, box.h * 0.25);
  const invY = box.h - pad - bottomH, midH = invY - midY - 12 * u;
  const btn = { x: detailX + detailW / 2, y: midY + midH - 46 * u - 34 * u + 23 * u };
  await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(700); // craft
  await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(1500); // equip
  const after = await state();
  note(`hangar: engine level ${after.equipped.engine}, inventory ${after.inventory.join(',')}, bank ${after.bank.cryon} Cryon`);
  await shot('08-hangar-upgraded');
  if (after.equipped.engine !== 2) { ok = false; note('FAIL: Ion Drive II not equipped'); }
}
const final = await state();
fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify({ ok, final, errors, log }, null, 2));
note(`${ok ? 'PASS' : 'FAIL'} · bank ${final.bank.cryon} Cryon / ${final.bank.ferrite} Ferrite · errors ${errors.length}`);
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);
