#!/usr/bin/env node
/**
 * Controller test in the official Project 0 dev kit: drives the game with a
 * simulated standard gamepad (devkit.pad), as the game hears it through
 * p0.input.gamepad and the 'pad' event. Menus with the d-pad and A, flight
 * with the left stick, RT boost, X scan, Start pause.
 * Usage: node tools/devkit-pad.mjs [--out dir]   (needs tools/serve.mjs)
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
const page = await (await browser.newContext({ permissions: ['local-network-access'], viewport: { width: 1500, height: 1000 } })).newPage();
const url = 'https://project0.city/devkit?' + new URLSearchParams({ entry: 'http://localhost:5500/main.js', width: '16', depth: '16', height: '30', players: '1', size: '1280x720' });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => Boolean(window.devkit), null, { timeout: 60000 });
console.log('status:', await page.evaluate(() => window.devkit.wait()));
await page.waitForTimeout(3000);
const pad = (axes, pressed = []) => page.evaluate(([a, p]) => {
  const buttons = Array(17).fill(0); for (const i of p) buttons[i] = 1;
  window.devkit.pad({ axes: a, buttons, active: true });
}, [axes, pressed]);
const tapButton = async (i, ms = 120) => { await pad([0, 0, 0, 0], [i]); await page.waitForTimeout(ms); await pad([0, 0, 0, 0]); await page.waitForTimeout(250); };
const shot = name => page.locator('#device').screenshot({ path: path.join(out, `pad-${name}.png`) });

await tapButton(0);            // A: New Journey (focused)
await page.waitForTimeout(1500);
await tapButton(13);           // d-pad down: to the buttons row
await tapButton(15);           // d-pad right: Start Journey
await tapButton(0);            // A: start
await page.waitForTimeout(6500);
await shot('flight');
await pad([0.85, -0.35, 0, 0], [7]); // left stick right/up + RT boost
await page.waitForTimeout(2200);
await shot('steer-boost');
await pad([0, 0, 0, 0]);
await page.waitForTimeout(400);
await tapButton(2);            // X: scan
await page.waitForTimeout(700);
await shot('scan');
await tapButton(9);            // Start: pause
await page.waitForTimeout(700);
await shot('pause');
await page.evaluate(() => window.devkit.pad(null));
const report = await page.evaluate(() => ({ summary: devkit.summary(), errors: devkit.errors, console: devkit.console.slice(-20) }));
fs.writeFileSync(path.join(out, 'pad-report.json'), JSON.stringify(report, null, 2));
console.log(report.summary, '| errors:', report.errors.length);
await browser.close();
