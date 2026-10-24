import * as THREE from 'three';
import { GLSL_NOISE } from './glsl.js';

/** Small luminous effects: engine glows, ribbon contrails, dust, stars, rays. */

// ---------------------------------------------------------------- engine glow
const GLOW_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 2.0, 220.0);
  gl_Position = projectionMatrix * mv;
}
`;
const GLOW_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float core = exp(-r * r * 18.0);
  float halo = exp(-r * r * 3.5) * 0.45;
  float a = (core + halo) * smoothstep(1.0, 0.7, r);
  vec3 col = mix(vColor, vec3(1.0, 0.96, 0.9), core * 0.7) * a;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createGlowPoints(count) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 } },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  let used = 0;
  return {
    object: points,
    material,
    begin() { used = 0; },
    add(position, size, color) {
      if (used >= count) return;
      geometry.attributes.position.setXYZ(used, position.x, position.y, position.z);
      geometry.attributes.aSize.setX(used, size);
      geometry.attributes.aColor.setXYZ(used, color[0], color[1], color[2]);
      used++;
    },
    end() {
      geometry.setDrawRange(0, used);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aColor.needsUpdate = true;
    },
    setViewportHeight(px) { material.uniforms.uScale.value = px * 0.9; },
  };
}

// --------------------------------------------------------------------- trails
const TRAIL_VERTEX = /* glsl */ `
attribute float aAge;
attribute float aSide;
attribute float aStrength;
varying float vAge;
varying float vSide;
varying float vStrength;
void main() {
  vAge = aAge; vSide = aSide; vStrength = aStrength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const TRAIL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
varying float vAge;
varying float vSide;
varying float vStrength;
void main() {
  float across = 1.0 - vSide * vSide;
  float fade = pow(1.0 - vAge, 1.6) * smoothstep(0.0, 0.04, vAge + 0.02);
  float a = across * fade * vStrength;
  vec3 col = mix(uColor, uCore, pow(across, 6.0) * (1.0 - vAge)) * a;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Camera-facing ribbon contrails for several emitters in one draw call.
 * Points are stored in world space and age out after `lifetime` seconds.
 */
export function createTrails({ emitters, points = 96, lifetime = 3.2, color = '#70E2F4' }) {
  const vertsPer = points * 2;
  const total = emitters.length * vertsPer;
  const position = new Float32Array(total * 3);
  const age = new Float32Array(total);
  const side = new Float32Array(total);
  const strength = new Float32Array(total);
  const index = [];
  for (let e = 0; e < emitters.length; e++) {
    for (let i = 0; i < points - 1; i++) {
      const a = e * vertsPer + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    for (let i = 0; i < points; i++) {
      side[e * vertsPer + i * 2] = -1;
      side[e * vertsPer + i * 2 + 1] = 1;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAge', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geometry.setAttribute('aStrength', new THREE.BufferAttribute(strength, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERTEX,
    fragmentShader: TRAIL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color('#E6F6FD') } },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  const history = emitters.map(() => []); // [{p: Vector3, t}]
  const tmp = new THREE.Vector3(), tangent = new THREE.Vector3(), toCam = new THREE.Vector3(), sideV = new THREE.Vector3();
  let clock = 0;

  function reset() { for (const h of history) h.length = 0; }

  function update(dt, emitterPositions, cameraPosition, intensity = 1) {
    clock += dt;
    for (let e = 0; e < emitters.length; e++) {
      const h = history[e];
      const p = emitterPositions[e];
      const spec = emitters[e];
      // A fresh head sample every ~30 ms (or after a jump in position).
      if (!h.length || clock - h[0].t > 0.03 || h[0].p.distanceToSquared(p) > 0.5) {
        h.unshift({ p: p.clone(), t: clock, s: intensity });
        if (h.length > points) h.pop();
      } else {
        h[0].p.copy(p);
        h[0].s = intensity;
      }
      while (h.length && clock - h[h.length - 1].t > lifetime) h.pop();
      const base = e * vertsPer;
      for (let i = 0; i < points; i++) {
        const v = base + i * 2;
        if (i >= h.length) {
          strength[v] = strength[v + 1] = 0;
          const last = h.length ? h[h.length - 1].p : p;
          position.set([last.x, last.y, last.z], v * 3);
          position.set([last.x, last.y, last.z], v * 3 + 3);
          continue;
        }
        const node = h[i];
        const prev = h[Math.max(0, i - 1)].p, next = h[Math.min(h.length - 1, i + 1)].p;
        tangent.subVectors(prev, next);
        if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1);
        toCam.subVectors(cameraPosition, node.p);
        sideV.crossVectors(tangent, toCam).normalize();
        const a = Math.min(1, (clock - node.t) / lifetime);
        const width = spec.width * (0.35 + 1.4 * Math.pow(a, 0.6));
        tmp.copy(node.p).addScaledVector(sideV, -width);
        position.set([tmp.x, tmp.y, tmp.z], v * 3);
        tmp.copy(node.p).addScaledVector(sideV, width);
        position.set([tmp.x, tmp.y, tmp.z], v * 3 + 3);
        age[v] = age[v + 1] = a;
        strength[v] = strength[v + 1] = spec.strength * node.s;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAge.needsUpdate = true;
    geometry.attributes.aStrength.needsUpdate = true;
  }

  return { object: mesh, update, reset };
}

// ----------------------------------------------------------------------- dust
const DUST_VERTEX = /* glsl */ `
uniform vec3 uCamWorld;
uniform vec3 uAnchor;
uniform float uBox;
uniform float uScale;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 rel = mod(position - uCamWorld + uBox * 0.5, uBox) - uBox * 0.5;
  float d = length(rel);
  vAlpha = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d)) * smoothstep(1.5, 5.0, d) * (0.4 + 0.6 * aSeed);
  vec4 mv = viewMatrix * vec4(uAnchor + rel, 1.0);
  gl_PointSize = clamp(uScale * (0.6 + aSeed) / -mv.z, 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
}
`;
const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, r) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createDust({ count = 400, box = 180, seed = 7 }) {
  let s = seed;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([rand() * box, rand() * box, rand() * box], i * 3);
    seeds[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCamWorld: { value: new THREE.Vector3() },
      uAnchor: { value: new THREE.Vector3() },
      uBox: { value: box },
      uScale: { value: 300 },
      uColor: { value: new THREE.Color('#9fc4ff') },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    object: points,
    update(camWorld, anchor, viewportHeight) {
      material.uniforms.uCamWorld.value.copy(camWorld);
      material.uniforms.uAnchor.value.copy(anchor);
      material.uniforms.uScale.value = viewportHeight * 0.55;
    },
  };
}

// ---------------------------------------------------------------------- stars
const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
varying vec3 vColor;
void main() {
  float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 31.0);
  vColor = aColor * tw;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixel;
  gl_Position = projectionMatrix * mv;
}
`;
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 5.0) * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(vColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Crisp star specks on a far sphere that follows the camera (no parallax). */
export function createStars({ count = 2400, radius = 40000, seed = 11 }) {
  let s = seed;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3), size = new Float32Array(count), color = new Float32Array(count * 3), phase = new Float32Array(count);
  const tints = [[1, 1, 1], [0.7, 0.9, 1.0], [0.85, 0.75, 1.0], [1.0, 0.92, 0.85]];
  for (let i = 0; i < count; i++) {
    // Denser band across the sky, plus a uniform scatter.
    let x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
    if (i % 3 === 0) y *= 0.25;
    const l = Math.hypot(x, y, z) || 1;
    const band = new THREE.Vector3(x / l, y / l, z / l).applyAxisAngle(new THREE.Vector3(0.3, 0, 1).normalize(), 0.6);
    pos.set([band.x * radius, band.y * radius, band.z * radius], i * 3);
    const bright = Math.pow(rand(), 6);
    size[i] = 1.2 + bright * 3.4;
    const t = tints[Math.floor(rand() * tints.length)];
    const k = 0.35 + bright * 1.6;
    color.set([t[0] * k, t[1] * k, t[2] * k], i * 3);
    phase[i] = rand();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -10;
  return {
    object: points,
    update(time, pixelRatio) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPixel.value = pixelRatio;
    },
  };
}

// ----------------------------------------------------------------------- rays
const RAYS_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const RAYS_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform vec2 uBias;
varying vec2 vUv;
${GLSL_NOISE}
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  float streaks = xpFbm(vec3(cos(ang) * 6.0, sin(ang) * 6.0, uTime * 0.02));
  streaks = pow(smoothstep(0.35, 0.85, streaks), 1.6);
  float fine = 0.5 + 0.5 * sin(ang * 70.0 + xpNoise(vec3(ang * 4.0, uTime * 0.05, 0.0)) * 6.0);
  float dirBias = 0.35 + 0.65 * smoothstep(-0.6, 0.9, dot(normalize(vUv + 1e-5), uBias));
  float fall = exp(-r * 2.1) * smoothstep(1.0, 0.5, r);
  float a = (streaks * 0.85 + fine * streaks * 0.3) * fall * dirBias * uIntensity;
  a += exp(-r * 7.0) * 0.6 * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** God-ray fan placed just behind a planet's sunward limb; the planet occludes its centre. */
export function createRays({ size, color = '#8fdcff', intensity = 0.55, bias = [-0.6, 0.8] }) {
  const material = new THREE.ShaderMaterial({
    vertexShader: RAYS_VERTEX,
    fragmentShader: RAYS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    defines: { XP_OCTAVES: 3 },
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uBias: { value: new THREE.Vector2(...bias).normalize() },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  return {
    object: mesh,
    update(time, camera) {
      material.uniforms.uTime.value = time;
      mesh.quaternion.copy(camera.quaternion);
    },
  };
}
