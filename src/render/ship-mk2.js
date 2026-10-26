import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, loft, plate, cylinderZ, box, mirrorX } from './ship-model.js';

/**
 * XPLORATOR_EXPLORER_MK2: the white and orange human-built explorer of the
 * Exodus fleet, modelled in code from the owner's turnaround sheet
 * (references/ship_3d_turnaround.png, private handoff) and its hero image:
 * an elongated wedge fuselage with flat-topped faceted sections tapering to a
 * narrow dark nose, broad swept shoulders with graphite rear tips, a compact
 * faceted dark canopy, TWO large separate rear engine housings with cyan
 * cores, canted dorsal and ventral fins, sparse orange stripes and patches,
 * graphite recesses and a light grey belly.
 *
 * Same frame and API as the M1 builder: +Z forward (nose), +Y up, metres;
 * returns { group, sockets, nozzles, radius, bounds, hitRadius, exhaust,
 * dispose }. Three meshes (hull, canopy, lights) share three materials, so a
 * ship is three draw calls whatever its loadout. Every module socket still
 * changes visible geometry with its level, without changing the silhouette's
 * identity (always two engines).
 */
// Palette from the turnaround sheet, written as sRGB and converted to the
// linear values vertex colours need.
const srgb = hex => new THREE.Color(hex).toArray();
const C = {
  white: srgb('#eef0f3'),
  pale: srgb('#d9dde3'),
  belly: srgb('#a9afb7'),
  graphite: srgb('#33363d'),
  recess: srgb('#4a4f58'),
  metal: srgb('#7b818b'),
  orange: srgb('#f2861f'),
  black: srgb('#121317'),
};
const GLOW = {
  core: [0.55 * 2.6, 0.92 * 2.6, 1.0 * 2.6],
  ring: [0.35 * 2.0, 0.8 * 2.0, 1.0 * 2.0],
  soft: [0.35 * 1.2, 0.8 * 1.2, 1.0 * 1.2],
  amber: [1.0 * 2.2, 0.62 * 2.2, 0.28 * 2.2],
};
// Flight exhaust is blue (the reference's orange nozzles are unlit, mood only).
export const MK2_EXHAUST = Object.freeze({ core: [0.62, 0.92, 1.0], halo: [0.12, 0.42, 1.0] });

