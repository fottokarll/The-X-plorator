#!/usr/bin/env node
/**
 * Builds the Project 0 experience package from src/ (the package root) and
 * runs local checks that mirror the published rules in skill.md section 6:
 * readable ES modules (no line over 1,000 characters, no string over 20 KB),
 * only relative / three / three/addons imports, none of the refused APIs,
 * at most 4 MB of JavaScript, experience.json entry present.
 * Output: dist/experience/ + dist/the-xplorator-experience.zip + manifest.
 * The server's own validation is authoritative: run `npm run p0:validate`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const outDir = path.join(root, 'dist', 'experience');
const zipPath = path.join(root, 'dist', 'the-xplorator-experience.zip');
const ALLOWED_EXT = new Set(['.js', '.json', '.glb', '.png', '.jpg', '.webp', '.ogg', '.mp3', '.wav', '.txt']);
const FORBIDDEN = [
  [/\beval\s*\(/, 'eval'], [/new\s+Function\b/, 'new Function'], [/\bWebAssembly\b/, 'WebAssembly'], [/\bWebSocket\b/, 'WebSocket'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bEventSource\b/, 'EventSource'], [/\bindexedDB\b/, 'indexedDB'], [/\bcaches\./, 'caches'],
  [/\blocalStorage\b/, 'localStorage'], [/\bsessionStorage\b/, 'sessionStorage'], [/\bpostMessage\b/, 'postMessage'],
  [/\bimportScripts\b/, 'importScripts'], [/new\s+Worker\b/, 'Worker'], [/\bfetch\s*\(/, 'fetch'], [/\bself\s*\[/, 'self[...]'],
  [/\bdocument\./, 'document'], [/\bnavigator\.gpu\b/, 'WebGPU'], [/\bp0_[A-Za-z0-9_-]{16,}/, 'Project 0 key'],
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const problems = [];
const files = walk(src).filter(f => ALLOWED_EXT.has(path.extname(f)));
fs.rmSync(outDir, { recursive: true, force: true });
let jsBytes = 0;
const manifest = [];
for (const file of files) {
  const rel = path.relative(src, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.js')) {
    jsBytes += Buffer.byteLength(text);
    text.split('\n').forEach((line, i) => { if (line.length > 1000) problems.push(`${rel}:${i + 1} line over 1,000 characters`); });
    for (const [re, name] of FORBIDDEN) {
      const m = text.match(re);
      if (m) problems.push(`${rel}: uses ${name} (${m[0]})`);
    }
    for (const m of text.matchAll(/^\s*import\s[^'"]*?['"]([^'"]+)['"]/gm)) {
      const spec = m[1];
      if (!(spec.startsWith('./') || spec.startsWith('../') || spec === 'three' || spec.startsWith('three/addons/'))) problems.push(`${rel}: import '${spec}' is not allowed`);
      if (spec.startsWith('.') && !fs.existsSync(path.resolve(path.dirname(file), spec))) problems.push(`${rel}: import '${spec}' not found`);
    }
    for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1).){20000,})\1/gs)) problems.push(`${rel}: string literal over 20 KB (${m[2].length})`);
  }
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  manifest.push({ path: rel, bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
}
const experience = JSON.parse(fs.readFileSync(path.join(src, 'experience.json'), 'utf8'));
if (!fs.existsSync(path.join(src, experience.entry))) problems.push(`experience.json entry '${experience.entry}' missing`);
if (jsBytes > 4 * 1024 * 1024) problems.push(`JavaScript is ${jsBytes} bytes (limit 4 MB)`);
if (files.length > 1000) problems.push(`${files.length} files (limit 1,000)`);

fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zipPath, '.'], { cwd: outDir });
const zipSha = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
const summary = {
  name: experience.name, entry: experience.entry, files: files.length, jsBytes, zipBytes: fs.statSync(zipPath).size, zipSha256: zipSha,
  builtAt: new Date().toISOString(), problems, manifest,
};
fs.writeFileSync(path.join(root, 'dist', 'the-xplorator-experience.manifest.json'), JSON.stringify(summary, null, 2));
console.log(`${experience.name}: ${files.length} files, ${(jsBytes / 1024).toFixed(1)} KB JS, zip ${(summary.zipBytes / 1024).toFixed(1)} KB`);
console.log(`zip: ${path.relative(root, zipPath)}  sha256 ${zipSha}`);
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('local checks: OK');
