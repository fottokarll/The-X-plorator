import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Original modular X-plorator spacecraft, built entirely in code.
 * +Z is forward (nose), +Y up, units are world metres (Survivor ~2.4 m long).
 * Every module socket (engine, hull, reactor, scanner, cargo, shield, miner)
 * changes visible geometry with its level, and the same builder serves the
 * flight view, the hangar and the vessel selection cards.
 */

const C = {
  white: [0.92, 0.95, 1.0],
  pearl: [0.8, 0.85, 0.93],
  grey: [0.48, 0.53, 0.63],
  dark: [0.1, 0.12, 0.2],
  gold: [0.95, 0.72, 0.42],
};
const GLOW = {
  cyan: [0.45 * 2.6, 0.89 * 2.6, 0.96 * 2.6],
  amber: [1.0 * 3.0, 0.62 * 3.0, 0.32 * 3.0],
  softCyan: [0.4, 0.8, 0.95],
};

export const SOCKETS = Object.freeze(['engine', 'hull', 'reactor', 'scanner', 'cargo', 'shield', 'miner']);

export const VESSEL_SHAPES = Object.freeze({
  survivor: { body: [1, 1, 1], wing: 1.0, engines: 2, length: 1.0, podsSide: 0 },
  pioneer: { body: [1.05, 1.05, 1.18], wing: 1.3, engines: 2, length: 1.12, podsSide: 0 },
  colony: { body: [1.45, 1.25, 1.2], wing: 0.95, engines: 4, length: 1.15, podsSide: 1 },
  exodus: { body: [1.6, 1.35, 1.55], wing: 1.2, engines: 6, length: 1.5, podsSide: 2 },
});

