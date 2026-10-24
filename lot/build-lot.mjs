// THE X-PLORATOR — lot #323 street build: launch beacon / docking terminal.
// Generates LOD0, LOD1 and LOD2 GLBs plus lot.json, shaders and build.js into dist/lot/.
// Run: node lot/build-lot.mjs
// Lot box (verified via /api/agent/me): 16 × 16 m footprint, 30 m tall, origin at floor centre, +Y up.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { paint } from './lib/png.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist', 'lot');
const ASSETS = path.join(ROOT, 'lot', 'assets');
const LOT = { id: 323, width: 16, depth: 16, height: 30 };
const MARGIN = 0.3;
const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Locked IMG 07 palette, converted to linear for vertex colours and factors.
const lin = hex => { const c = new THREE.Color().setHex(hex, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };
const COLOR = {
  Body: lin(0x101a3d), Hull: lin(0xe6f0fa), Neon: lin(0x70e2f4), Accent: lin(0xf8bd78), Glass: lin(0x1b205a),
};

/** Point at radius r, angle a (0 = +Z street, 90° = +X street) and height y. */
const polar = (r, a, y) => V(r * Math.sin(a), y, r * Math.cos(a));
const radial = a => V(Math.sin(a), 0, Math.cos(a));

// ---------------------------------------------------------------- geometry helpers

/** Non-indexed copy with flat or kept normals, box-projected UVs, no other attributes. */
function prep(g, { flat = false, uvScale = 4 } = {}) {
  let geom = g;
  if (flat) {
    geom = geom.index ? geom.toNonIndexed() : geom;
    geom.deleteAttribute('normal');
    geom.computeVertexNormals();
  } else {
    if (!geom.attributes.normal) geom.computeVertexNormals();
    geom = geom.index ? geom.toNonIndexed() : geom;
  }
  for (const k of Object.keys(geom.attributes)) if (k !== 'position' && k !== 'normal') geom.deleteAttribute(k);
  const p = geom.attributes.position, n = p.count;
  const uv = new Float32Array(n * 2);
  const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), fn = V(0, 0, 0);
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    fn.subVectors(c, b).cross(V(0, 0, 0).subVectors(a, b)).normalize();
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const q = [a, b, c][k];
      let u, v;
      if (ay >= ax && ay >= az) { u = q.x; v = q.z; } else if (ax >= az) { u = q.z; v = q.y; } else { u = q.x; v = q.y; }
      uv[(i + k) * 2] = u / uvScale; uv[(i + k) * 2 + 1] = v / uvScale;
    }
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

/** Custom triangle soup with explicit outward hints (winding fixed automatically). */
class Soup {
  constructor() { this.pos = []; }
  tri(a, b, c, hint) {
    const n = V(0, 0, 0).subVectors(b, a).cross(V(0, 0, 0).subVectors(c, a));
    if (hint && n.dot(hint) < 0) [b, c] = [c, b];
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  quad(a, b, c, d, hint) { this.tri(a, b, c, hint); this.tri(a, c, d, hint); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    return g;
  }
}

const hexPrism = (R, y0, y1, { rot = Math.PI / 6, cx = 0, cz = 0 } = {}) =>
  new THREE.CylinderGeometry(R, R, y1 - y0, 6, 1).rotateY(rot).translate(cx, (y0 + y1) / 2, cz);
const taperPrism = (rBottom, rTop, y0, y1, sides = 6, { rot = Math.PI / 6, cx = 0, cz = 0 } = {}) =>
  new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, sides, 1).rotateY(rot).translate(cx, (y0 + y1) / 2, cz);

/** Box from a to b with width w (across) and thickness t (along `out`). */
function beam(a, b, w, t, out = UP, offset = 0) {
  const dir = V(0, 0, 0).subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  let x = V(0, 0, 0).crossVectors(out, dir);
  if (x.lengthSq() < 1e-8) x = V(0, 0, 0).crossVectors(Math.abs(dir.y) < 0.9 ? UP : V(1, 0, 0), dir);
  x.normalize();
  const y = V(0, 0, 0).crossVectors(dir, x).normalize();
  const g = new THREE.BoxGeometry(w, t, len);
  const m = new THREE.Matrix4().makeBasis(x, y, dir);
  m.setPosition(V(0, 0, 0).addVectors(a, b).multiplyScalar(0.5).addScaledVector(y, offset));
  return g.applyMatrix4(m);
}

