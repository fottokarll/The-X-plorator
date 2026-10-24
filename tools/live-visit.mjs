#!/usr/bin/env node
/**
 * Visits the LIVE city as a signed-out guest (read-only, no key): opens the
 * lot #323 panel, presses Play, waits for THE X-PLORATOR to load inside the
 * city and takes screenshots while it starts a flight with real key input.
 * Enter opens the city's chat, so menus are confirmed with E. Console lines
 * and failed requests go to <out>/<desktop|phone>-console.txt (a guest's
 * save answers 401, as documented). The key flow is for the desktop layout.
 * Usage: node tools/live-visit.mjs [--out dist/live] [--phone]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'dist/live');
const phone = args.includes('--phone');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const context = await browser.newContext(phone
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1600, height: 900 } });
const page = await context.newPage();
const log = [];
page.on('console', m => log.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
page.on('response', r => { if (r.status() >= 400) log.push(`[http ${r.status()}] ${r.request().method()} ${r.url().replace(/[?#].*/, '')}`); });
page.on('pageerror', e => log.push(`[pageerror] ${e.message}`.slice(0, 400)));
const prefix = phone ? 'phone' : 'desktop';
const shot = async name => { await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`) }); console.log('shot', name); };
const wait = ms => page.waitForTimeout(ms);
const press = async (key, ms = 120) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };

await page.goto('https://project0.city/#323', { waitUntil: 'domcontentloaded' });
await wait(12000);
await shot('01-panel');
await page.getByRole('button', { name: /Play/ }).first().click();
const t0 = Date.now();
await wait(10000);
await shot('02-entering');
await wait(15000);
await shot('03-loaded');
console.log('since play', ((Date.now() - t0) / 1000).toFixed(1), 's');
await press('KeyE'); await wait(3000); await shot('04-select');
await press('ArrowDown'); await wait(300); await press('ArrowRight'); await wait(300); await press('KeyE'); await wait(6000); await shot('05-launched');
await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await wait(1500);
await page.keyboard.up('KeyD'); await wait(1500); await page.keyboard.up('KeyW');
await shot('06-flying');
await wait(4000); await shot('07-cruise');
await press('KeyQ'); await wait(2500); await shot('08-scan');
fs.writeFileSync(path.join(out, `${prefix}-console.txt`), log.join('\n'));
await browser.close();
