#!/usr/bin/env node
/**
 * Drives the standalone game in Chromium and captures REAL screenshots.
 * Usage:
 *   node tools/capture.mjs --size 1920x1080 --out docs/media/m1 [--fresh] [--touch] [--headless] [--jpeg]
 *     --steps "wait:3000;shot:menu;click:new;wait:500;key:Space:200;shot:select"
 * Steps (separated by ';'):
 *   wait:MS             sleep
 *   key:CODE:MS         hold a key (KeyboardEvent.code) for MS milliseconds
 *   down:CODE / up:CODE hold / release a key
 *   tap:X,Y             click (or touch tap with --touch) at CSS px (negative = from right/bottom)
 *   drag:X1,Y1,X2,Y2,MS pointer drag
 *   pad:AX0,AX1,BTN     set a virtual gamepad (left stick x/y, pressed button index or -1); pad:off
 *   shot:NAME           screenshot to OUT/NAME.png
 *   eval:JS             evaluate in the page (window.__p0 is the standalone host)
 *   evalfile:PATH       evaluate a JS expression read from a file (may contain ";")
 *   fps:MS              measure requestAnimationFrame frame times for MS
 *   ready               wait until start() resolved (with --early)
 * Writes OUT/report.json with console errors, frame stats and step log.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = n => args.includes(`--${n}`);
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const out = opt('out', 'docs/media/capture');
const url = opt('url', 'http://127.0.0.1:5500/') + (has('fresh') ? (opt('url', '').includes('?') ? '&' : '?') + 'fresh=1' : '');
const touch = has('touch');
const steps = (opt('steps', 'wait:4000;shot:frame')).split(';').filter(Boolean);
fs.mkdirSync(out, { recursive: true });

const headless = has('headless');
const browser = await chromium.launch({
  headless,
  args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const context = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: Number(opt('dpr', touch ? 2 : 1)), hasTouch: touch, isMobile: touch,
});
const page = await context.newPage();
const logs = [], errors = [];
page.on('console', m => { const t = `${m.type()}: ${m.text()}`; logs.push(t); if (m.type() === 'error') errors.push(t); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
const report = { size: `${W}x${H}`, touch, steps: [], fps: [] };

const resolveXY = (x, y) => [x < 0 ? W + x : x, y < 0 ? H + y : y];
await page.goto(url, { waitUntil: 'domcontentloaded' });
// --early: start the steps as soon as the page's own loading screen runs
// (experience.json loading.own), i.e. while the game is still booting.
if (has('early')) await page.waitForFunction(() => window.__xpOwnLoading !== undefined, null, { timeout: 30000 }).catch(() => errors.push('timeout waiting for the page'));
else await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 90000 }).catch(() => errors.push('timeout waiting for game ready'));
report.t0 = Date.now();

for (const step of steps) {
  const [cmd, ...rest] = step.split(':');
  const arg = rest.join(':');
  report.steps.push(step);
  try {
    if (cmd === 'wait') await page.waitForTimeout(Number(arg));
    else if (cmd === 'key') { const [code, ms] = arg.split(':'); await page.keyboard.down(code); await page.waitForTimeout(Number(ms || 120)); await page.keyboard.up(code); }
    else if (cmd === 'down') await page.keyboard.down(arg);
    else if (cmd === 'up') await page.keyboard.up(arg);
    else if (cmd === 'tap') {
      const [x, y] = resolveXY(...arg.split(',').map(Number));
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    } else if (cmd === 'drag') {
      const [x1, y1, x2, y2, ms] = arg.split(',').map(Number);
      const [a, b] = resolveXY(x1, y1), [c, d] = resolveXY(x2, y2);
      if (touch) {
        const cdp = await context.newCDPSession(page);
        const n = Math.max(2, Math.round((ms || 600) / 30));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a, y: b, id: 1 }] });
        for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a + (c - a) * i / n, y: b + (d - b) * i / n, id: 1 }] }); await page.waitForTimeout(30); }
        await page.waitForTimeout(Number(rest[5] || 0));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(a, b); await page.mouse.down();
        const n = Math.max(2, Math.round((ms || 600) / 30));
        for (let i = 1; i <= n; i++) { await page.mouse.move(a + (c - a) * i / n, b + (d - b) * i / n); await page.waitForTimeout(30); }
        await page.mouse.up();
      }
    } else if (cmd === 'hold') {
      // hold:X,Y,MS  touch/mouse press-and-hold (multi-touch capable with CDP when --touch)
      const [x, y, ms] = arg.split(',').map(Number);
      const [a, b] = resolveXY(x, y);
      if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a, y: b, id: 7 }] });
        await page.waitForTimeout(ms);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(a, b); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); }
    } else if (cmd === 'pad') {
      await page.evaluate(a => {
        const p0 = window.__p0;
        if (a === 'off') { p0.input.gamepad = null; p0.input.pad = false; return; }
        const [x, y, btn] = a.split(',').map(Number);
        const buttons = Array(17).fill(0);
        if (btn >= 0) buttons[btn] = 1;
        p0.input.gamepad = { axes: [x, y, 0, 0], buttons };
        p0.input.pad = true;
      }, arg);
    } else if (cmd === 'ready') {
      await page.waitForFunction(() => window.__xpReady === true, null, { timeout: 120000 });
      report.steps.push(`=> ready after ${Date.now() - report.t0} ms`);
    } else if (cmd === 'shot') {
      if (has('jpeg')) await page.screenshot({ path: path.join(out, `${arg}.jpg`), type: 'jpeg', quality: 86 });
      else await page.screenshot({ path: path.join(out, `${arg}.png`) });
    } else if (cmd === 'evalfile') {
      const r = await page.evaluate(fs.readFileSync(arg, 'utf8'));
      report.steps.push(`=> ${JSON.stringify(r)}`);
    } else if (cmd === 'eval') {
      const r = await page.evaluate(arg);
      report.steps.push(`=> ${JSON.stringify(r)}`);
    } else if (cmd === 'fps') {
      const r = await page.evaluate(ms => new Promise(resolve => {
        const times = []; let last = performance.now(); const end = last + ms;
        function f(now) { times.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else resolve(times); }
        requestAnimationFrame(f);
      }), Number(arg || 3000));
      const sorted = [...r].sort((a, b) => a - b);
      const avg = r.reduce((a, b) => a + b, 0) / r.length;
      report.fps.push({ ms: Number(arg || 3000), frames: r.length, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), worstMs: +sorted[sorted.length - 1].toFixed(2) });
    }
  } catch (e) {
    errors.push(`step ${step}: ${e.message}`);
  }
}
report.renderer = await page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { return 'unknown'; }
});
report.errors = errors;
report.logs = logs.slice(-60);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, errors: errors.length, fps: report.fps, renderer: report.renderer }, null, 1));
if (errors.length) console.log(errors.slice(0, 12).join('\n'));
await browser.close();
