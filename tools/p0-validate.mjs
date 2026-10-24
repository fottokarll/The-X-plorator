#!/usr/bin/env node
/**
 * VALIDATES (never publishes) the experience package against Project 0's
 * server checks for lot #323 only:
 *   POST https://project0.city/api/agent/lots/323/experience/validate
 * The key is read in-process from P0_KEY or the file named by P0_KEY_FILE and
 * is never printed, logged or written. Lot #696 (STARBOX) or any other lot is
 * refused by design. Publishing requires the owner's explicit approval and is
 * intentionally not implemented here (see docs/P0_PUBLISH_CHECKLIST.md).
 * Usage: P0_KEY_FILE=/path/to/key node tools/p0-validate.mjs [dist/the-xplorator-experience.zip]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOT = 323;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zip = process.argv[2] ?? path.join(root, 'dist', 'the-xplorator-experience.zip');
const key = (process.env.P0_KEY ?? (process.env.P0_KEY_FILE ? fs.readFileSync(process.env.P0_KEY_FILE, 'utf8') : '')).trim();
if (!key) { console.error('Set P0_KEY or P0_KEY_FILE (the key is never stored in this repository).'); process.exit(2); }
if (!fs.existsSync(zip)) { console.error(`Package not found: ${zip} (run npm run package)`); process.exit(2); }

const form = new FormData();
form.append('package', new Blob([fs.readFileSync(zip)], { type: 'application/zip' }), 'experience.zip');
const res = await fetch(`https://project0.city/api/agent/lots/${LOT}/experience/validate`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'xplorator-agent/1.0' },
  body: form,
});
const text = await res.text();
let body;
try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
const out = path.join(root, 'dist', 'experience-validation.json');
fs.writeFileSync(out, JSON.stringify({ lot: LOT, status: res.status, at: new Date().toISOString(), body }, null, 2));
console.log(`HTTP ${res.status} · ok=${body.ok} · errors=${(body.errors ?? []).length} · warnings=${(body.warnings ?? []).length}`);
for (const e of body.errors ?? []) console.log('  error:', typeof e === 'string' ? e : JSON.stringify(e));
for (const w of body.warnings ?? []) console.log('  warning:', typeof w === 'string' ? w : JSON.stringify(w));
console.log(`saved ${path.relative(root, out)}`);
process.exit(res.ok && body.ok ? 0 : 1);
