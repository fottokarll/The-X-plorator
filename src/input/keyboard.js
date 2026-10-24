/**
 * Configurable keyboard bindings (KeyboardEvent.code values).
 * Avoids Enter (Project 0 chat) and Escape (leaves the game in Project 0),
 * and Ctrl combinations (Ctrl+W closes the browser tab).
 */
export const ACTIONS = Object.freeze([
  { id: 'pitchUp', label: 'Climb', group: 'flight' },
  { id: 'pitchDown', label: 'Dive', group: 'flight' },
  { id: 'yawLeft', label: 'Turn left', group: 'flight' },
  { id: 'yawRight', label: 'Turn right', group: 'flight' },
  { id: 'boost', label: 'Boost', group: 'flight' },
  { id: 'brake', label: 'Brake / stop', group: 'flight' },
  { id: 'scan', label: 'Scan', group: 'action' },
  { id: 'interact', label: 'Collect / dock', group: 'action' },
  { id: 'map', label: 'Galaxy map', group: 'screen' },
  { id: 'hangar', label: 'Hangar', group: 'screen' },
  { id: 'base', label: 'Orbital base', group: 'screen' },
  { id: 'pause', label: 'Pause', group: 'screen' },
  { id: 'zoomIn', label: 'Zoom in', group: 'camera' },
  { id: 'zoomOut', label: 'Zoom out', group: 'camera' },
]);

export const DEFAULT_BINDINGS = Object.freeze({
  pitchUp: ['KeyW', 'ArrowUp'],
  pitchDown: ['KeyS', 'ArrowDown'],
  yawLeft: ['KeyA', 'ArrowLeft'],
  yawRight: ['KeyD', 'ArrowRight'],
  boost: ['ShiftLeft', 'ShiftRight', 'Space'],
  brake: ['KeyC', 'KeyX'],
  scan: ['KeyQ', 'KeyF'],
  interact: ['KeyE'],
  map: ['KeyM'],
  hangar: ['KeyH'],
  base: ['KeyB'],
  pause: ['KeyP', 'Escape'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
});

// Menu navigation is fixed so a bad rebinding can never lock a player out.
export const MENU_KEYS = Object.freeze({
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['Space', 'KeyE', 'Enter', 'NumpadEnter'],
  back: ['Backspace', 'Escape', 'KeyQ'],
});

const RESERVED = new Set(['Enter', 'NumpadEnter', 'Escape', 'Tab', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight']);

export function sanitizeBindings(input) {
  const out = {};
  for (const [action, defaults] of Object.entries(DEFAULT_BINDINGS)) {
    const list = Array.isArray(input?.[action]) ? input[action].filter(c => typeof c === 'string' && c.length < 24) : null;
    out[action] = list && list.length ? list.slice(0, 3) : [...defaults];
  }
  return out;
}

/** Rebinds an action's primary key; a code used elsewhere is removed there. */
export function rebind(bindings, action, code) {
  if (!DEFAULT_BINDINGS[action]) return { ok: false, reason: 'Unknown action' };
  if (RESERVED.has(code) && action !== 'pause') return { ok: false, reason: 'That key is reserved by the browser or Project 0' };
  const next = sanitizeBindings(bindings);
  for (const [a, list] of Object.entries(next)) {
    if (a !== action) next[a] = list.filter(c => c !== code);
    if (!next[a].length) next[a] = [...DEFAULT_BINDINGS[a]].filter(c => c !== code).slice(0, 1);
  }
  next[action] = [code, ...next[action].filter(c => c !== code)].slice(0, 3);
  return { ok: true, bindings: next };
}

export function prettyKey(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift',
    Equal: '+', Minus: '−', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', Backspace: 'Bksp', Escape: 'Esc',
  };
  return names[code] ?? code;
}

export function anyDown(keys, codes) {
  for (const c of codes) if (keys.has(c)) return true;
  return false;
}
