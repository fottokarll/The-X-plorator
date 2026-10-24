import * as THREE from 'three';
import start from '/main.js';

/**
 * Standalone browser host for THE X-PLORATOR (not part of the Project 0
 * package). It implements only the documented subset of the p0 object the
 * game uses (skill.md, "The p0 object"), so the game module is identical in
 * Project 0, in the official dev kit and here:
 *   scene, camera, renderer, createRenderer, autoRender, loop, controls, me,
 *   players, bodies, input {keys, isDown, pointer, pad, gamepad}, on(),
 *   hud, loading, saved/save (localStorage here), lot, width/height/pixelRatio,
 *   time, random, asset, log, exit, room (single-player stand-in).
 * Pointer events carry {x, y, dx, dy, button, buttons, touch} and no pointer
 * id, like Project 0's, so the game's multi-touch tracking is exercised too.
 */
const canvas = document.getElementById('game');
const veil = document.getElementById('veil');
const errorBox = document.getElementById('error');
const SAVE_KEY = 'xplorator.save.v1';
const params = new URLSearchParams(location.search);

const listeners = new Map();
const emit = (name, ...args) => { for (const fn of listeners.get(name) ?? []) { try { fn(...args); } catch (e) { showError(e); } } };
const loops = [];
let renderer = null;
let rendererOptions = { antialias: false, alpha: false, powerPreference: 'high-performance' };

function showError(e) {
  console.error(e);
  errorBox.style.display = 'block';
  errorBox.textContent += `${e?.stack || e}\n`;
}
window.addEventListener('error', e => showError(e.error || e.message));
window.addEventListener('unhandledrejection', e => showError(e.reason));

function makeRenderer() {
  const r = new THREE.WebGLRenderer({ canvas, ...rendererOptions });
  r.setPixelRatio(pixelRatio());
  r.setSize(window.innerWidth, window.innerHeight, false);
  return r;
}
function pixelRatio() {
  const forced = Number(params.get('dpr'));
  return forced > 0 ? forced : Math.min(window.devicePixelRatio || 1, 2);
}

let seed = 323;
const keys = new Set();
const pointer = { x: 0, y: 0, buttons: 0, locked: false };
const start0 = performance.now();

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

const p0 = {
  lot: { id: 323, width: 16, depth: 16, height: 30, size: 16, name: 'The X-plorator (standalone)' },
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 90000),
  get renderer() { return (renderer ??= makeRenderer()); },
  createRenderer(options = {}) {
    rendererOptions = { ...rendererOptions, ...options, alpha: false };
    renderer?.dispose();
    renderer = makeRenderer();
    return renderer;
  },
  autoRender: true,
  loop(fn) { loops.push(fn); },
  controls: { mode: 'fly', speed: 1, distance: 10, yaw: 0, pitch: 0, enabled: true, vertical: true },
  me: { id: 'local', name: 'Explorer', color: '#70e2f4', avatar: null, position: new THREE.Vector3(0, 15, 0), yaw: 0 },
  players: new Map(),
  bodies: { visible: true, get: () => null },
  input: {
    keys,
    isDown: code => keys.has(code),
    pointer,
    lockPointer() {},
    unlockPointer() {},
    pad: false,
    gamepad: null,
  },
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  },
  room: {
    send() {}, sendTo() {}, set(k, v) { this.state[k] = v; }, state: {}, input() {},
    host: 'local', isHost: true, seed: 323, players: ['local'],
  },
  hud(text) { console.info('[hud]', text); },
  loading(fraction, label) {
    veil.querySelector('.bar i').style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    if (label) document.getElementById('veil-label').textContent = label;
  },
  saved: params.has('fresh') ? null : readSave(),
  async save(data) {
    try {
      if (data === null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      p0.saved = data;
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e?.message || 'storage unavailable' };
    }
  },
  asset: path => new URL(`/${path}`, location.origin).href,
  random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; },
  log: (...args) => console.log('[p0]', ...args),
  exit() { location.reload(); },
  get width() { return window.innerWidth; },
  get height() { return window.innerHeight; },
  get pixelRatio() { return pixelRatio(); },
  get time() { return (performance.now() - start0) / 1000; },
  sound: { play: () => 0, stop() {}, pause() {}, resume() {}, stopAll() {}, pauseAll() {}, resumeAll() {} },
  music: { play() {}, stop() {}, volume() {}, seek() {}, time: 0, playing: false, duration: 0 },
  game: null,
};
// Project 0's scene comes with a hemisphere light.
p0.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
window.__p0 = p0; // for local test scripts only

// ---------------------------------------------------------------- input
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);
window.addEventListener('keydown', e => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
  emit('keydown', { code: e.code, key: e.key, repeat: e.repeat });
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  emit('keyup', { code: e.code, key: e.key });
});
window.addEventListener('blur', () => { keys.clear(); });

const lastPos = new Map(); // pointerId -> {x, y}
function pointerEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const prev = lastPos.get(e.pointerId) ?? { x, y };
  lastPos.set(e.pointerId, { x, y });
  pointer.x = x; pointer.y = y; pointer.buttons = e.buttons;
  return { x, y, dx: x - prev.x, dy: y - prev.y, button: e.button, buttons: e.buttons, touch: e.pointerType === 'touch' };
}
canvas.addEventListener('pointerdown', e => {
  canvas.focus();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  lastPos.delete(e.pointerId);
  emit('pointerdown', pointerEvent(e));
});
canvas.addEventListener('pointermove', e => {
  const events = e.getCoalescedEvents?.() ?? [e];
  for (const ce of events.length ? events : [e]) emit('pointermove', pointerEvent(ce));
});
const up = e => { emit('pointerup', pointerEvent(e)); lastPos.delete(e.pointerId); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); emit('wheel', { deltaY: e.deltaY, deltaX: e.deltaX }); }, { passive: false });

window.addEventListener('resize', () => {
  if (!renderer) return;
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  emit('resize', { width: window.innerWidth, height: window.innerHeight });
});

function pollGamepad() {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = [...pads].find(p => p && p.connected && p.mapping === 'standard');
  if (!pad) {
    if (p0.input.gamepad) { p0.input.gamepad = null; if (p0.input.pad) { p0.input.pad = false; emit('pad', false); } }
    return;
  }
  const dz = v => (Math.abs(v) < 0.12 ? 0 : v);
  p0.input.gamepad = { axes: pad.axes.map(dz), buttons: pad.buttons.map(b => b.value) };
  const active = pad.axes.some(a => Math.abs(a) > 0.3) || pad.buttons.some(b => b.pressed);
  if (active && !p0.input.pad) { p0.input.pad = true; emit('pad', true); }
}
window.addEventListener('keydown', () => { if (p0.input.pad) { p0.input.pad = false; emit('pad', false); } });

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  pollGamepad();
  for (const fn of loops) { try { fn(dt, p0.time); } catch (e) { showError(e); } }
  emit('frame', dt);
  if (p0.autoRender && renderer) renderer.render(p0.scene, p0.camera);
  requestAnimationFrame(frame);
}

(async () => {
  try {
    window.__xpGame = await start(p0);
    veil.style.opacity = '0';
    setTimeout(() => veil.remove(), 700);
    window.__xpReady = true;
  } catch (e) {
    showError(e);
  }
  requestAnimationFrame(frame);
})();
