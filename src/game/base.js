/**
 * Orbital base rules: pointy-top axial hex grid (q, r), placement validity
 * and module costs in in-game resources (never ATT). Pure logic.
 */
export const HEX_SIZE = 9;

export const BASE_MODULES = Object.freeze([
  { type: 'solar', label: 'Solar Array', short: 'Solar', cost: { ferrite: 4 }, note: 'Powers the outpost' },
  { type: 'storage', label: 'Storage', short: 'Storage', cost: { ferrite: 6 }, note: 'Expands station storage' },
  { type: 'refinery', label: 'Refinery', short: 'Refinery', cost: { ferrite: 6, cryon: 3 }, note: 'Refining arrives in M2' },
  { type: 'scanner', label: 'Scanner Array', short: 'Scanner', cost: { ferrite: 3, cryon: 4 }, note: '+25 m ship scan range' },
  { type: 'dock', label: 'Dock', short: 'Dock', cost: { ferrite: 8 }, note: 'An extra berth' },
]);

export const STARTER_BASE = Object.freeze([
  { q: 0, r: 0, type: 'hub' },
  // The dock faces the field (+z), so the first return flight lines up.
  { q: 0, r: 1, type: 'dock' },
  { q: 1, r: -1, type: 'solar' },
  { q: -1, r: 0, type: 'storage' },
]);

export const HEX_NEIGHBOURS = Object.freeze([[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]);
export const MAX_RING = 3;

export function hexToLocal(q, r, size = HEX_SIZE) {
  return [size * Math.sqrt(3) * (q + r / 2), size * 1.5 * r];
}

export function localToHex(x, z, size = HEX_SIZE) {
  const r = z / (size * 1.5);
  const q = x / (size * Math.sqrt(3)) - r / 2;
  return roundHex(q, r);
}

export function roundHex(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq + 0, rr + 0];
}

export const hexDistance = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

export function placementStatus(tiles, q, r) {
  if (hexDistance(q, r) > MAX_RING) return { ok: false, reason: 'Too far from the hub' };
  if (tiles.some(t => t.q === q && t.r === r)) return { ok: false, reason: 'Occupied' };
  const touches = HEX_NEIGHBOURS.some(([dq, dr]) => tiles.some(t => t.q === q + dq && t.r === r + dr));
  if (!touches) return { ok: false, reason: 'Must connect to the station' };
  return { ok: true, reason: '' };
}

export function canAfford(bank, cost) {
  return Object.entries(cost).every(([k, v]) => (bank[k] ?? 0) >= v);
}

export function spend(bank, cost) {
  if (!canAfford(bank, cost)) return false;
  for (const [k, v] of Object.entries(cost)) bank[k] -= v;
  return true;
}