/** Horizontal hexagon outline (6 beams) at height y, vertices at rot + k·60°. */
function hexOutline(R, y, w, t, { rot = Math.PI / 6, cx = 0, cz = 0 } = {}) {
  const parts = [];
  const c = V(cx, 0, cz);
  for (let k = 0; k < 6; k++) {
    const a0 = rot + k * Math.PI / 3, a1 = a0 + Math.PI / 3;
    const p0 = polar(R, a0, y).add(c), p1 = polar(R, a1, y).add(c);
    const d = V(0, 0, 0).subVectors(p1, p0).normalize().multiplyScalar(w * 0.29);
    parts.push(beam(p0.clone().sub(d), p1.clone().add(d), w, t, UP));
  }
  return mergeGeometries(parts.map(g => g.toNonIndexed()));
}

/** Vertical pointy-top hexagon outline in the plane spanned by `right`/UP, facing `normal`. */
function hexOutlineVertical(center, R, w, t, right, normal) {
  const parts = [];
  const pt = k => { const phi = Math.PI / 2 + k * Math.PI / 3; return center.clone().addScaledVector(right, R * Math.cos(phi)).addScaledVector(UP, R * Math.sin(phi)); };
  for (let k = 0; k < 6; k++) {
    const p0 = pt(k), p1 = pt(k + 1);
    const d = V(0, 0, 0).subVectors(p1, p0).normalize().multiplyScalar(w * 0.29);
    parts.push(beam(p0.clone().sub(d), p1.clone().add(d), w, t, normal));
  }
  return mergeGeometries(parts.map(g => g.toNonIndexed()));
}

/** Rectangular-section band ring of radius r around +Y (correct normals on all four faces). */
function bandRing(r, halfW, halfH, segs) {
  const s = new Soup();
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * TAU, a1 = (i + 1) / segs * TAU, am = (a0 + a1) / 2;
    const o0 = polar(r + halfW, a0, 0), o1 = polar(r + halfW, a1, 0), i0 = polar(r - halfW, a0, 0), i1 = polar(r - halfW, a1, 0);
    const up = V(0, halfH, 0), dn = V(0, -halfH, 0);
    s.quad(o0.clone().add(dn), o1.clone().add(dn), o1.clone().add(up), o0.clone().add(up), radial(am));
    s.quad(i0.clone().add(dn), i0.clone().add(up), i1.clone().add(up), i1.clone().add(dn), radial(am).negate());
    s.quad(i0.clone().add(up), o0.clone().add(up), o1.clone().add(up), i1.clone().add(up), UP);
    s.quad(i0.clone().add(dn), i1.clone().add(dn), o1.clone().add(dn), o0.clone().add(dn), V(0, -1, 0));
  }
  return s.geometry();
}

/** Lofted ship fuselage: sections [z, halfWidth, halfHeight, yOffset]; last one is the nose point. */
function loft(sections, sides) {
  const s = new Soup();
  const ring = ([z, w, h, y]) => Array.from({ length: sides }, (_, k) => {
    const psi = (k + 0.5) / sides * TAU;
    const sy = Math.sin(psi);
    return V(w * Math.cos(psi), y + h * sy * (sy < 0 ? 0.72 : 1), z);
  });
  const rings = sections.slice(0, -1).map(ring);
  const centre = sec => V(0, sec[3], sec[0]);
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < sides; k++) {
      const a = rings[r][k], b = rings[r][(k + 1) % sides], c = rings[r + 1][(k + 1) % sides], d = rings[r + 1][k];
      const mid = V(0, 0, 0).add(a).add(b).add(c).add(d).multiplyScalar(0.25);
      const axis = V(0, (sections[r][3] + sections[r + 1][3]) / 2, mid.z);
      s.quad(a, b, c, d, mid.clone().sub(axis));
    }
  }
  const tail = centre(sections[0]);
  for (let k = 0; k < sides; k++) s.tri(tail, rings[0][k], rings[0][(k + 1) % sides], V(0, 0, -1));
  const nose = centre(sections[sections.length - 1]);
  const last = rings[rings.length - 1];
  for (let k = 0; k < sides; k++) {
    const mid = V(0, 0, 0).add(last[k]).add(last[(k + 1) % sides]).multiplyScalar(0.5);
    s.tri(last[k], last[(k + 1) % sides], nose, mid.sub(V(0, nose.y, mid.z)).add(V(0, 0, 0.6)));
  }
  return s.geometry();
}

/** Flat polygon (x,z points) extruded by `thick` along Y, centred at y. */
function slab(points, thick, y = 0) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })
    .rotateX(Math.PI / 2).translate(0, y + thick / 2, 0);
}

