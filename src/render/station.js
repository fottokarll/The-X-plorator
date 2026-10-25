import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shipMaterials } from './ship-model.js';
import { hexToLocal, HEX_SIZE } from '../game/base.js';

/**
 * Haven Outpost: connected hexagonal orbital platforms (IMG 04 layout, IMG 07
 * colours). Reuses the ship's hull/glass/glow materials, so the station adds
 * no shader programs. Geometry is merged into three meshes and rebuilt only
 * when the base layout or its power state changes.
 */
const WHITE = [0.7, 0.74, 0.82], GREY = [0.36, 0.4, 0.5], DARK = [0.16, 0.18, 0.28];
const CYAN = [0.45 * 2.4, 0.89 * 2.4, 0.96 * 2.4], AMBER = [1.0 * 2.6, 0.62 * 2.6, 0.3 * 2.6];

function paint(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);

function tileGeometry(parts, x, z, ghost = false) {
  const s = HEX_SIZE;
  parts.hull.push(paint(at(cyl(s * 0.93, s * 0.86, 1.3, 6), x, 0, z), WHITE));
  parts.hull.push(paint(at(cyl(s * 0.8, s * 0.6, 1.6, 6), x, -1.4, z), GREY));
  // Luminous rim around the deck.
  const rim = new THREE.TorusGeometry(s * 0.9, 0.08, 4, 6);
  rim.rotateX(Math.PI / 2);
  rim.rotateY(Math.PI / 6);
  parts.glow.push(paint(at(rim, x, 0.68, z), ghost ? CYAN : [0.3, 0.75, 0.95]));
  // Under-thrusters (small amber disks).
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3) + 0.5;
    parts.glow.push(paint(at(cyl(0.45, 0.45, 0.1, 8), x + Math.cos(a) * s * 0.45, -2.25, z + Math.sin(a) * s * 0.45), AMBER));
  }
}

