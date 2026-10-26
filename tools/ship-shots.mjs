#!/usr/bin/env node
/**
 * Real renders of the ship models from the exact turnaround angles, through
 * standalone/ship-viewer.html (the game's own sky, lights, materials and post
 * pipeline). Needs `npm start`.
 * Usage: node tools/ship-shots.mjs [--out docs/media/m2/ship] [--size 1200x800] [--bg sky] [--views front,rear,...]
 *        [--model mk2|m1|both] [--loadout 1] [--jpeg]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'docs/media/m2/ship');
const [W, H] = opt('size', '1200x800').split('x').map(Number);
const views = opt('views', 'front,rear,left,right,top,bottom,34front,34rear,flight').split(',');
const model = opt('model', 'mk2'), bg = opt('bg', 'sky'), loadout = opt('loadout', '1');
const jpeg = args.includes('--jpeg');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
for (const view of views) {
  await page.goto(`http://127.0.0.1:5500/standalone/ship-viewer.html?clean=1&view=${view}&model=${model}&bg=${bg}&loadout=${loadout}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shipViewerReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const file = path.join(out, `${model}-${view}${loadout !== '1' ? `-lv${loadout}` : ''}${bg !== 'sky' ? `-${bg}` : ''}.${jpeg ? 'jpg' : 'png'}`);
  await page.screenshot({ path: file, ...(jpeg ? { type: 'jpeg', quality: 88 } : {}) });
  console.log(file);
}
if (errors.length) console.log('errors:', errors.join('\n'));
await browser.close();
