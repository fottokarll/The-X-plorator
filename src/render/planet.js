import * as THREE from 'three';
import { GLSL_NOISE } from './glsl.js';

/**
 * Shader-painted planets in the IMG 07 grammar: painterly ocean/continent
 * masses, a soft terminator that keeps the night side deep blue (never black),
 * a luminous cyan limb on the lit edge, an additive atmosphere shell and an
 * optional glittering orbital ring. One program serves every planet; palettes
 * and seeds are uniforms, so extra planets cost no extra shader compiles.
 */
const SURFACE_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vLocal = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uDeep, uShallow, uLandA, uLandB, uRim, uNight;
uniform float uSeed, uLandLevel, uScale, uTime, uRimStrength, uCloudAmount;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vPosW;
${GLSL_NOISE}
void main() {
  vec3 n = normalize(vLocal);
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 seedOff = vec3(uSeed * 0.013, uSeed * 0.007, uSeed * 0.011);

  // Continents: domain-warped fractal noise with crisp but soft shorelines.
  vec3 p = n * uScale + seedOff;
  vec3 warp = vec3(xpFbm(p * 0.9 + 2.0), xpFbm(p * 0.9 + 5.0), xpFbm(p * 0.9 + 9.0));
  float h = xpFbm(p + warp * 1.6);
  float land = smoothstep(uLandLevel - 0.012, uLandLevel + 0.012, h);
  float depth = smoothstep(uLandLevel - 0.22, uLandLevel, h);
  vec3 ocean = mix(uDeep, uShallow, depth * depth);
  float highland = smoothstep(uLandLevel + 0.02, uLandLevel + 0.2, h);
  vec3 ground = mix(uLandA, uLandB, highland);
  vec3 albedo = mix(ocean, ground, land);

  // Latitude-stretched cloud streaks drift slowly (kept thin: the painterly
  // continents must stay readable).
  vec3 cp = vec3(n.x * 2.2, n.y * 7.0, n.z * 2.2) + seedOff + vec3(uTime * 0.004, 0.0, 0.0);
  float clouds = smoothstep(0.6, 0.88, xpFbm(cp + warp)) * uCloudAmount;
  albedo = mix(albedo, vec3(0.7, 0.85, 1.0), clouds * 0.35);

  // Soft wrap lighting. The night side is a deep cobalt that still shows the
  // continent pattern faintly (IMG 07 never goes black).
  float ndl = dot(N, uSun);
  float lit = smoothstep(-0.22, 0.6, ndl);
  vec3 night = mix(uNight, uNight * 0.6 + albedo * 0.32, 0.75);
  vec3 col = mix(night, albedo * 0.82, lit);
  // Ocean glints toward the light.
  vec3 H = normalize(uSun + V);
  col += uRim * pow(max(dot(N, H), 0.0), 80.0) * (1.0 - land) * lit * 0.35;

  // Luminous limb: a thin bright line on the lit edge, lilac scatter elsewhere.
  float nv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - nv, 4.0);
  float line = smoothstep(0.16, 0.0, nv);
  float limbLight = smoothstep(-0.3, 0.5, ndl);
  col += uRim * (fres * 0.9 + line * 1.4) * (0.15 + 1.3 * limbLight) * uRimStrength;
  col += vec3(0.55, 0.38, 0.85) * fres * (1.0 - limbLight) * 0.25 * uRimStrength;
  // Terminator scatter band (cyan to lilac).
  float band = exp(-pow(ndl * 3.5, 2.0));
  col += mix(vec3(0.45, 0.3, 0.85), uRim, 0.35) * band * 0.1;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// Rendered on back faces of a slightly larger shell: a halo outside the limb.