const MODULE_BUILDERS = {
  hub(parts, x, z, powered) {
    parts.hull.push(paint(at(cyl(4.2, 5.6, 3, 8), x, 2.1, z), WHITE));
    parts.hull.push(paint(at(cyl(2.6, 3.6, 6, 8), x, 6.6, z), WHITE));
    parts.hull.push(paint(at(cyl(1.4, 2.2, 7, 8), x, 13.1, z), WHITE));
    parts.hull.push(paint(at(cyl(0.25, 0.5, 9, 6), x, 21, z), GREY));
    const ring = new THREE.TorusGeometry(5.2, 0.35, 6, 24);
    ring.rotateX(Math.PI / 2);
    parts.hull.push(paint(at(ring, x, 7.5, z), GREY));
    parts.glow.push(paint(at(cyl(2.65, 2.65, 0.25, 16), x, 8.2, z), powered ? CYAN : [0.6, 0.4, 0.25]));
    parts.glow.push(paint(at(cyl(1.45, 1.45, 0.2, 16), x, 14.5, z), powered ? CYAN : [0.6, 0.4, 0.25]));
    parts.glow.push(paint(at(new THREE.OctahedronGeometry(0.7, 0), x, 25.8, z), powered ? AMBER : [0.5, 0.3, 0.15]));
    parts.glass.push(paint(at(cyl(4.25, 4.25, 0.7, 8), x, 3.4, z), WHITE));
  },
  dock(parts, x, z, powered) {
    parts.hull.push(paint(at(cyl(6.4, 6.8, 0.5, 6), x, 0.9, z), GREY));
    for (const r of [5.6, 3.4]) {
      const ring = new THREE.TorusGeometry(r, 0.12, 4, 32);
      ring.rotateX(Math.PI / 2);
      parts.glow.push(paint(at(ring, x, 1.2, z), powered ? CYAN : [0.35, 0.5, 0.65]));
    }
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + Math.PI / 6;
      parts.hull.push(paint(at(new THREE.BoxGeometry(0.4, 2.2, 0.4), x + Math.cos(a) * 6.6, 2, z + Math.sin(a) * 6.6), WHITE));
      parts.glow.push(paint(at(new THREE.BoxGeometry(0.5, 0.25, 0.5), x + Math.cos(a) * 6.6, 3.2, z + Math.sin(a) * 6.6), AMBER));
    }
  },
  solar(parts, x, z) {
    parts.hull.push(paint(at(cyl(0.5, 0.7, 7, 8), x, 4, z), GREY));
    parts.hull.push(paint(at(new THREE.BoxGeometry(14, 0.3, 0.6), x, 7.4, z), WHITE));
    for (const s of [-1, 1]) {
      const panel = new THREE.BoxGeometry(5.6, 0.18, 4.6);
      panel.rotateX(-0.35);
      parts.glass.push(paint(at(panel, x + s * 4.2, 7.6, z), WHITE));
      parts.glow.push(paint(at(new THREE.BoxGeometry(5.6, 0.05, 0.08), x + s * 4.2, 7.9, z + 0.9), [0.3, 0.6, 1.0]));
    }
  },
  storage(parts, x, z) {
    const r = [[-2.2, -1.6], [2.0, -1.8], [-1.6, 2.2], [2.2, 1.8], [0.2, 0.1]];
    r.forEach(([dx, dz], i) => {
      const h = i === 4 ? 5.2 : 3.2;
      parts.hull.push(paint(at(new THREE.BoxGeometry(3.4, h, 3.2), x + dx, 0.6 + h / 2, z + dz), i % 2 ? WHITE : [0.78, 0.82, 0.9]));
      parts.glow.push(paint(at(new THREE.BoxGeometry(3.45, 0.18, 0.1), x + dx, 0.9 + h * 0.75, z + dz + 1.62), AMBER));
    });
  },
  refinery(parts, x, z, powered) {
    for (const [dx, dz, h] of [[-2.4, -1.2, 5], [0.4, -2.6, 6], [2.6, 0.2, 4.6]]) {
      parts.hull.push(paint(at(cyl(1.5, 1.5, h, 10), x + dx, 0.6 + h / 2, z + dz), WHITE));
      parts.hull.push(paint(at(new THREE.SphereGeometry(1.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), x + dx, 0.6 + h, z + dz), WHITE));
      parts.glow.push(paint(at(cyl(1.52, 1.52, 0.2, 10), x + dx, 0.6 + h * 0.62, z + dz), powered ? AMBER : [0.5, 0.3, 0.15]));
    }
    parts.hull.push(paint(at(cyl(0.55, 0.8, 11, 8), x - 0.6, 6.1, z + 2.6), GREY));
    parts.glow.push(paint(at(cyl(0.58, 0.58, 0.3, 8), x - 0.6, 11.2, z + 2.6), powered ? CYAN : [0.3, 0.4, 0.5]));
  },
  scanner(parts, x, z) {
    parts.hull.push(paint(at(cyl(0.4, 0.9, 6, 8), x, 3.6, z), GREY));
    const dish = new THREE.ConeGeometry(3.2, 1.4, 16, 1, true);
    dish.rotateX(Math.PI * 0.8);
    parts.hull.push(paint(at(dish, x, 7.2, z), WHITE));
    parts.glow.push(paint(at(new THREE.OctahedronGeometry(0.4, 0), x, 7.8, z + 0.6), CYAN));
  },
};

export const MODULE_INFO = Object.freeze({
  hub: { label: 'Command Hub' },
  dock: { label: 'Dock' },
  solar: { label: 'Solar Array' },
  storage: { label: 'Storage' },
  refinery: { label: 'Refinery' },
  scanner: { label: 'Scanner Array' },
});