/** Vertical fin polygon in the YZ plane (points as [z, y]) extruded by thick along X. */
function fin(points, thick, x = 0) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })
    .rotateY(-Math.PI / 2).translate(x + thick / 2, 0, 0);
}

// Stroke letters on a 4 × 6 grid.
const P_STROKES = [[0, 0, 0, 6], [0, 6, 3.1, 6], [3.1, 6, 4, 5.1], [4, 5.1, 4, 3.9], [4, 3.9, 3.1, 3], [3.1, 3, 0, 3]];
const GLYPHS = {
  X: [[0, 0, 4, 6], [0, 6, 4, 0]],
  '-': [[0.6, 3, 3.4, 3]],
  P: P_STROKES,
  L: [[0, 6, 0, 0], [0, 0, 4, 0]],
  O: [[0.9, 0, 3.1, 0], [3.1, 0, 4, 0.9], [4, 0.9, 4, 5.1], [4, 5.1, 3.1, 6], [3.1, 6, 0.9, 6], [0.9, 6, 0, 5.1], [0, 5.1, 0, 0.9], [0, 0.9, 0.9, 0]],
  R: [...P_STROKES, [1.7, 3, 4, 0]],
  A: [[0, 0, 2, 6], [2, 6, 4, 0], [0.75, 2.25, 3.25, 2.25]],
  T: [[0, 6, 4, 6], [2, 6, 2, 0]],
};

