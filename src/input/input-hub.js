import { mapStandardGamepad } from './gamepad.js';
import { DEFAULT_BINDINGS, MENU_KEYS, anyDown, sanitizeBindings } from './keyboard.js';

/**
 * Merges keyboard, gamepad and touch into one semantic snapshot per frame:
 *   axes:  yaw, pitch (-1..1, + = right / up), boost, brake (0..1), lookX, lookY
 *   edges: Set of one-shot actions pressed this frame (scan, interact, map,
 *          pause, back, confirm, up, down, left, right, hangar, base, zoomIn, zoomOut)
 *   device: 'kbm' | 'pad' | 'touch' (last used, for button hints)
 * Keyboard steering behaves like a virtual wheel: full lock in ~0.1 s, faster return.
 */
export function createInputHub({ getKeys, getGamepad, isPadActive, touch }) {
  let bindings = sanitizeBindings(DEFAULT_BINDINGS);
  let device = 'kbm';
  const prevKeys = new Set();
  // Key presses latched from keydown events, so a tap shorter than one
  // (slow) frame is never lost between two polls.
  const latched = new Set();
  let prevPad = null;
  const kb = { yaw: 0, pitch: 0 };
  let navRepeat = { dir: null, t: 0 };
  let invertY = false;
  let sensitivity = 1;

  const ramp = (value, target, dt) => {
    const rate = target === 0 || Math.sign(target) !== Math.sign(value) ? 14 : 10;
    const step = rate * dt;
    return Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step;
  };

  function poll(dt, { menu = false } = {}) {
    const keys = getKeys();
    const edges = new Set();
    const pressed = codes => codes.some(c => (keys.has(c) && !prevKeys.has(c)) || latched.has(c));
    const padActive = isPadActive();
    const out = { yaw: 0, pitch: 0, boost: 0, brake: 0, lookX: 0, lookY: 0, edges, device };

    // Keyboard (ignored while a controller is in use: in Project 0 the pad
    // also presses W/A/S/D/Space/E, which would double the input).
    if (!padActive) {
      const ty = (anyDown(keys, bindings.yawRight) ? 1 : 0) - (anyDown(keys, bindings.yawLeft) ? 1 : 0);
      const tp = (anyDown(keys, bindings.pitchUp) ? 1 : 0) - (anyDown(keys, bindings.pitchDown) ? 1 : 0);
      kb.yaw = ramp(kb.yaw, ty, dt);
      kb.pitch = ramp(kb.pitch, tp, dt);
      out.yaw = kb.yaw;
      out.pitch = kb.pitch;
      out.boost = anyDown(keys, bindings.boost) ? 1 : 0;
      out.brake = anyDown(keys, bindings.brake) ? 1 : 0;
      if (menu) {
        for (const [action, codes] of Object.entries(MENU_KEYS)) if (pressed(codes)) edges.add(action);
      } else {
        for (const action of ['scan', 'interact', 'map', 'hangar', 'base', 'pause', 'zoomIn', 'zoomOut']) {
          if (pressed(bindings[action])) edges.add(action);
        }
      }
      if ((keys.size && [...keys].some(c => !prevKeys.has(c))) || latched.size) device = 'kbm';
    }
    latched.clear();
    prevKeys.clear();
    for (const k of keys) prevKeys.add(k);

    // Gamepad (standard mapping) through the existing pure mapper.
    const gp = getGamepad();
    if (gp) {
      const pad = mapStandardGamepad({ connected: true, mapping: 'standard', axes: gp.axes || [], buttons: gp.buttons || [] });
      const was = prevPad || {};
      const edge = name => pad[name] && !was[name];
      const activity = Math.abs(pad.yaw) + Math.abs(pad.pitch) + pad.thrust + pad.brake + Math.abs(pad.cameraYaw) + Math.abs(pad.cameraPitch);
      if (activity > 0.2 || pad.interact || pad.scan || pad.pause || pad.galaxyMap || pad.back || pad.up || pad.down) device = 'pad';
      if (padActive || device === 'pad') {
        out.yaw = Math.abs(pad.yaw) > Math.abs(out.yaw) ? pad.yaw : out.yaw;
        out.pitch = Math.abs(pad.pitch) > Math.abs(out.pitch) ? pad.pitch : out.pitch;
        out.boost = Math.max(out.boost, pad.thrust, pad.boost ? 1 : 0);
        out.brake = Math.max(out.brake, pad.brake);
        out.lookX = pad.cameraYaw;
        out.lookY = pad.cameraPitch;
      }
      if (menu) {
        if (edge('interact')) edges.add('confirm');
        if (edge('back')) edges.add('back');
        if (edge('pause')) edges.add('back');
        // D-pad and left stick with key-repeat style navigation.
        let dir = pad.up ? 'up' : pad.down ? 'down' : pad.left ? 'left' : pad.right ? 'right' : null;
        if (!dir && Math.hypot(pad.yaw, pad.pitch) > 0.6) dir = Math.abs(pad.yaw) > Math.abs(pad.pitch) ? (pad.yaw > 0 ? 'right' : 'left') : (pad.pitch > 0 ? 'up' : 'down');
        if (dir && dir !== navRepeat.dir) { edges.add(dir); navRepeat = { dir, t: 0.38 }; }
        else if (dir) { navRepeat.t -= dt; if (navRepeat.t <= 0) { edges.add(dir); navRepeat.t = 0.14; } }
        else navRepeat = { dir: null, t: 0 };
      } else {
        if (edge('interact')) edges.add('interact');
        if (edge('scan')) edges.add('scan');
        if (edge('galaxyMap')) edges.add('map');
        if (edge('pause')) edges.add('pause');
        if (edge('back')) edges.add('back');
        if (edge('up')) edges.add('zoomIn');
        if (edge('down')) edges.add('zoomOut');
        if (edge('left')) edges.add('hangar');
        if (edge('right')) edges.add('base');
      }
      prevPad = pad;
    } else prevPad = null;

    // Touch controls (virtual stick + buttons drawn by the HUD).
    const t = touch?.snapshot();
    if (t && t.connected) {
      if (t.fromTouch !== false) device = 'touch';
      if (Math.abs(t.yaw) > Math.abs(out.yaw)) out.yaw = t.yaw;
      if (Math.abs(t.pitch) > Math.abs(out.pitch)) out.pitch = t.pitch;
      out.boost = Math.max(out.boost, t.boost ? 1 : 0);
      out.brake = Math.max(out.brake, t.brake ? 1 : 0);
      if (Math.abs(t.cameraYaw) + Math.abs(t.cameraPitch) > 0) { out.lookX = t.cameraYaw; out.lookY = t.cameraPitch; }
    }
    for (const e of touch?.takeEdges?.() ?? []) edges.add(e);

    out.pitch *= invertY ? -1 : 1;
    out.yaw = Math.max(-1, Math.min(1, out.yaw * sensitivity));
    out.pitch = Math.max(-1, Math.min(1, out.pitch * sensitivity));
    out.device = device;
    return out;
  }

  return {
    poll,
    get device() { return device; },
    set device(d) { device = d; },
    get bindings() { return bindings; },
    setBindings(b) { bindings = sanitizeBindings(b); },
    setOptions({ invert, sens }) { invertY = Boolean(invert); sensitivity = Math.max(0.4, Math.min(1.8, sens ?? 1)); },
    releaseAll() { kb.yaw = 0; kb.pitch = 0; prevKeys.clear(); latched.clear(); },
    latchKey(code) { if (typeof code === 'string' && code.length < 32) latched.add(code); },
  };
}
