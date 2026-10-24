#!/usr/bin/env node
/**
 * Converts PNG captures to JPEG (keeps the repository light).
 * Usage: node tools/to-jpeg.mjs <outDir> [--quality 86] [--prefix name-] a.png b.png ...
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const outDir = args.shift();
let quality = 86, prefix = '';
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--quality') quality = Number(args[++i]);
  else if (args[i] === '--prefix') prefix = args[++i];
  else files.push(args[i]);
}
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
for (const f of files) {
  const data = fs.readFileSync(f).toString('base64');
  await page.setContent(`<body style="margin:0"><img id="i" src="data:image/png;base64,${data}"></body>`);
  const size = await page.evaluate(() => new Promise(r => { const i = document.getElementById('i'); const done = () => r([i.naturalWidth, i.naturalHeight]); i.complete ? done() : (i.onload = done); }));
  await page.setViewportSize({ width: size[0], height: size[1] });
  const out = path.join(outDir, `${prefix}${path.basename(f, '.png')}.jpg`);
  await page.locator('#i').screenshot({ path: out, type: 'jpeg', quality });
  console.log(out);
}
await browser.close();
