// Validate (never publish) the lot #323 build in dist/lot/ against the Project 0 server.
// The key is read from a file path (P0_KEY_FILE) inside this process and never printed.
// Run: P0_KEY_FILE=/path/to/keyfile node lot/validate-lot.mjs [--lods-only]
import fs from 'node:fs';
import path from 'node:path';

const LOT_ID = 323; // THE X-PLORATOR. Never 696 (STARBOX) or any other lot.
const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'dist', 'lot');
const keyFile = process.env.P0_KEY_FILE;
if (!keyFile || !fs.existsSync(keyFile)) throw new Error('Set P0_KEY_FILE to a file holding the Project 0 key.');
const key = fs.readFileSync(keyFile, 'utf8').trim();

const form = new FormData();
for (const lod of ['lod0', 'lod1', 'lod2']) {
  form.append(lod, new Blob([fs.readFileSync(path.join(DIR, `${lod}.glb`))], { type: 'model/gltf-binary' }), `${lod}.glb`);
}
if (!process.argv.includes('--lods-only')) {
  const lotJson = JSON.parse(fs.readFileSync(path.join(DIR, 'lot.json'), 'utf8'));
  const files = ['lot.json', lotJson.script, ...new Set(Object.values(lotJson.materials).flatMap(m => [m.surface, m.vertex].filter(Boolean)))];
  for (const f of files) form.append('file', new Blob([fs.readFileSync(path.join(DIR, f))]), f);
}
const res = await fetch(`https://project0.city/api/agent/lots/${LOT_ID}/validate`, {
  method: 'POST', body: form, headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'xplorator-agent/1.0' },
});
const text = await res.text();
let body;
try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
const out = { lot: LOT_ID, status: res.status, at: new Date().toISOString(), response: body };
fs.writeFileSync(path.join(DIR, 'validation.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
