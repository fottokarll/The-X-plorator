import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../game/sector.js';

/**
 * Faceted low-poly asteroids (instanced, four shapes), resource nodes with
 * glowing Cryon crystal clusters or gold Ferrite veins, and far debris.
 * IMG 07 reads rocks as dark navy silhouettes with a thin cool rim.
 */

function rockGeometry(seed, detail = 1, roughness = 0.32, veins = 0) {
  const rand = rng(seed);
  const base = new THREE.IcosahedronGeometry(1, detail);
  // Displace shared vertices consistently (merge, displace, then flatten).
  const pos = base.attributes.position;
  const offsets = new Map();
  const dirs = Array.from({ length: 5 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!offsets.has(key)) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      let d = 1 + (rand() - 0.5) * roughness;
      for (const dir of dirs) d += Math.max(0, v.dot(dir)) * 0.16 * (rand() - 0.2);
      offsets.set(key, d);
    }
    const d = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * d, pos.getY(i) * d * 0.82, pos.getZ(i) * d);
  }
  const g = base.index ? base.toNonIndexed() : base;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  // Per-face colour variation and optional glowing ore veins.
  const count = g.attributes.position.count;
  const color = new Float32Array(count * 3), glow = new Float32Array(count);
  for (let f = 0; f < count; f += 3) {
    const shade = 0.8 + rand() * 0.35;
    const vein = veins > 0 && rand() < veins;
    for (let k = 0; k < 3; k++) {
      color.set(vein ? [0.95, 0.66, 0.36] : [shade, shade, shade * 1.04], (f + k) * 3);
      glow[f + k] = vein ? 1 : 0;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  return g;
}

let rockMaterial = null;
export function asteroidMaterial() {
  if (rockMaterial) return rockMaterial;
  rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c2550, vertexColors: true, roughness: 0.92, metalness: 0.04, flatShading: true, envMapIntensity: 0.35,
  });
  rockMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float xpRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
      totalEmissiveRadiance += vec3(0.3, 0.42, 0.95) * xpRim * 0.22;
      totalEmissiveRadiance += vec3(1.0, 0.58, 0.22) * vGlow * 1.6;`);
  };
  rockMaterial.customProgramCacheKey = () => 'xp-rock-rim';
  return rockMaterial;
}

let crystalMaterial = null;
export function crystalMat() {
  if (crystalMaterial) return crystalMaterial;
  crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0x8beeff, emissive: 0x29b9e8, emissiveIntensity: 1.5, roughness: 0.18, metalness: 0.1, flatShading: true,
  });
  crystalMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float xpRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.0);
      totalEmissiveRadiance += vec3(0.75, 0.97, 1.0) * xpRim * 1.4;`);
  };
  crystalMaterial.customProgramCacheKey = () => 'xp-crystal';
  return crystalMaterial;
}

function crystalShard() {
  const body = new THREE.CylinderGeometry(0.22, 0.26, 1.2, 6, 1);
  body.translate(0, 0.6, 0);
  const tip = new THREE.ConeGeometry(0.22, 0.55, 6, 1);
  tip.translate(0, 1.2 + 0.275, 0);
  const g = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()]);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

const dummy = new THREE.Object3D();

