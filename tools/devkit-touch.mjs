#!/usr/bin/env node
/**
 * Touch test in the official Project 0 dev kit (phone=1, 390 x 844): real
 * CDP touch events, including two simultaneous fingers (stick + Boost), to
 * check the game against Project 0's actual pointer events (no pointer ids).
 * Usage: node tools/devkit-touch.mjs [--out dir]   (needs tools/serve.mjs)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/media/devkit';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const context = await browser.newContext({ permissions: ['local-network-access'], viewport: { width: 900, height: 1000 }, hasTouch: true });
const page = await context.newPage();
const url = 'https://project0.city/devkit?' + new URLSearchParams({ entry: 'http://localhost:5500/main.js', width: '16', depth: '16', height: '30', players: '1', phone: '1' });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => Boolean(window.devkit), null, { timeout: 60000 });
console.log('status:', await page.evaluate(() => window.devkit.wait()));
await page.waitForTimeout(3000);
// Close the How-to-play box if present (inside any frame).
for (const frame of page.frames()) {
  const close = frame.locator('#xclose');
  if (await close.count().catch(() => 0)) await close.click().catch(() => {});
}
const box = await page.locator('#device').boundingBox();
const k = box.width / 390;
const P = (x, y) => ({ x: box.x + x * k, y: box.y + y * k });
const cdp = await context.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ ...P(p[0], p[1]), id: p[2] ?? i })) });
const tap = async (x, y) => { await touch('touchStart', [[x, y, 1]]); await page.waitForTimeout(60); await touch('touchEnd', []); };
const shot = name => page.locator('#device').screenshot({ path: path.join(out, `touch-${name}.png`) });

await shot('menu');
await tap(195, 618); // New Journey
await page.waitForTimeout(1800);
await shot('select');
await tap(195, 742); // Start Journey (Survivor is preselected)
await page.waitForTimeout(6500);
await shot('flight');
// Two fingers: stick drag up-right on the left while holding Boost on the right.
await touch('touchStart', [[100, 700, 1], [332, 774, 2]]);
for (let i = 1; i <= 30; i++) {
  await touch('touchMove', [[100 + i * 2, 700 - i * 2, 1], [332, 774, 2]]);
  await page.waitForTimeout(40);
}
await shot('two-finger');
await touch('touchEnd', []);
await page.waitForTimeout(800);
await tap(353, 75); // pause (top-right, below the Project 0 toolbar)
await page.waitForTimeout(900);
await shot('pause');
const report = await page.evaluate(() => ({ status: devkit.status, summary: devkit.summary(), errors: devkit.errors, console: devkit.console.slice(-30) }));
fs.writeFileSync(path.join(out, 'touch-report.json'), JSON.stringify(report, null, 2));
console.log(report.summary);
console.log(report.console.filter(l => l.includes('xplorator')).join('\n'));
console.log('errors:', report.errors.length);
await browser.close();
