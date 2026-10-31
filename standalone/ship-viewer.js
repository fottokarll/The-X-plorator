import * as THREE from 'three';
import { buildShip } from '/render/ship-builder.js';
import { createSky } from '/render/sky.js';
import { createPipeline } from '/render/pipeline.js';
import { SECTOR, PALETTE } from '/game/config.js';

/**
 * Local QA turntable for the ship models (not part of the Project 0 package).
 * Renders with the game's own sky, environment, lights, materials and post
 * pipeline (HDR, bloom, ACES). Drag to turn, wheel or pinch to zoom.
 *   ?model=mk2|m1|both  ?view=front|rear|left|right|top|bottom|34front|34rear|flight
 *   ?bg=sky|dark|grey   ?loadout=1..3 (all sockets)   ?quality=high|medium|low   ?clean=1 (no UI)
 */
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(16, innerWidth / innerHeight, 0.05, 2000);
if (params.has('clean')) document.body.classList.add('clean');

const qualityName = params.get('quality') ?? 'high';
const planetDir = new THREE.Vector3(...SECTOR.planet.center).normalize();
const sky = createSky(renderer, { size: qualityName === 'low' ? 192 : 512, octaves: 4, sunDirection: SECTOR.sunDirection, planetDirection: planetDir.toArray() });
const bg = params.get('bg') ?? 'sky';
scene.background = bg === 'sky' ? sky.texture : new THREE.Color(bg === 'grey' ? 0x8a8e95 : 0x0a1530);
scene.environment = qualityName === 'low' ? null : sky.environment();
scene.environmentIntensity = 0.85;
// The world's lights (render/world.js): sun, lilac fill, sky/ground hemisphere.
const sun = new THREE.DirectionalLight(0xdff4ff, 1.8);
sun.position.copy(new THREE.Vector3(...SECTOR.sunDirection).normalize().multiplyScalar(100));
const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.lilac), 0.55);
fill.position.set(0.4, -0.2, -1).multiplyScalar(100);
const hemi = new THREE.HemisphereLight(new THREE.Color('#5b8de0'), new THREE.Color('#2a1f5a'), 0.75);
scene.add(sun, fill, hemi);

const pipeline = createPipeline({ renderer, scene, camera, overlay: null });
pipeline.setQuality(qualityName);
pipeline.resize(innerWidth, innerHeight, renderer.getPixelRatio());

const lv = Math.max(1, Math.min(3, Number(params.get('loadout')) || 1));
const loadout = { engine: lv, hull: lv, reactor: lv, scanner: lv, cargo: lv, shield: lv, miner: lv };
const modelParam = params.get('model') ?? 'mk2';
const ships = [];
function rebuild(model) {
  for (const s of ships) { scene.remove(s.pivot); s.ship.dispose(); }
  ships.length = 0;
  const models = model === 'both' ? ['m1', 'mk2'] : [model];
  models.forEach((m, i) => {
    const ship = buildShip({ vessel: 'survivor', loadout, model: m });
    const pivot = new THREE.Group();
    pivot.add(ship.group);
    pivot.position.x = models.length > 1 ? (i - 0.5) * 3.2 : 0;
    scene.add(pivot);
    ships.push({ ship, pivot, model: m });
  });
  info();
}

const VIEWS = {
  front: { dir: [0, 0, 1], up: [0, 1, 0] },
  rear: { dir: [0, 0, -1], up: [0, 1, 0] },
  left: { dir: [1, 0, 0], up: [0, 1, 0] },
  right: { dir: [-1, 0, 0], up: [0, 1, 0] },
  top: { dir: [0, 1, 0], up: [-1, 0, 0] },
  bottom: { dir: [0, -1, 0], up: [1, 0, 0] },
  '34front': { dir: [-0.62, 0.48, 0.62], up: [0, 1, 0] },
  '34rear': { dir: [0.7, 0.55, -0.62], up: [0, 1, 0] },
  // The distant flight camera's angle (behind and above the travel line).
  flight: { dir: [0, 0.2, -1], up: [0, 1, 0], far: 3.4 },
};
let view = params.get('view') ?? '34front';
let yaw = 0, pitch = 0, dist = 1, auto = !params.has('view');
function placeCamera() {
  const v = VIEWS[view] ?? VIEWS['34front'];
  const d = new THREE.Vector3(...v.dir).normalize();
  d.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() > 1e-4) d.applyAxisAngle(side.normalize(), pitch);
  const radius = Math.max(...ships.map(s => s.ship.radius)) * (ships.length > 1 ? 2.2 : 1);
  const fov = camera.fov * Math.PI / 180;
  const fitH = radius / Math.tan(fov / 2), fitW = fitH / Math.min(1, camera.aspect);
  const range = Math.max(fitH, fitW) * 1.08 * dist * (v.far ?? 1);
  camera.position.copy(d.multiplyScalar(range));
  camera.up.set(...v.up);
  camera.lookAt(0, 0, 0);
}
function info() {
  const s = ships.map(x => `${x.model.toUpperCase()}: ${(x.ship.triangles ?? 0).toFixed(0)} tris · radius ${x.ship.radius.toFixed(2)} m · gameplay ${x.ship.hitRadius.toFixed(2)} m · 3 draw calls`).join('<br>');
  document.getElementById('info').innerHTML = `Ship Viewer · view ${view} · loadout Lv ${lv} · ${qualityName} · bg ${bg}<br>${s}`;
}
const bar = document.getElementById('bar');
for (const name of Object.keys(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = name.toUpperCase();
  b.onclick = () => { view = name; yaw = 0; pitch = 0; auto = false; info(); };
  bar.append(b);
}
for (const m of ['mk2', 'm1', 'both']) {
  const b = document.createElement('button');
  b.textContent = `MODEL ${m.toUpperCase()}`;
  b.onclick = () => rebuild(m);
  bar.append(b);
}
const spin = document.createElement('button');
spin.textContent = 'TURNTABLE';
spin.onclick = () => { auto = !auto; };
bar.append(spin);

// Drag to turn (mouse or one finger), wheel to zoom.
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; auto = false; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * 0.01; pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - drag.y) * 0.01));
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(0.4, Math.min(3, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pipeline.resize(innerWidth, innerHeight, renderer.getPixelRatio());
});

rebuild(modelParam);
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
let last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (auto) yaw += dt * 0.5;
  placeCamera();
  pipeline.render();
  if (++frames === 4) window.__shipViewerReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__viewer = { ships, set view(v) { view = v; }, rebuild };
