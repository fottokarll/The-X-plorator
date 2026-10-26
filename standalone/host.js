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
  saved: params.has('fresh') || params.has('guest') ? null : readSave(),
  async save(data) {
    // ?guest=1 answers like the city does for a guest (the request is a 401).
    if (params.has('guest')) {
      window.__guestSaves = (window.__guestSaves ?? 0) + 1;
      console.warn('[standalone] guest save refused (the city answers HTTP 401)');
      return { ok: false, reason: 'Sign in to keep your progress' };
    }
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
  sound: null, // WebAudio implementation below
  music: null,
  game: null,
  // Local QA switches from the address bar (not part of Project 0's p0):
  // ?perf=1 performance report, ?ship=m1 previous ship model, ?story=1 always show the prologue.
  qa: {
    perf: params.has('perf'), ship: params.get('ship'), story: params.has('story'),
    // Failure and delay switches for the prologue and boot tests.
    failboot: params.get('failboot'), artdelay: params.get('artdelay'), artfail: params.get('artfail'),
  },
};
// ---------------------------------------------------------------- audio
// Mirrors Project 0's sandbox shell (https://project0.city/sandbox/shell.js,
// read 2026-10-25): p0.sound decodes each file and plays it through a Web
// Audio buffer source (sample-accurate `loop`, a gain per sound, pause keeps
// the position); p0.music streams ONE track through an HTML audio element
// with `loop` (not sample-accurate). ?audiotap=1 records the mixed output for
// tools/audio-loop-check.mjs.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const master = audioCtx.createGain();
master.gain.value = 1;
master.connect(audioCtx.destination);
const buffers = new Map();
const playing = new Map();
const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
const load = path => {
  if (!buffers.has(path)) buffers.set(path, fetch(`/${path}`).then(r => r.arrayBuffer()).then(b => audioCtx.decodeAudioData(b)));
  return buffers.get(path);
};
const position = s => {
  if (!s.source) return s.offset;
  const at = s.offset + (audioCtx.currentTime - s.startedAt) * s.rate;
  return s.loop ? at % s.buffer.duration : Math.min(at, s.buffer.duration);
};
const halt = s => { if (!s.source) return; const src = s.source; s.source = null; try { src.stop(); } catch { /* done */ } };
function run(id, s) {
  const source = audioCtx.createBufferSource();
  source.buffer = s.buffer; source.loop = s.loop; source.playbackRate.value = s.rate;
  source.connect(s.gain);
  source.onended = () => { if (s.source === source) { s.source = null; playing.delete(id); } };
  s.source = source; s.startedAt = audioCtx.currentTime;
  source.start(0, Math.max(0, Math.min(s.offset, s.buffer.duration)));
}
let nextSound = 1;
p0.sound = {
  play(path, { volume = 1, loop = false, rate = 1, at = 0 } = {}) {
    const id = nextSound++;
    if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
    load(path).then(buffer => {
      if (playing.size >= 32) { const [oldId, oldest] = playing.entries().next().value; halt(oldest); playing.delete(oldId); }
      const gain = audioCtx.createGain();
      gain.gain.value = clamp01(volume);
      gain.connect(master);
      const s = { buffer, gain, loop: Boolean(loop), rate: Math.max(0.25, Math.min(4, rate)), offset: Math.max(0, at), startedAt: 0, source: null, path };
      playing.set(id, s);
      run(id, s);
    }).catch(e => console.warn('audio', path, e));
    return id;
  },
  stop(id) { const s = playing.get(id); if (s) halt(s); playing.delete(id); },
  pause(id) { const s = playing.get(id); if (s?.source) { s.offset = position(s); halt(s); } },
  resume(id) { const s = playing.get(id); if (s && !s.source) run(id, s); },
  stopAll() { for (const s of playing.values()) halt(s); playing.clear(); },
  pauseAll() { for (const s of playing.values()) if (s.source) { s.offset = position(s); halt(s); } },
  resumeAll() { for (const [id, s] of playing) if (!s.source) run(id, s); },
};
let track = null;
p0.music = {
  play(path, { volume = 1, loop = true, at } = {}) {
    if (!track || track.path !== path) {
      if (track) track.el.pause();
      const el = new Audio(`/${path}`);
      el.preload = 'auto';
      track = { el, path };
    }
    track.el.loop = loop !== false;
    track.el.volume = clamp01(volume);
    if (Number.isFinite(at)) track.el.currentTime = Math.max(0, at);
    void track.el.play().catch(() => { /* waits for a click or a key */ });
  },
  stop() { if (track) { track.el.pause(); track = null; } },
  volume(v) { if (track) track.el.volume = clamp01(v); },
  seek(at) { if (track && Number.isFinite(at)) track.el.currentTime = Math.max(0, at); },
  get time() { return track?.el.currentTime ?? 0; },
  get playing() { return Boolean(track && !track.el.paused); },
  get duration() { return track?.el.duration || 0; },
};
const unlockAudio = () => { if (audioCtx.state !== 'running') void audioCtx.resume().catch(() => {}); if (track?.el.paused) void track.el.play().catch(() => {}); };
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.__p0audio = { ctx: audioCtx, playing, get track() { return track; } };
if (params.has('audiotap')) {
  // Records the mixed Web Audio output (mono) for the loop-seam check, on the
  // audio thread (an AudioWorklet), so recording itself cannot drop blocks.
  const chunks = [];
  const code = `registerProcessor('xp-tap', class extends AudioWorkletProcessor {
    process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
  });`;
  const ready = audioCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))).then(() => {
    const tap = new AudioWorkletNode(audioCtx, 'xp-tap', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
    tap.port.onmessage = e => chunks.push(e.data);
    master.connect(tap);
  });
  window.__audioTap = {
    ready, rate: audioCtx.sampleRate,
    seconds: () => chunks.reduce((a, c) => a + c.length, 0) / audioCtx.sampleRate,
    take() { const n = chunks.reduce((a, c) => a + c.length, 0); const out = new Float32Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } chunks.length = 0; return out; },
  };
}

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
  // A simulated standard controller for local test scripts (window.__fakePad).
  if (window.__fakePad) {
    p0.input.gamepad = window.__fakePad;
    if (!p0.input.pad) { p0.input.pad = true; emit('pad', true); }
    return;
  }
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

// experience.json "loading": { "own": true }: like Project 0, run the frame
// loop from the moment the code arrives, while start() is still working, and
// show the game's own loading screen instead of the veil. ?noown=1 behaves
// like a host that does not apply it (the official dev kit loads only main.js).
(async () => {
  let own = false;
  try { own = !params.has('noown') && (await (await fetch('/experience.json')).json())?.loading?.own === true; } catch { /* default veil */ }
  const hideVeil = () => { veil.style.opacity = '0'; setTimeout(() => veil.remove(), 700); };
  if (own) { hideVeil(); requestAnimationFrame(frame); }
  window.__xpOwnLoading = own;
  try {
    window.__xpGame = await start(p0);
    if (!own) hideVeil();
    window.__xpReady = true;
  } catch (e) {
    showError(e);
  }
  if (!own) requestAnimationFrame(frame);
})();