function lettering(text, origin, right, normal, height, stroke, depth) {
  const unit = height / 6, adv = unit * 4 + height * 0.36;
  const width = text.length * adv - height * 0.36;
  const start = origin.clone().addScaledVector(right, -width / 2);
  const parts = [];
  [...text].forEach((ch, i) => {
    const base = start.clone().addScaledVector(right, i * adv);
    for (const [x0, y0, x1, y1] of GLYPHS[ch]) {
      const a = base.clone().addScaledVector(right, x0 * unit).addScaledVector(UP, y0 * unit);
      const b = base.clone().addScaledVector(right, x1 * unit).addScaledVector(UP, y1 * unit);
      const d = V(0, 0, 0).subVectors(b, a).normalize().multiplyScalar(stroke * 0.45);
      parts.push(beam(a.sub(d), b.add(d), stroke, depth, normal).toNonIndexed());
    }
  });
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------- the build

const SPIRE = { y0: 2.25, y1: 26.0, rB: 1.25, rT: 0.36 };
const spireR = y => SPIRE.rB + (SPIRE.rT - SPIRE.rB) * (y - SPIRE.y0) / (SPIRE.y1 - SPIRE.y0);
const DECK = { cz: 3.75, R: 3.55, y0: 3.8, y1: 4.2 };
const SHIP_SCALE = 1.45;
export const SHIP_REST = { position: [0, 5.12, 3.95], yaw: 0.32 };
export const RINGS = [
  { name: 'RingA', y: 14.2, r: 4.8, tilt: 0.12, phase: 0.3 },
  { name: 'RingB', y: 17.9, r: 3.7, tilt: -0.19, phase: 1.4 },
  { name: 'RingC', y: 21.1, r: 2.7, tilt: 0.26, phase: 2.6 },
];

/** All parts for a detail level d (0 full, 1 lighter, 2 silhouette). */
function buildParts(d) {
  const parts = [];
  const add = (geom, mat, node = 'Static', opts = {}) => parts.push({ geom: prep(geom, opts), mat, node });
  const seg = (...v) => v[d];

  // Plinth: two lifted hex tiers (top surfaces well above the street plane).
  add(hexPrism(7.55, 0, 0.6), 'Body', 'Static', { flat: true });
  add(hexPrism(6.85, 0.6, 0.95), 'Body', 'Static', { flat: true });
  if (d < 2) {
    add(hexOutline(7.43, 0.615, 0.07, 0.03), 'Neon');
    add(hexOutline(6.45, 0.965, 0.08, 0.03), 'Neon');
    add(new THREE.TorusGeometry(2.35, 0.05, 4, seg(64, 32)).rotateX(Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.96, 0), 'Neon');
  }
  if (d === 0) {
    // Radial inlay spokes toward the plinth corners, bollard lights and street lettering.
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      add(beam(polar(2.55, a, 0.965), polar(6.2, a, 0.965), 0.06, 0.025, UP), 'Hull');
      add(hexPrism(0.1, 0.95, 1.22, { cx: polar(6.62, a, 0).x, cz: polar(6.62, a, 0).z }), 'Accent', 'Static', { flat: true });
    }
    const apothem = 7.55 * Math.cos(Math.PI / 6);
    add(lettering('X-PLORATOR', V(0, 0.13, apothem), V(1, 0, 0), V(0, 0, 1), 0.36, 0.055, 0.05), 'Neon');
    add(lettering('X-PLORATOR', V(0, 0.13, -apothem), V(-1, 0, 0), V(0, 0, -1), 0.36, 0.055, 0.05), 'Neon');
  }

  // Spire: collar, tapered indigo hex shaft, white crown, needle and beacon.
  add(hexPrism(1.8, 0.95, 1.9), 'Body', 'Static', { flat: true });
  add(hexPrism(1.45, 1.9, SPIRE.y0), 'Hull', 'Static', { flat: true, uvScale: 1.2 });
  add(taperPrism(SPIRE.rB, SPIRE.rT, SPIRE.y0, SPIRE.y1), 'Body', 'Static', { flat: true });
  add(hexPrism(0.62, SPIRE.y1, SPIRE.y1 + 0.5), 'Hull', 'Static', { flat: true, uvScale: 1.2 });
  add(taperPrism(0.18, 0.0, SPIRE.y1 + 0.5, 29.2, 6), 'Body', 'Static', { flat: true });
  add(new THREE.IcosahedronGeometry(0.2, d === 2 ? 0 : 1).translate(0, 29.36, 0), 'Accent', 'Static', { flat: true });
  if (d < 2) {
    add(hexOutline(1.83, 1.9, 0.07, 0.05), 'Accent');
    add(hexOutline(0.65, SPIRE.y1 + 0.25, 0.06, 0.05), 'Neon');
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      const p0 = polar(SPIRE.rB, a, SPIRE.y0 + 0.05), p1 = polar(SPIRE.rT, a, SPIRE.y1 - 0.05);
      if (k % 2 === 0) add(beam(p0, p1, 0.08, 0.06, radial(a)), 'Neon');
      else if (d === 0) add(beam(p0, p1, 0.035, 0.04, radial(a)), 'Hull');
    }
    for (const y of [6.6, 11.2]) add(hexOutline(spireR(y) + 0.02, y, 0.07, 0.045), 'Neon');
  }

  // Docking deck cantilevered toward the +Z street, with an under-cone, column and brace.
  add(hexPrism(DECK.R, DECK.y0, DECK.y1, { cz: DECK.cz }), 'Body', 'Static', { flat: true });
  add(hexOutline(DECK.R - 0.04, DECK.y1 - 0.045, 0.17, 0.11, { cz: DECK.cz }), 'Hull', 'Static', { uvScale: 1.5 });
  add(taperPrism(0.8, DECK.R, 2.7, DECK.y0, 6, { cz: DECK.cz }), 'Body', 'Static', { flat: true });
  if (d < 2) {
    add(hexPrism(0.32, 0.95, 2.7, { cz: DECK.cz }), 'Body', 'Static', { flat: true });
    add(beam(V(0, 2.1, 1.25), V(0, 2.85, DECK.cz - 0.3), 0.55, 0.35, V(0, 1, -0.4).normalize()), 'Body', 'Static', { flat: true });
    add(hexOutline(DECK.R - 0.6, DECK.y1 + 0.015, 0.08, 0.03, { cz: DECK.cz }), 'Neon');
    add(beam(V(0, 1.0, DECK.cz + 0.33), V(0, 2.65, DECK.cz + 0.33), 0.06, 0.04, V(0, 0, 1)), 'Neon');
  }
  if (d === 0) {
    for (let k = 0; k < 6; k++) {
      const p = polar(DECK.R - 0.08, Math.PI / 6 + k * Math.PI / 3, DECK.y1 + 0.04).add(V(0, 0, DECK.cz));
      add(new THREE.BoxGeometry(0.14, 0.08, 0.14).translate(p.x, p.y, p.z), 'Accent', 'Static', { flat: true });
    }
    // Landing chevrons and the two cradle posts under the ship.
    for (const s of [-1, 1]) {
      add(beam(V(0.0, DECK.y1 + 0.012, DECK.cz + 1.75), V(s * 0.75, DECK.y1 + 0.012, DECK.cz + 1.15), 0.09, 0.02, UP), 'Hull');
      add(beam(V(0.0, DECK.y1 + 0.012, DECK.cz + 2.15), V(s * 0.75, DECK.y1 + 0.012, DECK.cz + 1.55), 0.09, 0.02, UP), 'Hull');
      add(new THREE.CylinderGeometry(0.05, 0.08, 0.32, 8).translate(s * 0.55, DECK.y1 + 0.16, DECK.cz - 0.1), 'Hull');
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8).translate(s * 0.55, DECK.y1 + 0.34, DECK.cz - 0.1), 'Neon');
    }
  }

  // Two ogee arches from the back plinth corners up into the spire.
  for (const a of [Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const p0 = polar(5.35, a, 0.95), p1 = polar(5.75, a, 5.6), p2 = polar(2.7, a, 11.3), p3 = polar(spireR(12) - 0.05, a, 12.1);
    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    add(new THREE.TubeGeometry(curve, seg(56, 20, 8), 0.18, seg(8, 6, 4), false), 'Body');
    if (d < 2) {
      const pts = [];
      const tangential = V(Math.cos(a), 0, -Math.sin(a));
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, p = curve.getPoint(t), T = curve.getTangent(t);
        let out = V(0, 0, 0).crossVectors(T, tangential).normalize();
        if (out.dot(radial(a).add(UP)) < 0) out.negate();
        pts.push(p.addScaledVector(out, 0.17));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg(80, 28), 0.06, seg(6, 4), false), 'Neon');
      add(hexPrism(0.42, 0.95, 1.35, { cx: p0.x, cz: p0.z }), 'Body', 'Static', { flat: true });
      if (d === 0) add(hexOutline(0.44, 1.35, 0.05, 0.04, { cx: p0.x, cz: p0.z }), 'Accent');
    }
  }

  // X-in-hexagon emblem: two crossed plates so it reads from all four streets.
  const EMBLEM_Y = 23.4;
  for (const [right, normal] of [[V(1, 0, 0), V(0, 0, 1)], [V(0, 0, -1), V(1, 0, 0)]]) {
    const c = V(0, EMBLEM_Y, 0);
    const plate = new THREE.CylinderGeometry(1.56, 1.56, 0.08, 6).rotateX(Math.PI / 2);
    if (normal.x) plate.rotateY(Math.PI / 2);
    add(plate.translate(0, EMBLEM_Y, 0), 'Body', 'Static', { flat: true });
    if (d < 2) {
      add(hexOutlineVertical(c, 1.45, 0.12, 0.16, right, normal), 'Neon');
      const r0 = c.clone().addScaledVector(right, -0.6).addScaledVector(UP, -0.78);
      const r1 = c.clone().addScaledVector(right, 0.6).addScaledVector(UP, 0.78);
      const l0 = c.clone().addScaledVector(right, -0.6).addScaledVector(UP, 0.78);
      const l1 = c.clone().addScaledVector(right, 0.6).addScaledVector(UP, -0.78);
      add(beam(r0, r1, 0.17, 0.18, normal), 'Accent');
      add(beam(l0, l1, 0.17, 0.18, normal), 'Accent');
    }
  }

  // Floating orbital rings (each its own node, rotated about the spire axis by build.js).
  for (const ring of RINGS) {
    const tiltM = g => g.rotateY(ring.phase).rotateX(ring.tilt);
    if (d === 2) {
      add(tiltM(new THREE.TorusGeometry(ring.r, 0.12, 3, 22).rotateX(Math.PI / 2)), 'Neon', ring.name, { flat: true });
      continue;
    }
    add(tiltM(bandRing(ring.r, 0.09, 0.13, seg(160, 64))), 'Body', ring.name, { flat: d === 1 });
    add(tiltM(new THREE.TorusGeometry(ring.r + 0.11, 0.032, seg(6, 4), seg(200, 72)).rotateX(Math.PI / 2)), 'Neon', ring.name);
    if (d === 0) {
      for (let k = 0; k < 3; k++) {
        const p = polar(ring.r, k * TAU / 3, 0);
        add(tiltM(new THREE.OctahedronGeometry(0.2, 0).scale(1, 0.55, 1).translate(p.x, 0, p.z)), 'Body', ring.name, { flat: true });
      }
    }
  }

  // The ship: an original small white explorer, nose toward the street.
  for (const p of shipParts(d)) parts.push({ ...p, node: 'Ship' });
  return parts;
}

