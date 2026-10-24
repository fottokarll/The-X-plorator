#!/usr/bin/env node
/**
 * Composes screenshots into one labelled contact sheet (PNG) for review.
 * Usage: node tools/contact-sheet.mjs out.png --height 520 a.png b.png ...
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const out = args.shift();
let height = 520;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--height') height = Number(args[++i]);
  else files.push(path.resolve(args[i]));
}
const cells = files.map(f => {
  const data = fs.readFileSync(f).toString('base64');
  return `<figure><img src="data:image/png;base64,${data}" style="height:${height}px"><figcaption>${path.basename(f, '.png')}</figcaption></figure>`;
}).join('');
const html = `<!doctype html><html><body style="margin:0;background:#050b1e;display:flex;flex-wrap:wrap;gap:12px;padding:12px;font:13px sans-serif;color:#cfe8ff">${cells}
<style>figure{margin:0}figcaption{padding:4px 2px}img{display:block;border:1px solid #234}</style></body></html>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 800 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