const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uSun, uRim, uScatter;
uniform float uStrength;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  // 0 at the shell's outer silhouette, 1 where the line of sight grazes the
  // planet's limb (shell radius 1.075: grazing cosine is about 0.37).
  float rim = clamp(dot(-N, V) / 0.37, 0.0, 1.0);
  float glow = pow(rim, 3.0);
  float lit = smoothstep(-0.5, 0.65, dot(N, uSun));
  vec3 col = mix(uScatter * 0.55, uRim * 1.35, lit) * glow * uStrength;
  gl_FragColor = vec4(col, glow);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const RING_VERTEX = /* glsl */ `
varying vec2 vRingUv;
varying vec3 vPosW;
uniform float uInner, uOuter;
void main() {
  float r = length(position.xy);
  vRingUv = vec2((r - uInner) / (uOuter - uInner), atan(position.y, position.x));
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform vec3 uRim, uLilac;
uniform float uTime, uOpacity;
varying vec2 vRingUv;
varying vec3 vPosW;
${GLSL_NOISE}
void main() {
  float t = vRingUv.x;
  float a = vRingUv.y;
  // Many thin luminous bands with gaps, fading at both edges.
  float bands = 0.5 + 0.5 * sin(t * 38.0 + xpNoise(vec3(t * 9.0, 0.0, 1.0)) * 5.0);
  bands = pow(bands, 10.0) * 0.6;
  float broad = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.55, t);
  float lanes = smoothstep(0.25, 0.75, xpFbm(vec3(t * 18.0, 3.0, 0.5)));
  // Sparkling dust grains.
  vec3 cell = vec3(t * 260.0, a * 340.0, 0.0);
  vec3 h = xpHash33(cell);
  float grain = step(0.975, h.x) * (0.6 + 0.4 * sin(uTime * (1.0 + h.y * 3.0) + h.z * 6.28));
  float haze = smoothstep(0.1, 0.5, t) * smoothstep(0.95, 0.5, t) * 0.18;
  float intensity = (bands * 0.5 + lanes * 0.18 + haze) * broad + grain * broad * 1.8;
  vec3 col = mix(uLilac, uRim, smoothstep(0.2, 0.8, t)) * intensity;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

let sharedSurface = null;
let sharedShell = null;
function sphere(detail) {
  // The hero planet fills a third of the screen: silhouette needs segments.
  return new THREE.SphereGeometry(1, detail * 2, detail);
}

export const PLANET_PALETTES = Object.freeze({
  // IMG 07 hero: blue-teal oceans, lilac/rose continents, cyan rim.
  verge: {
    deep: '#1A4A9E', shallow: '#2FA8D0', landA: '#5B4FC2', landB: '#D98FD0',
    rim: '#70E2F4', night: '#123275', scatter: '#985DC8', land: 0.52, scale: 2.1, clouds: 0.55,
  },
  // Frozen lilac moon (top right of IMG 07).
  frost: {
    deep: '#1C2C6A', shallow: '#33509E', landA: '#2A3F86', landB: '#6276C8',
    rim: '#A9C8FF', night: '#0C1438', scatter: '#C79BE8', land: 0.5, scale: 3.2, clouds: 0.1,
  },
  // Dusky violet moon (lower left of IMG 07).
  dusk: {
    deep: '#1B205A', shallow: '#3B3D8F', landA: '#5B3F8E', landB: '#985DC8',
    rim: '#E5A1CF', night: '#0E1236', scatter: '#985DC8', land: 0.48, scale: 2.8, clouds: 0.1,
  },
});

export function createPlanet({
  radius, position, sunDirection, palette = PLANET_PALETTES.verge, seed = 1,
  detail = 64, octaves = 5, atmosphere = true, ring = null, rimStrength = 1,
}) {
  const pal = palette;
  const sun = new THREE.Vector3(...sunDirection).normalize();
  const group = new THREE.Group();
  group.position.set(...position);

  sharedSurface ??= sphere(detail);
  const surface = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    defines: { XP_OCTAVES: octaves },
    uniforms: {
      uSun: { value: sun },
      uDeep: { value: new THREE.Color(pal.deep) },
      uShallow: { value: new THREE.Color(pal.shallow) },
      uLandA: { value: new THREE.Color(pal.landA) },
      uLandB: { value: new THREE.Color(pal.landB) },
      uRim: { value: new THREE.Color(pal.rim) },
      uNight: { value: new THREE.Color(pal.night) },
      uSeed: { value: seed % 1000 },
      uLandLevel: { value: pal.land },
      uScale: { value: pal.scale },
      uTime: { value: 0 },
      uRimStrength: { value: rimStrength },
      uCloudAmount: { value: pal.clouds },
    },
  });
  const body = new THREE.Mesh(sharedSurface, surface);
  body.scale.setScalar(radius);
  body.name = 'PlanetSurface';
  group.add(body);

  if (atmosphere) {
    sharedShell ??= sphere(Math.max(24, detail / 2));
    const shell = new THREE.Mesh(sharedShell, new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSun: { value: sun },
        uRim: { value: new THREE.Color(pal.rim) },
        uScatter: { value: new THREE.Color(pal.scatter) },
        uStrength: { value: 1.4 * rimStrength },
      },
    }));
    shell.scale.setScalar(radius * 1.075);
    shell.name = 'PlanetAtmosphere';
    group.add(shell);
  }

  let ringMaterial = null;
  if (ring) {
    const inner = radius * ring.inner, outer = radius * ring.outer;
    ringMaterial = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uInner: { value: inner },
        uOuter: { value: outer },
        uRim: { value: new THREE.Color(pal.rim) },
        uLilac: { value: new THREE.Color(pal.scatter) },
        uTime: { value: 0 },
        uOpacity: { value: ring.opacity ?? 0.6 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 192, 1), ringMaterial);
    mesh.rotation.set(...ring.tilt);
    mesh.name = 'PlanetRing';
    group.add(mesh);
  }

  return {
    group,
    radius,
    update(time) {
      surface.uniforms.uTime.value = time;
      if (ringMaterial) ringMaterial.uniforms.uTime.value = time;
    },
  };
}