function shipParts(d) {
  const parts = [];
  const add = (geom, mat, opts = {}) => parts.push({ geom: prep(geom.scale(SHIP_SCALE, SHIP_SCALE, SHIP_SCALE), { uvScale: 1.4, ...opts }), mat });
  const sides = [10, 8, 4][d];
  add(loft([
    [-1.85, 0.30, 0.20, 0.0], [-1.40, 0.40, 0.27, 0.02], [-0.40, 0.42, 0.30, 0.04],
    [0.60, 0.33, 0.25, 0.03], [1.30, 0.19, 0.15, 0.0], [1.95, 0, 0, -0.02],
  ], sides), 'Hull', { flat: true });
  for (const s of [-1, 1]) {
    const wing = slab([[0.25 * s, 0.55], [1.62 * s, -0.85], [1.66 * s, -1.18], [0.3 * s, -1.35]], 0.07, -0.02);
    add(wing.rotateZ(-s * 0.07), 'Hull', { flat: true });
    if (d === 2) continue;
    add(new THREE.CylinderGeometry(0.17, 0.2, 1.45, [14, 8][d]).rotateX(Math.PI / 2).translate(s * 0.56, -0.02, -1.12), 'Hull');
    add(new THREE.CircleGeometry(0.15, 12).rotateY(Math.PI).translate(s * 0.56, -0.02, -1.86), 'Accent');
    add(beam(V(0.3 * s, 0.04, 0.48), V(1.58 * s, -0.06, -0.86), 0.05, 0.03, UP), 'Neon');
    if (d === 0) {
      add(new THREE.TorusGeometry(0.18, 0.025, 4, 16).translate(s * 0.56, -0.02, -0.39), 'Neon');
      add(fin([[-1.0, 0.0], [-0.72, 0.0], [-1.02, 0.34]], 0.04, s * 1.62 - 0.02), 'Hull', { flat: true });
      add(beam(V(0.41 * s, 0.06, -1.3), V(0.36 * s, 0.06, 0.45), 0.035, 0.03, V(s, 0, 0)), 'Neon');
      add(new THREE.BoxGeometry(0.06, 0.03, 0.22).rotateY(s * 0.5).translate(s * 0.12, 0.27, 1.0), 'Accent');
    }
  }
  if (d < 2) {
    add(new THREE.SphereGeometry(1, [18, 10][d], [10, 6][d]).scale(0.17, 0.11, 0.46).translate(0, 0.26, 0.42), 'Body');
    add(new THREE.CircleGeometry(0.17, 12).rotateY(Math.PI).translate(0, 0.03, -1.86), 'Accent');
    add(fin([[-1.82, 0.16], [-1.28, 0.2], [-1.72, 0.58]], 0.05, -0.025), 'Hull', { flat: true });
  }
  return parts;
}

