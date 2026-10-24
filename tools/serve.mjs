#!/usr/bin/env node
/**
 * Local server for THE X-PLORATOR.
 *   /                 -> redirects to the standalone game
 *   /standalone/*     -> standalone host (index.html, host.js)
 *   /vendor/three/*   -> node_modules/three (for the standalone import map)
 *   everything else   -> src/ (the Project 0 package root: /main.js, /experience.json)
 * CORS + Private-Network headers let the official Project 0 dev kit load
 * http://localhost:5500/main.js. Only these three folders are served.
 * Usage: node tools/serve.mjs [--port 5500] [--host 127.0.0.1]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const port = Number(opt('port', process.env.PORT || 5500));
const host = opt('host', '127.0.0.1');

const MOUNTS = [
  ['/standalone/', path.join(root, 'standalone')],
  ['/vendor/three/', path.join(root, 'node_modules', 'three')],
  ['/', path.join(root, 'src')],
];
const TYPES = {
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
};

function resolve(urlPath) {
  for (const [prefix, dir] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    const rel = decodeURIComponent(urlPath.slice(prefix.length)) || 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir + path.sep) && file !== dir) return null; // no traversal outside the mount
    return file;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(302, { ...headers, Location: `/standalone/${url.search}` });
    res.end();
    return;
  }
  let file = resolve(url.pathname);
  if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file || !fs.existsSync(file)) { res.writeHead(404, headers); res.end('Not found'); return; }
  res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(port, host, () => {
  console.log(`THE X-PLORATOR local server`);
  console.log(`  Standalone game:  http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  console.log(`  P0 dev kit entry: http://localhost:${port}/main.js`);
  console.log(`  Dev kit:          https://project0.city/devkit?entry=http://localhost:${port}/main.js&width=16&depth=16&height=30`);
});
