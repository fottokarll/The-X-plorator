// Render the lot #323 LODs from dist/lot/ in Chromium (three r186) and save PNGs to docs/media/lot323/.
// Run after build-lot.mjs: node lot/preview-lot.mjs   (P0_HEADLESS=1 forces headless SwiftShader)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'media', 'lot323');
const PORT = 5611;
fs.mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const q = new URLSearchParams(location.search);
const lod = q.get('lod'), view = q.get('view'), dusk = q.get('dusk') === '1';
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dusk ? 0.9 : 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = dusk ? 0.25 : 0.7;
// Sky gradient (the city is white paper; dusk view darker so the neon reads).
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color(dusk ? 0x1d2346 : 0xc3cad9) }, bottom: { value: new THREE.Color(dusk ? 0x6a6c8c : 0xf4f5f8) } },
  vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top, bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }' }));
scene.add(sky);
const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: dusk ? 0x8a8ca4 : 0xf2f3f6, roughness: 0.95 }));
ground.position.y = -0.01; scene.add(ground);
// Ink outline of the 16 × 16 × 30 m lot box, as the city draws it.
const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(16, 30, 16)), new THREE.LineBasicMaterial({ color: dusk ? 0x29d3ff : 0x222222, transparent: true, opacity: 0.35 }));
box.position.y = 15; scene.add(box);
scene.add(new THREE.HemisphereLight(dusk ? 0x5a6aa8 : 0xe8eefc, dusk ? 0x302c40 : 0xb9b4a8, dusk ? 0.6 : 1.4));
const sun = new THREE.DirectionalLight(dusk ? 0xffc9a0 : 0xffffff, dusk ? 0.8 : 2.2); sun.position.set(30, 50, 40); scene.add(sun);
const gltf = await new GLTFLoader().loadAsync('/lot/' + lod + '.glb');
scene.add(gltf.scene);
// Approximate the city's lot.json contract (p0Surface on standard materials) so the GLSL is
// compiled for real and the preview shows the shaded look. LOD2 has no shaders, as in the city.
const shaderErrors = [];
const time = Number(q.get('t') || 7.3);
if (lod !== 'lod2' && q.get('plain') !== '1') {
  const lotJson = await (await fetch('/lot/lot.json')).json();
  const sources = {};
  for (const m of Object.values(lotJson.materials)) if (m.surface) sources[m.surface] = await (await fetch('/lot/' + m.surface)).text();
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const def = lotJson.materials[o.material.name];
    if (!def || !def.surface) return;
    const mat = o.material.clone();
    const uniformsDecl = Object.keys(def.uniforms || {}).map(u => 'uniform float ' + u + ';').join('\\n');
    mat.onBeforeCompile = sh => {
      sh.uniforms.p0Time = { value: time }; sh.uniforms.p0Near = { value: 1 };
      for (const [u, v] of Object.entries(def.uniforms || {})) sh.uniforms[u] = { value: v };
      sh.vertexShader = 'varying vec3 vP0Pos;\\nvarying vec3 vP0N;\\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\\n vP0Pos = (modelMatrix * vec4(transformed, 1.0)).xyz;\\n vP0N = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform float p0Time;\\nuniform float p0Near;\\n' + uniformsDecl + '\\nvarying vec3 vP0Pos;\\nvarying vec3 vP0N;\\n' +
        'struct P0Surface { vec3 color; float alpha; vec3 emissive; float roughness; float metalness; vec3 normal; vec2 uv; vec3 position; vec3 world; vec3 view; };\\n' +
        sources[def.surface] + '\\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\\n P0Surface s; s.color = diffuseColor.rgb; s.alpha = diffuseColor.a; s.emissive = totalEmissiveRadiance;' +
        ' s.roughness = roughnessFactor; s.metalness = metalnessFactor; s.normal = normalize(vP0N); s.uv = vec2(0.0); s.position = vP0Pos; s.world = vP0Pos;' +
        ' s.view = normalize(cameraPosition - vP0Pos); p0Surface(s); diffuseColor.rgb = s.color; totalEmissiveRadiance = s.emissive;');
    };
    o.material = mat;
  });
  renderer.debug.onShaderError = (gl, program, vs, fs) => shaderErrors.push(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(program));
}
const views = {
  front: [[0, 9, 46], [0, 12.5, 0]], back: [[0, 9, -46], [0, 12.5, 0]], side: [[46, 9, 0], [0, 12.5, 0]],
  threeq: [[30, 14, 33], [0, 12, 0]], top: [[0.01, 58, 0.01], [0, 0, 0]], street: [[9, 1.7, 26], [0, 10, 0]],
  far: [[150, 60, 170], [0, 12, 0]],
};
const [p, t] = views[view];
const camera = new THREE.PerspectiveCamera(view === 'far' ? 14 : 42, W / H, 0.1, 2000);
camera.position.set(...p); if (view === 'top') camera.up.set(0, 0, -1); camera.lookAt(...t);
if (dusk) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.55, 0.62));
  composer.addPass(new OutputPass());
  composer.render();
} else renderer.render(scene, camera);
const info = renderer.info.render;
window.result = { calls: info.calls, triangles: info.triangles, shaderErrors };
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file;
  if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  if (url.pathname.startsWith('/three/')) file = path.join(ROOT, 'node_modules', 'three', url.pathname.slice(7));
  else if (url.pathname.startsWith('/lot/')) file = path.join(ROOT, 'dist', 'lot', url.pathname.slice(5));
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const headless = process.env.P0_HEADLESS === '1';
const browser = await chromium.launch({ headless, args: headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('page error:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
const shots = (process.argv[2] ? process.argv.slice(2) : [
  'lod0:front', 'lod0:threeq', 'lod0:side', 'lod0:back', 'lod0:top', 'lod0:street', 'lod0:threeq:dusk', 'lod0:street:dusk',
  'lod1:threeq', 'lod2:threeq', 'lod1:far', 'lod2:far',
]);
for (const s of shots) {
  const [lod, view, dusk] = s.split(':');
  await page.goto(`http://127.0.0.1:${PORT}/?lod=${lod}&view=${view}&dusk=${dusk ? 1 : 0}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const r = await page.evaluate(() => window.result);
  const file = path.join(OUT, `${lod}-${view}${dusk ? '-dusk' : ''}.png`);
  await page.screenshot({ path: file });
  console.log(file, JSON.stringify(r));
}
await browser.close();
server.close();
