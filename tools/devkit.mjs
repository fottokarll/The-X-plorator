#!/usr/bin/env node
/**
 * Runs THE X-PLORATOR in the official Project 0 dev kit (the real sandbox and
 * runtime, with a simulated session; nothing is published) and records what
 * it reports: status, errors, console, frame times, HUD, plus screenshots.
 * Needs `node tools/serve.mjs` running (http://localhost:5500/main.js).
 *
 * Usage: node tools/devkit.mjs [--phone] [--size 1280x720] [--review] [--slow]
 *          [--out docs/media/devkit] [--keys "KeyW:800,Space:300"] [--players 2] [--headless]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = n => args.includes(`--${n}`);
const out = opt('out', 'docs/media/devkit');
fs.mkdirSync(out, { recursive: true });
const tag = opt('tag', has('phone') ? 'phone' : 'desktop');

const headless = has('headless');
const browser = await chromium.launch({
  headless,
  args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  permissions: ['local-network-access'],
  viewport: { width: 1500, height: 1000 },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 xplorator-devkit-check/1.0',
});
const page = await context.newPage();
const consoleLines = [];
page.on('console', m => { consoleLines.push(`${m.type()}: ${m.text()}`); if (m.text().includes('[devkit]') || m.text().includes('[xplorator]')) console.log(m.text()); });
page.on('pageerror', e => consoleLines.push(`pageerror: ${e.message}`));

const params = new URLSearchParams({
  entry: opt('entry', 'http://localhost:5500/main.js'), width: '16', depth: '16', height: '30', players: opt('players', '1'),
});
if (has('phone')) params.set('phone', '1');
else params.set('size', opt('size', '1280x720'));
if (has('slow')) params.set('slow', '1');
if (has('owner')) params.set('owner', '1');
const url = `https://project0.city/devkit?${params}`;
console.log('dev kit:', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => Boolean(window.devkit), null, { timeout: 60000 });
const status = await page.evaluate(() => window.devkit.wait());
console.log('status:', status);
const shot = async name => { try { await page.locator('#device').screenshot({ path: path.join(out, `${tag}-${name}.png`) }); } catch (e) { consoleLines.push(`screenshot failed: ${e.message}`); } };
const press = async (code, ms) => page.evaluate(([c, m]) => window.devkit.press(c, m), [code, ms]);

const report = { url, status };
if (status === 'started') {
  await page.waitForTimeout(2500);
  // M2: a fresh profile opens on the Exodus prologue (the dev kit does not apply
  // experience.json, so it appears once start() is done, already ready).
  await shot('prologue');
  for (let i = 0; i < 6; i++) { await press('ArrowRight', 80); await page.waitForTimeout(250); }
  await page.waitForTimeout(600);
  await shot('prologue-end');
  await press('Space', 120);
  await page.waitForTimeout(2500);
  await shot('menu');
  // Menu: Space confirms the focused "New Journey" (no save yet in the dev kit).
  await press('Space', 120);
  await page.waitForTimeout(1500);
  await shot('select');
  // Vessel select: move focus to START JOURNEY and confirm.
  await press('ArrowDown', 120); await page.waitForTimeout(200);
  await press('ArrowRight', 120); await page.waitForTimeout(200);
  await press('Space', 120);
  // The free-ship check: CONTINUE FREE is focused.
  await page.waitForTimeout(700);
  await shot('choice');
  await press('Space', 120);
  await page.waitForTimeout(6000);
  await shot('flight');
  for (const spec of (opt('keys', 'KeyA:1400,KeyW:700')).split(',')) {
    const [code, ms] = spec.split(':');
    await press(code, Number(ms));
  }
  await page.waitForTimeout(1500);
  await shot('flight-turn');
  if (has('review')) report.review = await page.evaluate(() => window.devkit.review(14));
}
Object.assign(report, await page.evaluate(() => ({
  status: window.devkit.status, reason: window.devkit.reason, summary: window.devkit.summary(),
  frames: window.devkit.frames, hud: window.devkit.hud, errors: window.devkit.errors, console: window.devkit.console.slice(-80),
})));
report.pageConsole = consoleLines.slice(-80);
fs.writeFileSync(path.join(out, `${tag}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, reason: report.reason, summary: report.summary, frames: report.frames, errors: report.errors }, null, 1));
await browser.close();