// The station's decks are large flat white surfaces facing the key light: with
// the ship's hull material they read as a clipped white glare. They keep the
// same look with a softer albedo and a fainter rim light.
let stationHull = null;
function stationHullMaterial() {
  if (stationHull) return stationHull;
  stationHull = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xc9d2df, roughness: 0.55, metalness: 0.18, flatShading: true });
  stationHull.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float xpRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(0.42, 0.78, 1.0) * xpRim * 0.22;`,
    );
  };
  stationHull.customProgramCacheKey = () => 'xp-station-rim';
  return stationHull;
}

export function createStation({ tiles, powered = false, position = [0, 0, 0] }) {
  const group = new THREE.Group();
  group.name = 'HavenOutpost';
  group.position.set(...position);
  const mats = { ...shipMaterials(), hull: stationHullMaterial() };
  const meshes = { hull: null, glass: null, glow: null };
  let dockLocal = new THREE.Vector3(0, 2, 0);

  function rebuild(nextTiles, nextPowered) {
    for (const m of Object.values(meshes)) if (m) { group.remove(m); m.geometry.dispose(); }
    const parts = { hull: [], glass: [], glow: [] };
    const occupied = new Set(nextTiles.map(t => `${t.q},${t.r}`));
    for (const t of nextTiles) {
      const [x, z] = hexToLocal(t.q, t.r);
      tileGeometry(parts, x, z);
      MODULE_BUILDERS[t.type]?.(parts, x, z, nextPowered);
      if (t.type === 'dock') dockLocal = new THREE.Vector3(x, 1.4, z);
      // Struts to neighbours with larger key (each pair once).
      for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1]]) {
        if (!occupied.has(`${t.q + dq},${t.r + dr}`)) continue;
        const [x2, z2] = hexToLocal(t.q + dq, t.r + dr);
        const length = Math.hypot(x2 - x, z2 - z) - HEX_SIZE * 1.5;
        const strut = new THREE.BoxGeometry(1.6, 0.9, Math.max(0.5, length + 1.2));
        strut.rotateY(Math.atan2(x2 - x, z2 - z));
        parts.hull.push(paint(at(strut, (x + x2) / 2, -0.2, (z + z2) / 2), GREY));
        const light = new THREE.BoxGeometry(0.3, 0.3, Math.max(0.4, length + 1.0));
        light.rotateY(Math.atan2(x2 - x, z2 - z));
        parts.glow.push(paint(at(light, (x + x2) / 2, 0.35, (z + z2) / 2), nextPowered ? CYAN : [0.3, 0.45, 0.6]));
      }
    }
    if (!parts.glass.length) parts.glass.push(paint(new THREE.BoxGeometry(0.01, 0.01, 0.01), DARK));
    meshes.hull = new THREE.Mesh(mergeGeometries(parts.hull), mats.hull);
    meshes.glass = new THREE.Mesh(mergeGeometries(parts.glass), mats.glass);
    meshes.glow = new THREE.Mesh(mergeGeometries(parts.glow), mats.glow);
    for (const list of Object.values(parts)) for (const g of list) g.dispose();
    group.add(meshes.hull, meshes.glass, meshes.glow);
  }
  rebuild(tiles, powered);

  return {
    group,
    rebuild,
    // World position of the docking pad centre (top surface).
    dockPoint(target = new THREE.Vector3()) {
      return target.copy(dockLocal).applyMatrix4(group.matrixWorld);
    },
    dockLocal: () => dockLocal.clone(),
  };
}

/** Translucent placement preview for the base builder. */
export function createGhostTile() {
  const geometry = new THREE.CylinderGeometry(HEX_SIZE * 0.93, HEX_SIZE * 0.86, 1.3, 6, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x70e2f4, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.9 }));
  mesh.add(edges);
  mesh.visible = false;
  return {
    object: mesh,
    set(x, z, valid) {
      mesh.position.set(x, 0, z);
      material.color.set(valid ? 0x70e2f4 : 0xe5718f);
      edges.material.color.set(valid ? 0x9ff0ff : 0xff9fb4);
      mesh.visible = true;
    },
    hide() { mesh.visible = false; },
  };
}
