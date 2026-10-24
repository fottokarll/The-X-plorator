import { STARTER_BASE } from './base.js';
import { MODULES, parseModuleId } from './ships.js';
import { sanitizeBindings, DEFAULT_BINDINGS } from '../input/keyboard.js';

/**
 * The player's save, kept by Project 0 per player (p0.saved / p0.save, plain
 * JSON up to 16 KB) or by the standalone host in the browser. Everything is
 * validated on load: a save comes from the player's browser and is never
 * trusted for anything of value (no ATT, no prizes depend on it).
 */
export const SAVE_VERSION = 1;
const SOCKETS = Object.keys(MODULES);

export function defaultSettings() {
  return {
    quality: 'auto', // auto | high | medium | low
    handling: 'tranquil', // tranquil | responsive
    invertY: false,
    sensitivity: 1,
    autoCruise: true,
    reducedMotion: false,
    cameraZoom: 1,
    hints: true,
    bindings: sanitizeBindings(DEFAULT_BINDINGS),
  };
}

export function newProfile(vessel = 'survivor') {
  return {
    v: SAVE_VERSION,
    started: true,
    vessel,
    equipped: Object.fromEntries(SOCKETS.map(s => [s, 1])),
    // Owned modules beyond the starters: a Wide Array salvaged from Earth's
    // last relay demonstrates equipping on day one.
    inventory: ['scanner-2'],
    cargo: { cryon: 0, ferrite: 0 },
    bank: { cryon: 0, ferrite: 0 },
    mission: { id: 'first-light', step: 'locate', delivered: 0, scanned: [], collected: [] },
    nodes: {}, // nodeId -> { amount 0..1, regrowAt (play seconds) }
    base: STARTER_BASE.map(t => ({ ...t })),
    powered: false,
    stats: { playSeconds: 0, crystals: 0, ore: 0, docks: 0 },
    discovered: ['outer-verge'],
    settings: defaultSettings(),
  };
}

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return null;
  const p = newProfile(typeof raw.vessel === 'string' ? raw.vessel : 'survivor');
  // Only the free vessel is selectable in M1.
  p.vessel = 'survivor';
  for (const s of SOCKETS) {
    const lvl = Math.round(num(raw.equipped?.[s], 1, MODULES[s].length, 1));
    p.equipped[s] = lvl;
  }
  p.inventory = Array.isArray(raw.inventory) ? [...new Set(raw.inventory.filter(id => parseModuleId(id)))].slice(0, 40) : p.inventory;
  for (const k of ['cryon', 'ferrite']) {
    p.cargo[k] = Math.round(num(raw.cargo?.[k], 0, 999, 0));
    p.bank[k] = Math.round(num(raw.bank?.[k], 0, 9999, 0));
  }
  const m = raw.mission ?? {};
  const steps = ['locate', 'scan', 'collect', 'return', 'dock', 'complete', 'free'];
  p.mission = {
    id: 'first-light',
    step: steps.includes(m.step) ? m.step : 'locate',
    delivered: Math.round(num(m.delivered, 0, 999, 0)),
    scanned: Array.isArray(m.scanned) ? m.scanned.filter(x => typeof x === 'string').slice(0, 32) : [],
    collected: Array.isArray(m.collected) ? m.collected.filter(x => typeof x === 'string').slice(0, 32) : [],
  };
  if (raw.nodes && typeof raw.nodes === 'object') {
    for (const [id, n] of Object.entries(raw.nodes).slice(0, 32)) {
      if (typeof id !== 'string' || id.length > 24) continue;
      p.nodes[id] = { amount: num(n?.amount, 0, 1, 1), regrowAt: num(n?.regrowAt, 0, 1e9, 0) };
    }
  }
  if (Array.isArray(raw.base)) {
    const types = new Set(['hub', 'dock', 'solar', 'storage', 'refinery', 'scanner']);
    const tiles = raw.base.filter(t => t && Number.isInteger(t.q) && Number.isInteger(t.r) && types.has(t.type)
      && Math.abs(t.q) <= 3 && Math.abs(t.r) <= 3).slice(0, 37);
    if (tiles.some(t => t.type === 'hub' && t.q === 0 && t.r === 0)) p.base = tiles.map(t => ({ q: t.q, r: t.r, type: t.type }));
  }
  p.powered = Boolean(raw.powered);
  p.stats.playSeconds = num(raw.stats?.playSeconds, 0, 1e9, 0);
  p.stats.crystals = Math.round(num(raw.stats?.crystals, 0, 1e6, 0));
  p.stats.ore = Math.round(num(raw.stats?.ore, 0, 1e6, 0));
  p.stats.docks = Math.round(num(raw.stats?.docks, 0, 1e6, 0));
  const s = raw.settings ?? {};
  p.settings.quality = ['auto', 'high', 'medium', 'low'].includes(s.quality) ? s.quality : 'auto';
  p.settings.handling = ['tranquil', 'responsive'].includes(s.handling) ? s.handling : 'tranquil';
  p.settings.invertY = Boolean(s.invertY);
  p.settings.sensitivity = num(s.sensitivity, 0.5, 1.6, 1);
  p.settings.autoCruise = s.autoCruise !== false;
  p.settings.reducedMotion = Boolean(s.reducedMotion);
  p.settings.cameraZoom = num(s.cameraZoom, 0.8, 1.25, 1);
  p.settings.hints = s.hints !== false;
  p.settings.bindings = sanitizeBindings(s.bindings);
  return p;
}

export function serializeProfile(p) {
  const json = JSON.stringify(p);
  // Project 0 keeps up to 16 KB per player.
  if (json.length > 16000) throw new Error('save too large');
  return JSON.parse(json);
}
