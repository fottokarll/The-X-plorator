import { SECTOR } from './config.js';

/**
 * Deterministic layout of the Outer Verge sector: asteroid field, resource
 * nodes and distant debris. Pure data (no Three.js) so it can be unit tested
 * and shared by every player in a session (same seed, same rocks).
 */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const len = v => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// Hand-placed resource nodes for a readable first mission, in a gentle arc
// from the station into the field, each within sight of the next.
const NODE_SPOTS = [
  { id: 'cryon-a', type: 'crystal', position: [-95, 18, 330], size: 7.5, yield: 3 },
  { id: 'cryon-b', type: 'crystal', position: [190, -42, 520], size: 8.5, yield: 3 },
  { id: 'cryon-c', type: 'crystal', position: [-60, -70, 760], size: 7, yield: 3 },
  { id: 'cryon-d', type: 'crystal', position: [330, 40, 840], size: 9, yield: 4 },
  { id: 'cryon-e', type: 'crystal', position: [-300, 60, 610], size: 6.5, yield: 3 },
  { id: 'ferrite-a', type: 'ore', position: [70, 30, 420], size: 9, yield: 4 },
  { id: 'ferrite-b', type: 'ore', position: [-210, -30, 470], size: 10, yield: 4 },
  { id: 'ferrite-c', type: 'ore', position: [260, -10, 690], size: 8, yield: 4 },
];

export function buildSectorLayout(seed = SECTOR.seed) {
  const rand = rng(seed);
  const station = SECTOR.station.position;
  const nodes = NODE_SPOTS.map(n => ({ ...n, radius: n.size }));
  const rocks = [];
  const field = SECTOR.field;
  const clearOf = (p, r) => {
    if (len(sub(p, station)) < 110 + r) return false;
    for (const n of nodes) if (len(sub(p, n.position)) < n.radius + r + 14) return false;
    for (const k of rocks) if (len(sub(p, k.position)) < k.radius + r + 3) return false;
    return true;
  };
  let guard = 0;
  while (rocks.length < field.rocks && guard++ < 6000) {
    // Flattened ellipsoid around the field centre.
    const u = rand() * 2 - 1, v = rand() * 2 - 1, w = rand() * 2 - 1;
    if (u * u + v * v + w * w > 1) continue;
    const p = [
      field.center[0] + u * field.radius * 1.15,
      field.center[1] + v * field.radius * 0.38,
      field.center[2] + w * field.radius,
    ];
    // Mostly small stones, a few large boulders.
    const big = rand() > 0.93;
    const radius = big ? 12 + rand() * 16 : 0.8 + Math.pow(rand(), 2.2) * 8;
    if (!clearOf(p, radius)) continue;
    rocks.push({ position: p, radius, variant: Math.floor(rand() * 4), spin: 0.02 + rand() * 0.12, seed: rand() });
  }
  // Distant debris for depth: large, sparse, mostly toward the planet.
  const debris = [];
  const toPlanet = SECTOR.planet.center.map(c => c / len(SECTOR.planet.center));
  for (let i = 0; i < 16; i++) {
    const t = 2200 + rand() * 3000;
    const spread = 0.55;
    const dir = [
      toPlanet[0] + (rand() - 0.5) * spread * 2,
      toPlanet[1] + (rand() - 0.35) * spread,
      toPlanet[2] + (rand() - 0.5) * spread,
    ];
    const l = len(dir);
    const p = dir.map(c => (c / l) * t);
    debris.push({ position: p, radius: 30 + Math.pow(rand(), 1.5) * 110, variant: Math.floor(rand() * 4), spin: 0.004 + rand() * 0.02, seed: rand() });
  }
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2, t = 1400 + rand() * 2200;
    debris.push({ position: [Math.cos(a) * t, (rand() - 0.5) * 900, Math.sin(a) * t * 0.6 - 600], radius: 30 + rand() * 90, variant: Math.floor(rand() * 4), spin: 0.004 + rand() * 0.02, seed: rand() });
  }
  return { station, nodes, rocks, debris };
}
