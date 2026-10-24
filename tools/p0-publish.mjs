#!/usr/bin/env node
/**
 * PUBLISHES to Project 0 lot #323 only (owner-approved step, see
 * docs/P0_PUBLISH_CHECKLIST.md). Two targets, as documented in skill.md:
 *   street      POST /api/agent/lots/323/publish     (LOD0/1/2 + lot.json, shaders, build.js from dist/lot/)
 *   experience  POST /api/agent/lots/323/experience  (dist/the-xplorator-experience.zip)
 *   check URL   GET the address a 202 answer returned (review still running)
 * Any other lot, including 696 (STARBOX), is refused by design. The key is
 * read in-process from P0_KEY or the file named by P0_KEY_FILE and is never
 * printed, logged or written; responses are saved with the key redacted.
 * Validate first: npm run lot:validate, npm run p0:validate.
 * Usage: P0_KEY_FILE=/path/to/key node tools/p0-publish.mjs street|experience|check <url>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOT = 323;
const API = 'https://project0.city';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const key = (process.env.P0_KEY ?? (process.env.P0_KEY_FILE ? fs.readFileSync(process.env.P0_KEY_FILE, 'utf8') : '')).trim();
if (!key) { console.error('Set P0_KEY or P0_KEY_FILE (the key is never stored in this repository).'); process.exit(2); }
const headers = { Authorization: `Bearer ${key}`, 'User-Agent': 'xplorator-agent/1.0' };
const redact = s => s.split(key).join('[key]');

function streetForm() {
  const dir = path.join(root, 'dist', 'lot');
  const read = f => fs.readFileSync(path.join(dir, f));
  const manifest = JSON.parse(read('manifest.json'));
  const lotJson = JSON.parse(read('lot.json'));
  const files = ['lot.json', lotJson.script, ...new Set(Object.values(lotJson.materials).flatMap(m => [m.surface, m.vertex].filter(Boolean)))];
  const form = new FormData();
  form.append('manifest', JSON.stringify({ name: manifest.name, description: manifest.description }));
  for (const lod of ['lod0', 'lod1', 'lod2']) form.append(lod, new Blob([read(`${lod}.glb`)], { type: 'model/gltf-binary' }), `${lod}.glb`);
  for (const f of files) form.append('file', new Blob([read(f)]), f);
  console.log(`street build: "${manifest.name}", LOD0/1/2 + ${files.join(', ')}`);
  return { url: `${API}/api/agent/lots/${LOT}/publish`, form };
}

function experienceForm() {
  const zip = path.join(root, 'dist', 'the-xplorator-experience.zip');
  const form = new FormData();
  form.append('package', new Blob([fs.readFileSync(zip)], { type: 'application/zip' }), 'experience.zip');
  console.log(`experience: ${path.relative(root, zip)} (${(fs.statSync(zip).size / 1024).toFixed(1)} KB)`);
  return { url: `${API}/api/agent/lots/${LOT}/experience`, form };
}

let res;
if (target === 'check') {
  const url = new URL(process.argv[3] ?? '', API);
  if (url.origin !== API) { console.error('check: only project0.city addresses'); process.exit(2); }
  res = await fetch(url, { headers });
} else if (target === 'street' || target === 'experience') {
  const { url, form } = target === 'street' ? streetForm() : experienceForm();
  res = await fetch(url, { method: 'POST', headers, body: form });
} else {
  console.error('Usage: node tools/p0-publish.mjs street|experience|check <url>');
  process.exit(2);
}

const text = redact(await res.text());
let body;
try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 4000) }; }
const out = path.join(root, 'dist', `publish-${target}.json`);
fs.writeFileSync(out, JSON.stringify({ lot: LOT, target, status: res.status, at: new Date().toISOString(), body }, null, 2));
console.log(`HTTP ${res.status} (${res.status === 200 ? 'live' : res.status === 202 ? 'review still running' : res.status === 422 ? 'refused' : 'see response'})`);
console.log(JSON.stringify(body, null, 2).slice(0, 3000));
console.log(`saved ${path.relative(root, out)}`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