function paint(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

// Lofts closed cross-sections (arrays of [x, y]) placed along z.
function loft(sections) {
  const positions = [];
  const push = (a, b, c) => positions.push(...a, ...b, ...c);
  for (let s = 0; s < sections.length - 1; s++) {
    const A = sections[s], B = sections[s + 1];
    const n = A.pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = [A.pts[i][0], A.pts[i][1], A.z], a1 = [A.pts[j][0], A.pts[j][1], A.z];
      const b0 = [B.pts[i][0], B.pts[i][1], B.z], b1 = [B.pts[j][0], B.pts[j][1], B.z];
      // Sections run nose (+z) to tail (-z); wind so normals face outward.
      push(a0, b0, b1);
      push(a0, b1, a1);
    }
  }
  const capOf = (sec, flip) => {
    const c = sec.pts.reduce((m, p) => [m[0] + p[0] / sec.pts.length, m[1] + p[1] / sec.pts.length], [0, 0]);
    for (let i = 0; i < sec.pts.length; i++) {
      const j = (i + 1) % sec.pts.length;
      const a = [c[0], c[1], sec.z], b = [sec.pts[i][0], sec.pts[i][1], sec.z], d = [sec.pts[j][0], sec.pts[j][1], sec.z];
      if (flip) push(a, d, b); else push(a, b, d);
    }
  };
  capOf(sections[0], false);
  capOf(sections[sections.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

function section(z, w, h, ridge = 1.25) {
  return {
    z,
    pts: [
      [0, h * ridge], [-w * 0.68, h * 0.78], [-w, h * 0.05], [-w * 0.72, -h * 0.72],
      [0, -h * 0.92], [w * 0.72, -h * 0.72], [w, h * 0.05], [w * 0.68, h * 0.78],
    ],
  };
}

// Flat plate from a 2D outline in the x/z plane, with thickness along y.
function plate(outline, y, thickness) {
  const positions = [];
  const top = outline.map(([x, z]) => [x, y + thickness / 2, z]);
  const bottom = outline.map(([x, z]) => [x, y - thickness / 2, z]);
  for (let i = 1; i < outline.length - 1; i++) {
    // Outlines are clockwise in x/z, so this fan faces +y.
    positions.push(...top[0], ...top[i], ...top[i + 1]);
    positions.push(...bottom[0], ...bottom[i + 1], ...bottom[i]);
  }
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    positions.push(...top[i], ...bottom[j], ...top[j]);
    positions.push(...top[i], ...bottom[i], ...bottom[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

function cylinderZ(r0, r1, z0, z1, x, y, segments = 10) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), segments, 1);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function mirrorX(g) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  // Mirroring flips winding; swap two vertices per triangle.
  const p = m.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, y, z);
  }
  return m;
}

let materials = null;
export function shipMaterials() {
  if (materials) return materials;
  const hull = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.36, metalness: 0.22, flatShading: true,
  });
  // Cool rim light keeps the tiny white silhouette readable against both the
  // dark sky and the bright planet.
  hull.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      // 'normal' is the view-space normal (flat-shaded meshes have no vNormal).
      float xpRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(0.42, 0.78, 1.0) * xpRim * 0.55;`,
    );
  };
  hull.customProgramCacheKey = () => 'xp-hull-rim';
  materials = {
    hull,
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1a3c, roughness: 0.06, metalness: 0.85, emissive: 0x0a3a7a, emissiveIntensity: 0.6, flatShading: true,
    }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  return materials;
}

export function defaultLoadout() {
  return { engine: 1, hull: 1, reactor: 1, scanner: 1, cargo: 1, shield: 1, miner: 1 };
}

/**
 * Builds a ship group. Returns { group, sockets, nozzles, radius }:
 * sockets are local anchor points for hangar callouts, nozzles are local
 * engine exhaust positions for glows and trails.
 */
export function buildShip({ vessel = 'survivor', loadout = defaultLoadout() } = {}) {
  const shape = VESSEL_SHAPES[vessel] ?? VESSEL_SHAPES.survivor;
  const L = { ...defaultLoadout(), ...loadout };
  const [bx, by, bz] = shape.body;
  const hullParts = [], glassParts = [], glowParts = [];
  const sockets = {};
  const nozzles = [];

  // Fuselage: faceted arrowhead body.
  const len = shape.length;
  const body = loft([
    section(1.32 * len, 0.025 * bx, 0.02 * by),
    section(1.0 * len, 0.13 * bx, 0.085 * by),
    section(0.55 * len, 0.25 * bx, 0.155 * by),
    section(0.1 * len, 0.31 * bx, 0.195 * by),
    section(-0.45 * len, 0.29 * bx, 0.185 * by),
    section(-0.85 * len, 0.23 * bx, 0.155 * by),
    section(-1.0 * len, 0.19 * bx, 0.125 * by),
  ]);
  hullParts.push(paint(body, C.white));
  // Dark keel stripe under the body for contrast.
  hullParts.push(paint(box(0.16 * bx, 0.03, 1.5 * len, 0, -0.17 * by, -0.1 * len), C.grey));
  // Side accent lines (cyan) along the hull.
  for (const s of [-1, 1]) {
    glowParts.push(paint(box(0.012, 0.012, 0.95 * len, s * 0.3 * bx, 0.035 * by, 0.05 * len), GLOW.cyan));
  }

  // Canopy.
  const canopy = loft([
    section(0.82 * len, 0.03 * bx, 0.03, 1.0),
    section(0.62 * len, 0.1 * bx, 0.075, 1.25),
    section(0.3 * len, 0.12 * bx, 0.085, 1.3),
    section(0.08 * len, 0.06 * bx, 0.04, 1.0),
  ]);
  canopy.translate(0, 0.15 * by, 0);
  glassParts.push(paint(canopy, [1, 1, 1]));

  // Hull module: wings.
  const span = shape.wing * (1 + (L.hull - 1) * 0.08);
  const wingOutline = [
    [0.22 * bx, 0.42 * len], [0.98 * span, -0.62 * len], [1.02 * span, -0.86 * len],
    [0.82 * span, -0.9 * len], [0.24 * bx, -0.72 * len],
  ];
  const wing = plate(wingOutline, -0.02 * by, 0.05);
  hullParts.push(paint(wing, C.pearl), paint(mirrorX(wing), C.pearl));
  // Leading-edge light strips.
  for (const s of [-1, 1]) {
    const dx = 0.98 * span - 0.22 * bx, dz = -0.62 * len - 0.42 * len;
    const strip = box(0.014, 0.014, Math.hypot(dx, dz), 0, 0, 0);
    strip.rotateY(Math.atan2(dx, dz) * s);
    strip.translate(s * (0.22 * bx + dx / 2), 0.012, 0.42 * len + dz / 2);
    glowParts.push(paint(strip, GLOW.cyan));
  }
  if (L.hull >= 2) {
    // Wingtip fins.
    for (const s of [-1, 1]) {
      hullParts.push(paint(box(0.03, 0.22, 0.26, s * 1.0 * span, 0.09, -0.8 * len), C.white));
    }
  }
  if (L.hull >= 3) {
    const canard = plate([[0.18 * bx, 0.72 * len], [0.45 * bx, 0.5 * len], [0.2 * bx, 0.52 * len]], 0.02, 0.03);
    hullParts.push(paint(canard, C.pearl), paint(mirrorX(canard), C.pearl));
  }
  sockets.hull = new THREE.Vector3(0.62 * span, 0, -0.45 * len);

  // Engine module: nacelles and nozzles.
  // Each engine level is visibly bigger; Lv 2+ adds a cyan intake ring, Lv 3 a third engine.
  const engineR = (0.12 + (L.engine - 1) * 0.04) * Math.min(by, 1.25);
  const engineLen = 0.82 + (L.engine - 1) * 0.22;
  const enginePositions = [];
  const count = shape.engines + (L.engine >= 3 && shape.engines === 2 ? 1 : 0);
  if (count === 3) enginePositions.push([-0.42 * bx, 0], [0, 0.05], [0.42 * bx, 0]);
  else {
    const perSide = count / 2;
    for (let i = 0; i < perSide; i++) {
      const x = (0.42 + i * 0.36) * bx;
      const y = i % 2 ? 0.12 * by : -0.02;
      enginePositions.push([-x, y], [x, y]);
    }
  }
  const tail = -1.0 * len;
  for (const [x, y] of enginePositions) {
    hullParts.push(paint(cylinderZ(engineR * 0.75, engineR, tail + engineLen * 0.75, tail + engineLen * 0.05, x, y, 10), C.white));
    hullParts.push(paint(cylinderZ(engineR, engineR * 1.05, tail + engineLen * 0.05, tail - 0.1, x, y, 10), C.grey));
    // Nozzle: amber core ring + cyan inner disk.
    glowParts.push(paint(cylinderZ(engineR * 0.82, engineR * 0.82, tail - 0.1, tail - 0.13, x, y, 10), GLOW.amber));
    if (L.engine >= 2) glowParts.push(paint(cylinderZ(engineR * 1.06, engineR * 1.06, tail + engineLen * 0.62, tail + engineLen * 0.58, x, y, 10), GLOW.cyan));
    nozzles.push(new THREE.Vector3(x, y, tail - 0.16));
  }
  sockets.engine = new THREE.Vector3(Math.abs(enginePositions[enginePositions.length - 1][0]), 0, tail + 0.1);

  // Reactor module: dorsal hump with glowing hex core.
  const coreR = 0.07 + (L.reactor - 1) * 0.022;
  hullParts.push(paint(cylinderZ(0.1 * bx, 0.13 * bx, -0.05 * len, -0.5 * len, 0, 0.16 * by, 6), C.white));
  const core = new THREE.CylinderGeometry(coreR, coreR, 0.05, 6);
  core.translate(0, 0.27 * by, -0.28 * len);
  glowParts.push(paint(core, GLOW.cyan));
  sockets.reactor = new THREE.Vector3(0, 0.28 * by, -0.28 * len);

  // Scanner module: mast and dish.
  const dish = 0.07 + (L.scanner - 1) * 0.03;
  hullParts.push(paint(box(0.025, 0.14, 0.025, 0, 0.27 * by, -0.66 * len), C.grey));
  const dishGeo = new THREE.ConeGeometry(dish, dish * 0.45, 10, 1, true);
  dishGeo.rotateX(Math.PI);
  dishGeo.translate(0, 0.36 * by, -0.66 * len);
  hullParts.push(paint(dishGeo, C.white));
  glowParts.push(paint(box(0.02, 0.02, 0.02, 0, 0.37 * by, -0.66 * len), GLOW.amber));
  sockets.scanner = new THREE.Vector3(0, 0.36 * by, -0.66 * len);

  // Cargo module: belly pods (more and larger per level).
  const pods = Math.min(3, L.cargo);
  for (let i = 0; i < pods; i++) {
    const z = 0.2 * len - i * 0.42 * len;
    hullParts.push(paint(box(0.24 * bx, 0.11, 0.34 * len, 0, -0.22 * by, z), C.pearl));
    glowParts.push(paint(box(0.25 * bx, 0.012, 0.02, 0, -0.2 * by, z + 0.17 * len), GLOW.amber));
  }
  for (let k = 0; k < shape.podsSide; k++) {
    for (const s of [-1, 1]) {
      hullParts.push(paint(box(0.16, 0.16, 0.7 * len, s * (0.42 + k * 0.2) * bx, 0.16 * by, -0.2 * len), C.white));
    }
  }
  sockets.cargo = new THREE.Vector3(0, -0.24 * by, 0.05 * len);

  // Shield module: emitter nodes at the wingtips.
  const nodeR = 0.03 + L.shield * 0.012;
  for (const s of [-1, 1]) {
    const node = new THREE.OctahedronGeometry(nodeR, 0);
    node.translate(s * 1.0 * span, 0.0, -0.78 * len);
    glowParts.push(paint(node, GLOW.cyan));
  }
  sockets.shield = new THREE.Vector3(1.0 * span, 0, -0.78 * len);

  // Mining module: twin forward prongs with amber emitters.
  const prong = 0.22 + (L.miner - 1) * 0.1;
  for (const s of [-1, 1]) {
    hullParts.push(paint(box(0.025, 0.025, prong, s * 0.12 * bx, -0.08 * by, 0.95 * len + prong / 2), C.grey));
    glowParts.push(paint(box(0.032, 0.032, 0.032, s * 0.12 * bx, -0.08 * by, 0.95 * len + prong), GLOW.amber));
  }
  sockets.miner = new THREE.Vector3(0, -0.08 * by, 0.95 * len + prong);

  const mats = shipMaterials();
  const group = new THREE.Group();
  group.name = `Ship:${vessel}`;
  const hullMesh = new THREE.Mesh(mergeGeometries(hullParts), mats.hull);
  const glassMesh = new THREE.Mesh(mergeGeometries(glassParts), mats.glass);
  const glowMesh = new THREE.Mesh(mergeGeometries(glowParts), mats.glow);
  hullMesh.name = 'Hull'; glassMesh.name = 'Canopy'; glowMesh.name = 'Lights';
  group.add(hullMesh, glassMesh, glowMesh);
  for (const g of [...hullParts, ...glassParts, ...glowParts]) g.dispose();

  const box3 = new THREE.Box3().setFromObject(group);
  const sphere = box3.getBoundingSphere(new THREE.Sphere());
  return {
    group,
    sockets,
    nozzles,
    radius: sphere.radius,
    bounds: box3,
    dispose() {
      hullMesh.geometry.dispose();
      glassMesh.geometry.dispose();
      glowMesh.geometry.dispose();
    },
  };
}

const SHOW_X = new THREE.Vector3(), SHOW_Y = new THREE.Vector3(), SHOW_Z = new THREE.Vector3();
const SHOW_M = new THREE.Matrix4(), SHOW_Q = new THREE.Quaternion(), SPIN_Q = new THREE.Quaternion();
const UP_Y = new THREE.Vector3(0, 1, 0);
/**
 * Orients a ship relative to a camera so it is seen from above (tilt 0 =
 * exactly top-down, larger = more of a three-quarter view) with its nose
 * toward the top of the screen; `spin` turns it about its own vertical axis.
 */
export function orientForShowcase(group, cameraQuaternion, tilt = 0.3, spin = 0) {
  SHOW_X.set(-1, 0, 0);
  SHOW_Y.set(0, Math.sin(tilt), Math.cos(tilt));
  SHOW_Z.set(0, Math.cos(tilt), -Math.sin(tilt));
  SHOW_M.makeBasis(SHOW_X, SHOW_Y, SHOW_Z);
  SHOW_Q.setFromRotationMatrix(SHOW_M);
  SPIN_Q.setFromAxisAngle(UP_Y, spin);
  group.quaternion.copy(cameraQuaternion).multiply(SHOW_Q).multiply(SPIN_Q);
}