// ---------------------------------------------------------------- textures

function makeTextures() {
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const body = paint(512, 512, (x, y) => {
    const cell = hash(x >> 6, y >> 6) * 0.12 - 0.06;
    const seam = (x % 256 < 2 || y % 128 < 2) ? 1 : 0;
    const grain = (hash(x, y) - 0.5) * 0.04;
    const k = 1 + cell + grain;
    return [Math.min(255, 17 * k + seam * 9), Math.min(255, 28 * k + seam * 13), Math.min(255, 68 * k + seam * 24)];
  });
  const hull = paint(256, 256, (x, y) => {
    const cell = hash(x >> 5, y >> 5) * 0.05;
    const seam = (x % 64 === 0 || y % 64 === 0) ? 0.14 : 0;
    const k = 1 - cell - seam;
    return [232 * k, 240 * k, 250 * k];
  });
  const white = paint(16, 16, () => [255, 255, 255]);
  // LOD2 atlas: 4 × 4 swatches of 64 px (sampled at swatch centres).
  const swatchOrder = ['Body', 'Hull', 'Neon', 'Accent', 'Glass'];
  const toSrgb = c => c.map(v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
  const atlas = paint(256, 256, (x, y) => {
    const i = (y >> 6) * 4 + (x >> 6);
    return toSrgb(COLOR[swatchOrder[i] ?? 'Body']);
  });
  const swatchUV = name => { const i = Math.max(0, swatchOrder.indexOf(name)); return [((i % 4) + 0.5) / 4, ((i >> 2) + 0.5) / 4]; };
  return { body, hull, white, atlas, swatchUV };
}

// ---------------------------------------------------------------- export

function merged(geoms, { color, uvPoint } = {}) {
  const list = geoms.map(g => {
    const c = g.clone();
    if (color) {
      const arr = new Float32Array(c.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) arr.set(color, i);
      c.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (uvPoint) {
      const arr = new Float32Array(c.attributes.position.count * 2);
      for (let i = 0; i < arr.length; i += 2) arr.set(uvPoint, i);
      c.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
    }
    return c;
  });
  return mergeVertices(mergeGeometries(list), 1e-5);
}

function bakeNode(geom, node) {
  const g = geom.clone();
  if (node === 'Ship') {
    g.applyMatrix4(new THREE.Matrix4().compose(V(...SHIP_REST.position), new THREE.Quaternion().setFromAxisAngle(UP, SHIP_REST.yaw), V(1, 1, 1)));
  }
  const ring = RINGS.find(r => r.name === node);
  if (ring) g.translate(0, ring.y, 0);
  return g;
}

function nodeTransform(node) {
  if (node === 'Ship') return { t: SHIP_REST.position, r: new THREE.Quaternion().setFromAxisAngle(UP, SHIP_REST.yaw).toArray() };
  const ring = RINGS.find(r => r.name === node);
  if (ring) return { t: [0, ring.y, 0], r: [0, 0, 0, 1] };
  return { t: [0, 0, 0], r: [0, 0, 0, 1] };
}

function createMaterials(doc, tex, set) {
  const texture = (name, bytes) => doc.createTexture(name).setImage(bytes).setMimeType('image/png');
  const m = {};
  if (set.includes('Body')) m.Body = doc.createMaterial('Body').setMetallicFactor(0.55).setRoughnessFactor(0.48);
  if (set.includes('Hull')) m.Hull = doc.createMaterial('Hull').setMetallicFactor(0.12).setRoughnessFactor(0.32);
  if (set.includes('Neon')) m.Neon = doc.createMaterial('Neon').setBaseColorFactor([0.02, 0.03, 0.06, 1])
    .setEmissiveFactor(COLOR.Neon).setMetallicFactor(0).setRoughnessFactor(0.6);
  if (set.includes('Accent')) m.Accent = doc.createMaterial('Accent').setBaseColorFactor([...COLOR.Accent, 1])
    .setEmissiveFactor([1.0, 0.56, 0.2]).setMetallicFactor(0.6).setRoughnessFactor(0.28);
  return { m, texture };
}

function primitive(doc, buffer, geom, material) {
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(new Float32Array(geom.attributes.position.array), 'VEC3'))
    .setAttribute('NORMAL', acc(new Float32Array(geom.attributes.normal.array), 'VEC3'))
    .setMaterial(material);
  if (geom.attributes.uv) prim.setAttribute('TEXCOORD_0', acc(new Float32Array(geom.attributes.uv.array), 'VEC2'));
  if (geom.attributes.color) prim.setAttribute('COLOR_0', acc(new Float32Array(geom.attributes.color.array), 'VEC3'));
  const idx = geom.index.array;
  const max = idx.reduce((a, b) => Math.max(a, b), 0);
  prim.setIndices(acc(max > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 'SCALAR'));
  return prim;
}

function newDoc(name) {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'THE X-PLORATOR lot builder (three r186 + glTF-Transform)';
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  doc.getRoot().setDefaultScene(scene);
  return { doc, buffer, scene };
}

const stats = {};
function record(lod, geomsByPrim, doc) {
  let triangles = 0;
  for (const g of geomsByPrim) triangles += g.index.count / 3;
  const box = new THREE.Box3();
  for (const g of geomsByPrim) { g.computeBoundingBox(); box.union(g.boundingBox); }
  stats[lod] = { triangles, drawCalls: geomsByPrim.length, materials: doc.getRoot().listMaterials().length, textures: doc.getRoot().listTextures().length };
  return box;
}

function checkBounds(label, box, extraRadius = 0) {
  const hw = LOT.width / 2 - MARGIN, hd = LOT.depth / 2 - MARGIN;
  const ok = box.min.x >= -hw && box.max.x <= hw && box.min.z >= -hd && box.max.z <= hd && box.min.y >= -1e-4 && box.max.y <= LOT.height - MARGIN && extraRadius <= Math.min(hw, hd);
  if (!ok) throw new Error(`${label} leaves the lot box: ${JSON.stringify({ min: box.min, max: box.max, extraRadius })}`);
}

async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const io = new NodeIO();
  const tex = makeTextures();

  // LOD0: named nodes (Static, Ship, RingA-C), four materials, one primitive per node × material.
  {
    const { doc, buffer, scene } = newDoc('XPloratorBeacon');
    const { m, texture } = createMaterials(doc, tex, ['Body', 'Hull', 'Neon', 'Accent']);
    m.Body.setBaseColorTexture(texture('BodyPanels', tex.body));
    m.Hull.setBaseColorTexture(texture('HullPanels', tex.hull));
    const white = texture('White', tex.white);
    m.Neon.setBaseColorTexture(white);
    m.Accent.setBaseColorTexture(white);
    const parts = buildParts(0);
    const nodes = ['Static', 'Ship', ...RINGS.map(r => r.name)];
    const all = [];
    const worldBox = new THREE.Box3();
    let ringReach = 0;
    for (const node of nodes) {
      const mesh = doc.createMesh(`${node}Mesh`);
      for (const mat of ['Body', 'Hull', 'Neon', 'Accent']) {
        const geoms = parts.filter(p => p.node === node && p.mat === mat).map(p => p.geom);
        if (!geoms.length) continue;
        const g = merged(geoms);
        mesh.addPrimitive(primitive(doc, buffer, g, m[mat]));
        all.push(g);
        const baked = bakeNode(g, node);
        baked.computeBoundingBox();
        worldBox.union(baked.boundingBox);
        if (RINGS.some(r => r.name === node)) {
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) ringReach = Math.max(ringReach, Math.hypot(p.getX(i), p.getZ(i)));
        }
      }
      const { t, r } = nodeTransform(node);
      scene.addChild(doc.createNode(node).setMesh(mesh).setTranslation(t).setRotation(r));
    }
    record('lod0', all, doc);
    checkBounds('LOD0', worldBox, ringReach);
    // The ship bobs ±0.14 m in build.js; keep headroom in the check.
    stats.lod0.bounds = { min: worldBox.min.toArray().map(v => +v.toFixed(3)), max: worldBox.max.toArray().map(v => +v.toFixed(3)), ringReach: +ringReach.toFixed(3) };
    fs.writeFileSync(path.join(OUT, 'lod0.glb'), await io.writeBinary(doc));
  }

  // LOD1: static, two materials (vertex-coloured Body + Neon, names shared with LOD0).
  {
    const { doc, buffer, scene } = newDoc('XPloratorBeaconLOD1');
    const { m } = createMaterials(doc, tex, ['Body', 'Neon']);
    const parts = buildParts(1);
    const bodyGeoms = [], neonGeoms = [];
    for (const p of parts) {
      const g = bakeNode(p.geom, p.node);
      if (p.mat === 'Neon') neonGeoms.push(g);
      else bodyGeoms.push({ g, color: COLOR[p.mat] });
    }
    const body = mergeVertices(mergeGeometries(bodyGeoms.map(({ g, color }) => merged([g], { color }).toNonIndexed())), 1e-5);
    body.deleteAttribute('uv');
    const neon = merged(neonGeoms);
    neon.deleteAttribute('uv');
    const mesh = doc.createMesh('BeaconLOD1');
    mesh.addPrimitive(primitive(doc, buffer, body, m.Body));
    mesh.addPrimitive(primitive(doc, buffer, neon, m.Neon));
    scene.addChild(doc.createNode('Static').setMesh(mesh));
    const box = record('lod1', [body, neon], doc);
    checkBounds('LOD1', box);
    fs.writeFileSync(path.join(OUT, 'lod1.glb'), await io.writeBinary(doc));
  }

  // LOD2: exactly one mesh, one material, one 256 px swatch texture.
  {
    const { doc, buffer, scene } = newDoc('XPloratorBeaconLOD2');
    const atlasTex = doc.createTexture('Swatches').setImage(tex.atlas).setMimeType('image/png');
    const mat = doc.createMaterial('Body').setBaseColorTexture(atlasTex).setMetallicFactor(0.3).setRoughnessFactor(0.55);
    const parts = buildParts(2);
    const geoms = parts.map(p => merged([bakeNode(p.geom, p.node)], { uvPoint: tex.swatchUV(p.mat) }).toNonIndexed());
    const g = mergeVertices(mergeGeometries(geoms), 1e-5);
    const mesh = doc.createMesh('BeaconLOD2');
    mesh.addPrimitive(primitive(doc, buffer, g, mat));
    scene.addChild(doc.createNode('Static').setMesh(mesh));
    const box = record('lod2', [g], doc);
    checkBounds('LOD2', box);
    fs.writeFileSync(path.join(OUT, 'lod2.glb'), await io.writeBinary(doc));
  }

  // Live-build files: lot.json, shaders, script, publish manifest.
  for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));
  for (const lod of ['lod0', 'lod1', 'lod2']) stats[lod].fileBytes = fs.statSync(path.join(OUT, `${lod}.glb`)).size;
  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
}

await build();