export function createAsteroidField(layout, { detail = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'AsteroidField';
  const material = asteroidMaterial();
  const variants = [0, 1, 2, 3].map(i => rockGeometry(901 + i * 77, detail, 0.34));
  const oreGeometry = rockGeometry(4242, detail, 0.3, 0.16);

  // Bodies that tumble: field rocks + node host rocks + debris.
  const bodies = [];
  const meshes = variants.map((geometry, v) => {
    const members = [...layout.rocks, ...layout.debris].filter(r => r.variant === v);
    const mesh = new THREE.InstancedMesh(geometry, material, members.length);
    const r = rng(77 + v);
    members.forEach((rock, i) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
      const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      bodies.push({ mesh, index: i, position: new THREE.Vector3(...rock.position), radius: rock.radius, q, axis, spin: rock.spin });
      const tint = 0.75 + rock.seed * 0.5;
      mesh.setColorAt(i, new THREE.Color(0.55 * tint, 0.62 * tint, 0.95 * tint));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });

  // Resource nodes: host rocks (crystal hosts use the plain shapes).
  const crystalNodes = layout.nodes.filter(n => n.type === 'crystal');
  const oreNodes = layout.nodes.filter(n => n.type === 'ore');
  const hostMesh = new THREE.InstancedMesh(variants[1], material, crystalNodes.length);
  const oreMesh = new THREE.InstancedMesh(oreGeometry, material, oreNodes.length);
  hostMesh.frustumCulled = oreMesh.frustumCulled = false;
  group.add(hostMesh, oreMesh);
  const nodeState = new Map();
  crystalNodes.forEach((n, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 1.3, i * 0.7, 0.4));
    bodies.push({ mesh: hostMesh, index: i, position: new THREE.Vector3(...n.position), radius: n.radius, q, axis: new THREE.Vector3(0, 1, 0), spin: 0.03 });
    hostMesh.setColorAt(i, new THREE.Color(0.7, 0.78, 1.15));
  });
  oreNodes.forEach((n, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.9, i * 1.1, 0.2));
    bodies.push({ mesh: oreMesh, index: i, position: new THREE.Vector3(...n.position), radius: n.radius, q, axis: new THREE.Vector3(0.3, 1, 0).normalize(), spin: 0.035 });
    oreMesh.setColorAt(i, new THREE.Color(0.75, 0.75, 1.05));
    nodeState.set(n.id, { node: n, amount: 1 });
  });
  if (hostMesh.instanceColor) hostMesh.instanceColor.needsUpdate = true;
  if (oreMesh.instanceColor) oreMesh.instanceColor.needsUpdate = true;

  // Crystal clusters: one instanced draw for every shard in the sector.
  const shardGeometry = crystalShard();
  const shards = [];
  const r = rng(3131);
  for (const n of crystalNodes) {
    const count = 7 + Math.floor(r() * 4);
    const list = [];
    for (let k = 0; k < count; k++) {
      // Shards sprout from the upper hemisphere of the host rock.
      const dir = new THREE.Vector3(r() - 0.5, 0.35 + r() * 0.8, r() - 0.5).normalize();
      const height = n.size * (0.35 + r() * 0.55);
      list.push({ dir, height, width: n.size * (0.18 + r() * 0.14), twist: r() * 6.28 });
    }
    shards.push({ node: n, list });
    nodeState.set(n.id, { node: n, amount: 1 });
  }
  const shardCount = shards.reduce((m, s) => m + s.list.length, 0);
  const shardMesh = new THREE.InstancedMesh(shardGeometry, crystalMat(), shardCount);
  shardMesh.frustumCulled = false;
  group.add(shardMesh);

  const up = new THREE.Vector3(0, 1, 0);
  function placeShards() {
    let i = 0;
    for (const s of shards) {
      const amount = nodeState.get(s.node.id).amount;
      const base = new THREE.Vector3(...s.node.position);
      for (const sh of s.list) {
        const scale = Math.max(0.0001, 0.25 + 0.75 * amount);
        dummy.position.copy(base).addScaledVector(sh.dir, s.node.size * 0.62);
        dummy.quaternion.setFromUnitVectors(up, sh.dir);
        dummy.rotateY(sh.twist);
        dummy.scale.set(sh.width, sh.height * scale, sh.width);
        dummy.updateMatrix();
        shardMesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    shardMesh.instanceMatrix.needsUpdate = true;
  }
  placeShards();

  const tmpQ = new THREE.Quaternion();
  let accum = 0;
  return {
    group,
    bodies,
    nodeState,
    // Rotation is gentle; 30 Hz updates are visually identical and cheaper.
    update(dt) {
      accum += dt;
      if (accum < 1 / 30) return;
      const step = accum;
      accum = 0;
      for (const b of bodies) {
        tmpQ.setFromAxisAngle(b.axis, b.spin * step);
        b.q.premultiply(tmpQ);
        dummy.position.copy(b.position);
        dummy.quaternion.copy(b.q);
        dummy.scale.setScalar(b.radius);
        dummy.updateMatrix();
        b.mesh.setMatrixAt(b.index, dummy.matrix);
      }
      for (const m of [...meshes, hostMesh, oreMesh]) m.instanceMatrix.needsUpdate = true;
    },
    setNodeAmount(id, amount) {
      const s = nodeState.get(id);
      if (!s) return;
      s.amount = amount;
      if (s.node.type === 'crystal') placeShards();
      else {
        const i = oreNodes.indexOf(s.node);
        oreMesh.setColorAt(i, new THREE.Color(0.75, 0.75, 1.05).multiplyScalar(0.55 + 0.45 * amount));
        oreMesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