let materials = null;
/** Clean stylised materials: matte-satin white, deep tinted glass, unlit lights. */
export function mk2Materials() {
  if (materials) return materials;
  const hull = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.12, flatShading: true });
  // A faint cool rim keeps the silhouette readable on dark blue space without
  // glowing (M1's rim was three times as strong and blew the hull out).
  hull.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float xpRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(0.42, 0.7, 1.0) * xpRim * 0.16;`,
    );
  };
  hull.customProgramCacheKey = () => 'xp-mk2-hull';
  materials = {
    hull,
    glass: new THREE.MeshStandardMaterial({ color: 0x0a0f19, roughness: 0.12, metalness: 0.7, emissive: 0x08203f, emissiveIntensity: 0.35, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  return materials;
}

// Flat-topped faceted cross-section (12 points, the M1 winding).
function section(z, w, h, y = 0, top = 0.42) {
  return {
    z,
    pts: [
      [0, h], [-w * top, h], [-w * 0.86, h * 0.42], [-w, -h * 0.02], [-w * 0.78, -h * 0.62], [-w * 0.36, -h * 0.86],
      [0, -h * 0.88], [w * 0.36, -h * 0.86], [w * 0.78, -h * 0.62], [w, -h * 0.02], [w * 0.86, h * 0.42], [w * top, h],
    ].map(([x, yy]) => [x, yy + y]),
  };
}

// Fuselage stations: z, half-width, half-height, centre height.
const STATIONS = [
  [1.32, 0.018, 0.012, -0.02],
  [1.12, 0.1, 0.05, -0.01],
  [0.85, 0.2, 0.095, 0],
  [0.45, 0.33, 0.145, 0.01],
  [0.05, 0.42, 0.17, 0.015],
  [-0.35, 0.47, 0.175, 0.015],
  [-0.62, 0.45, 0.165, 0.01],
  [-0.84, 0.36, 0.14, 0],
];
const topAt = z => {
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [z0, , h0, y0] = STATIONS[i], [z1, , h1, y1] = STATIONS[i + 1];
    if (z <= z0 && z >= z1) { const t = (z0 - z) / (z0 - z1); return (h0 + y0) * (1 - t) + (h1 + y1) * t; }
  }
  return 0.18;
};
const halfWidthAt = z => {
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const [z0, w0] = STATIONS[i], [z1, w1] = STATIONS[i + 1];
    if (z <= z0 && z >= z1) { const t = (z0 - z) / (z0 - z1); return w0 * (1 - t) + w1 * t; }
  }
  return 0.4;
};

/** A thin strip (decal) between two points of the x/z plane at height y, both sides. */
function strip(parts, [x0, z0], [x1, z1], y, width, color, thick = 0.012) {
  const dx = x1 - x0, dz = z1 - z0;
  for (const s of [-1, 1]) {
    const g = box(width, thick, Math.hypot(dx, dz), 0, 0, 0);
    g.rotateY(Math.atan2(dx, dz) * s);
    g.translate(s * (x0 + dx / 2), y, z0 + dz / 2);
    parts.push(paint(g, color));
  }
}

/** An open tube along z (no end caps), for nozzles one can look into. */
function tubeZ(r0, r1, z0, z1, x, y, segments = 14) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), segments, 1, true);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

/** A flat disc facing -z (backwards), for nozzle interiors and cores. */
function discBack(r, z, x, y, segments = 14) {
  const g = new THREE.CircleGeometry(r, segments);
  g.rotateY(Math.PI);
  g.translate(x, y, z);
  return g;
}

/** A fin: an outline in its own plane (u outward, z), tilted about the z axis. */
function fin(outline, thickness, angle, x, y) {
  const g = plate(outline, 0, thickness);
  g.rotateZ(angle);
  g.translate(x, y, 0);
  return g;
}

export function defaultLoadoutMk2() {
  return { engine: 1, hull: 1, reactor: 1, scanner: 1, cargo: 1, shield: 1, miner: 1 };
}

/**
 * @param loadout module levels (1..3) per socket
 * @param hitRadius gameplay radius to report (the M1 ship's, so collisions,
 *   docking and mining distances are unchanged)
 */
export function buildExplorerMk2({ loadout = defaultLoadoutMk2(), hitRadius = null } = {}) {
  const L = { ...defaultLoadoutMk2(), ...loadout };
  const hull = [], glass = [], glow = [];
  const sockets = {};
  const nozzles = [];

  // ------------------------------------------------ fuselage
  const sec = STATIONS.map(([z, w, h, y]) => section(z, w, h, y));
  hull.push(paint(loft(sec.slice(0, 2)), C.black)); // dark nose tip
  hull.push(paint(loft(sec.slice(1)), C.white));
  // Light grey belly plate and a dark keel line.
  hull.push(paint(box(0.5, 0.02, 1.36, 0, -0.142, -0.14), C.belly));
  hull.push(paint(box(0.08, 0.025, 1.5, 0, -0.158, -0.08), C.recess));

  // ------------------------------------------------ shoulders (swept wings)
  const span = 1 + (L.hull - 1) * 0.05;
  const shoulder = [[0.3, 0.55], [0.66 * span, -0.42], [0.7 * span, -0.62], [0.58 * span, -0.8], [0.36, -0.72]];
  // A slight anhedral: seen from behind the ship is a low, wide Λ.
  const droop = g => { g.rotateZ(-0.12); g.translate(0, 0.03, 0); return g; };
  const sh = droop(plate(shoulder, -0.01, 0.045));
  hull.push(paint(sh, C.white), paint(mirrorX(sh), C.white));
  // Graphite rear tips of the shoulders.
  const tip = droop(plate([[0.56 * span, -0.5], [0.7 * span, -0.62], [0.58 * span, -0.8], [0.48 * span, -0.74]], -0.008, 0.05));
  hull.push(paint(tip, C.graphite), paint(mirrorX(tip), C.graphite));
  // Orange leading-edge stripe on each shoulder (on the drooped plane), and the long flank stripes.
  for (const s of [-1, 1]) {
    const a = [0.36, 0.41], b = [0.61 * span, -0.34];
    const g = box(0.032, 0.008, Math.hypot(b[0] - a[0], b[1] - a[1]), 0, 0, 0);
    g.rotateY(Math.atan2(b[0] - a[0], b[1] - a[1]));
    g.translate((a[0] + b[0]) / 2, 0.017, (a[1] + b[1]) / 2);
    droop(g);
    hull.push(paint(s > 0 ? g : mirrorX(g), C.orange));
  }
  for (const s of [-1, 1]) {
    const z0 = 0.32, z1 = -0.46;
    const a = [halfWidthAt(z0) + 0.004, z0], b = [halfWidthAt(z1) + 0.004, z1];
    const g = box(0.01, 0.034, Math.hypot(b[0] - a[0], b[1] - a[1]), 0, 0, 0);
    g.rotateY(Math.atan2(b[0] - a[0], b[1] - a[1]) * s);
    g.translate(s * (a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2);
    hull.push(paint(g, C.orange));
  }
  // Nose patches (orange) and top recess panels (graphite).
  for (const s of [-1, 1]) {
    hull.push(paint(box(0.06, 0.01, 0.1, s * 0.09, topAt(0.9) - 0.004, 0.9), C.orange));
    hull.push(paint(box(0.15, 0.012, 0.28, s * 0.27, topAt(-0.2) - 0.004, -0.2), C.recess));
    hull.push(paint(box(0.08, 0.012, 0.12, s * 0.3, topAt(-0.55) - 0.002, -0.55), C.orange));
    // Side intakes ahead of the engines.
    hull.push(paint(box(0.03, 0.07, 0.18, s * (halfWidthAt(-0.42) + 0.006), -0.03, -0.42), C.graphite));
  }
  // Panel seams across the top.
  for (const z of [0.6, 0.15, -0.38]) hull.push(paint(box(0.36 * halfWidthAt(z) * 2, 0.004, 0.008, 0, topAt(z) + 0.001, z), C.recess));

  // ------------------------------------------------ canopy (faceted dark glass)
  const canopy = loft([
    section(0.82, 0.03, 0.018, topAt(0.82) - 0.005, 0.5),
    section(0.64, 0.11, 0.05, topAt(0.64) - 0.002, 0.5),
    section(0.42, 0.14, 0.064, topAt(0.42), 0.5),
    section(0.2, 0.1, 0.045, topAt(0.2), 0.5),
  ]);
  glass.push(paint(canopy, [1, 1, 1]));
  // A white frame bar across the canopy (two panes, as on the sheet).
  hull.push(paint(box(0.24, 0.016, 0.02, 0, topAt(0.42) + 0.06, 0.45), C.white));

  // ------------------------------------------------ dorsal and ventral fins
  const dorsal = [[0, -0.4], [0.28 + (L.hull - 1) * 0.03, -0.8], [0.28 + (L.hull - 1) * 0.03, -0.98], [0, -0.86]];
  const df = fin(dorsal, 0.03, Math.PI / 2 - 0.42, 0.36, 0.12);
  hull.push(paint(df, C.graphite), paint(mirrorX(df), C.graphite));
  const vf = fin([[0, -0.5], [0.2, -0.78], [0.2, -0.92], [0, -0.84]], 0.026, -0.9, 0.4, -0.09);
  hull.push(paint(vf, C.graphite), paint(mirrorX(vf), C.graphite));
  // Orange edge marks on the dorsal fins.
  const mark = fin([[0.19, -0.69], [0.26, -0.77], [0.26, -0.83], [0.19, -0.75]], 0.034, Math.PI / 2 - 0.42, 0.36, 0.12);
  hull.push(paint(mark, C.orange), paint(mirrorX(mark), C.orange));
  if (L.hull >= 2) {
    // Wingtip fins.
    const wt = fin([[0, -0.52], [0.12, -0.66], [0.12, -0.74], [0, -0.7]], 0.02, Math.PI / 2 - 0.15, 0.68 * span, 0.0);
    hull.push(paint(wt, C.graphite), paint(mirrorX(wt), C.graphite));
  }
  if (L.hull >= 3) {
    // Forward canards.
    const cn = plate([[0.16, 0.72], [0.34, 0.52], [0.18, 0.54]], -0.02, 0.025);
    hull.push(paint(cn, C.graphite), paint(mirrorX(cn), C.graphite));
  }

  // ------------------------------------------------ engines: two large housings
  const er = 0.165 * (1 + (L.engine - 1) * 0.07);
  const ex = 0.25, ey = -0.03;
  const front = -0.4, back = -1.12 - (L.engine - 1) * 0.04;
  for (const x of [-ex, ex]) {
    hull.push(paint(cylinderZ(er * 0.9, er, front, front - 0.08, x, ey, 14), C.graphite));
    hull.push(paint(cylinderZ(er, er, front - 0.08, back, x, ey, 14), C.graphite));
    for (const z of [-0.62, -0.84, -1.02]) hull.push(paint(cylinderZ(er * 1.04, er * 1.04, z + 0.025, z - 0.025, x, ey, 14), C.metal));
    // Nozzle: an open metal flare, a dark throat and the cyan core inside it.
    hull.push(paint(tubeZ(er * 0.98, er * 1.1, back, back - 0.12, x, ey, 14), C.metal));
    hull.push(paint(discBack(er * 0.98, back - 0.01, x, ey, 14), C.black));
    glow.push(paint(discBack(er * 0.62, back - 0.03, x, ey, 14), GLOW.core));
    if (L.engine >= 2) glow.push(paint(cylinderZ(er * 1.06, er * 1.06, -0.74, -0.77, x, ey, 14), GLOW.ring));
    if (L.engine >= 3) {
      // Vectoring vanes above and below each nozzle.
      for (const v of [-1, 1]) hull.push(paint(box(er * 1.4, 0.018, 0.12, x, ey + v * er * 1.05, back - 0.02), C.metal));
    }
    nozzles.push(new THREE.Vector3(x, ey, back - 0.12));
  }
  // Graphite spine between the engines with an orange patch.
  hull.push(paint(box(0.13, 0.15, 0.62, 0, 0.05, -0.86), C.graphite));
  hull.push(paint(box(0.09, 0.01, 0.12, 0, 0.13, -0.8), C.orange));
  sockets.engine = new THREE.Vector3(ex, ey, back + 0.1);

  // ------------------------------------------------ module sockets
  // Reactor: dorsal hex module behind the canopy, its core glowing.
  const rr = 0.075 + (L.reactor - 1) * 0.018;
  const rBase = new THREE.CylinderGeometry(rr, rr * 1.12, 0.05, 6);
  rBase.translate(0, topAt(-0.02) + 0.02, -0.02);
  hull.push(paint(rBase, C.recess));
  const core = new THREE.CylinderGeometry(rr * 0.6, rr * 0.6, 0.012, 6);
  core.translate(0, topAt(-0.02) + 0.05, -0.02);
  glow.push(paint(core, GLOW.soft));
  sockets.reactor = new THREE.Vector3(0, topAt(-0.02) + 0.05, -0.02);
  // Scanner: mast and dish on the spine.
  const dish = 0.055 + (L.scanner - 1) * 0.022;
  hull.push(paint(box(0.018, 0.1, 0.018, 0, topAt(-0.46) + 0.05, -0.46), C.metal));
  const dishGeo = new THREE.ConeGeometry(dish, dish * 0.42, 10, 1, true);
  dishGeo.rotateX(Math.PI);
  dishGeo.translate(0, topAt(-0.46) + 0.11, -0.46);
  hull.push(paint(dishGeo, C.pale));
  glow.push(paint(box(0.016, 0.016, 0.016, 0, topAt(-0.46) + 0.12, -0.46), GLOW.amber));
  sockets.scanner = new THREE.Vector3(0, topAt(-0.46) + 0.11, -0.46);
  // Cargo: belly pods, more per level.
  for (let i = 0; i < Math.min(3, L.cargo); i++) {
    const z = 0.32 - i * 0.36;
    hull.push(paint(box(0.24, 0.085, 0.3, 0, -0.2, z), C.pale));
    glow.push(paint(box(0.25, 0.01, 0.016, 0, -0.18, z + 0.15), GLOW.amber));
  }
  sockets.cargo = new THREE.Vector3(0, -0.22, 0.1);
  // Shield: emitter nodes at the shoulder tips.
  const nodeR = 0.03 + L.shield * 0.011;
  for (const s of [-1, 1]) {
    const node = new THREE.OctahedronGeometry(nodeR, 0);
    node.translate(s * 0.66 * span, -0.05, -0.64);
    glow.push(paint(node, GLOW.ring));
  }
  sockets.shield = new THREE.Vector3(0.66 * span, -0.05, -0.64);
  // Mining beam: twin prongs under the nose with amber emitters.
  const prong = 0.2 + (L.miner - 1) * 0.08;
  for (const s of [-1, 1]) {
    hull.push(paint(box(0.022, 0.022, prong, s * 0.07, -0.07, 0.95 + prong / 2), C.metal));
    glow.push(paint(box(0.03, 0.03, 0.03, s * 0.07, -0.07, 0.95 + prong), GLOW.amber));
  }
  sockets.miner = new THREE.Vector3(0, -0.07, 0.95 + prong);
  sockets.hull = new THREE.Vector3(0.5 * span, 0, -0.45);

  // ------------------------------------------------ meshes
  const mats = mk2Materials();
  const group = new THREE.Group();
  group.name = 'Ship:explorer-mk2';
  const hullMesh = new THREE.Mesh(mergeGeometries(hull), mats.hull);
  const glassMesh = new THREE.Mesh(mergeGeometries(glass), mats.glass);
  const glowMesh = new THREE.Mesh(mergeGeometries(glow), mats.glow);
  hullMesh.name = 'Hull'; glassMesh.name = 'Canopy'; glowMesh.name = 'Lights';
  group.add(hullMesh, glassMesh, glowMesh);
  for (const g of [...hull, ...glass, ...glow]) g.dispose();
  const bounds = new THREE.Box3().setFromObject(group);
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  return {
    group, sockets, nozzles, radius, bounds,
    hitRadius: hitRadius ?? radius,
    exhaust: MK2_EXHAUST,
    model: 'mk2',
    triangles: (hullMesh.geometry.attributes.position.count + glassMesh.geometry.attributes.position.count + glowMesh.geometry.attributes.position.count) / 3,
    dispose() {
      hullMesh.geometry.dispose();
      glassMesh.geometry.dispose();
      glowMesh.geometry.dispose();
    },
  };
}
