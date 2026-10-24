import * as THREE from 'three';
import { GLSL_NOISE } from './glsl.js';
import { PALETTE } from '../game/config.js';

/**
 * Procedural IMG 07 sky: a luminous cobalt / indigo / violet "cosmic ocean"
 * with lilac nebula and a soft glow where the sun hides behind the planet.
 * It is rendered once into a cube map (cheap per frame) and used as the scene
 * background and, through PMREM, as the environment for the white hulls.
 */
const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uPlanet;
uniform vec3 uAbyss, uCobalt, uViolet, uLilac, uCyan, uRose;
varying vec3 vDir;
${GLSL_NOISE}
void main() {
  vec3 d = normalize(vDir);
  float toSun = dot(d, uSun);
  float toPlanet = dot(d, uPlanet);

  // Large-scale field: abyss navy far from the light, bright cobalt around it.
  float field = smoothstep(-0.75, 0.95, dot(d, normalize(uSun * 0.9 + uPlanet * 0.5)));
  vec3 col = mix(uAbyss * 0.85, uCobalt * 1.05, field);
  // Violet depth on the side opposite the sun.
  col = mix(col, uViolet * 1.1, smoothstep(0.15, -0.85, toSun) * 0.55);

  // Domain-warped nebula. Two scales: soft broad clouds plus finer wisps.
  vec3 q = d * 1.65;
  vec3 warp = vec3(xpFbm(q + 3.1), xpFbm(q + 7.7), xpFbm(q + 1.3));
  float cloud = xpFbm(q * 1.4 + warp * 2.2);
  float wisps = xpFbm(d * 5.5 + warp * 1.4);
  float mask = smoothstep(0.42, 0.78, cloud);
  float lane = smoothstep(0.55, 0.72, xpFbm(d * 3.2 - warp));
  vec3 nebula = mix(uViolet * 1.6, uLilac * 0.95, smoothstep(0.5, 0.85, cloud));
  nebula = mix(nebula, uRose * 0.8, smoothstep(0.7, 0.92, wisps) * 0.45);
  // Cooler blue-cyan nebula near the sun glow, lilac/rose further away.
  nebula = mix(nebula, uCobalt * 1.7 + uCyan * 0.12, smoothstep(0.2, 0.9, toSun) * 0.55);
  col = mix(col, nebula, mask * 0.62);
  col *= 1.0 - lane * mask * 0.35;
  col += uLilac * 0.05 * smoothstep(0.6, 0.95, wisps);

  // Sun hidden behind the planet: broad halo + tighter luminous core.
  float s = max(toSun, 0.0);
  col += uCobalt * 0.9 * pow(s, 3.0);
  col += uCyan * 0.35 * pow(s, 12.0);
  col += vec3(0.9, 0.97, 1.0) * 0.8 * pow(s, 90.0);

  // Faint star dust baked in; bright stars are a separate point layer.
  vec3 cell = d * 420.0;
  vec3 h = xpHash33(cell);
  float star = step(0.9965, h.x) * smoothstep(0.5, 0.0, length(fract(cell) - 0.5 - (h.yzx - 0.5) * 0.4));
  col += vec3(0.75, 0.85, 1.0) * star * (0.25 + 0.5 * h.y);

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export function createSky(renderer, { size = 512, octaves = 5, lite = false, sunDirection, planetDirection }) {
  const sun = new THREE.Vector3(...sunDirection).normalize();
  const planet = new THREE.Vector3(...planetDirection).normalize();
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    defines: lite ? { XP_OCTAVES: octaves, XP_LITE: 1 } : { XP_OCTAVES: octaves },
    uniforms: {
      uSun: { value: sun },
      uPlanet: { value: planet },
      uAbyss: { value: new THREE.Color(PALETTE.abyss) },
      uCobalt: { value: new THREE.Color(PALETTE.cobalt) },
      uViolet: { value: new THREE.Color(PALETTE.violet) },
      uLilac: { value: new THREE.Color(PALETTE.lilac) },
      uCyan: { value: new THREE.Color(PALETTE.cyan) },
      uRose: { value: new THREE.Color(PALETTE.rose) },
    },
  });
  const bakeScene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material);
  bakeScene.add(dome);

  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCamera = new THREE.CubeCamera(0.1, 100, target);
  bakeScene.add(cubeCamera);
  cubeCamera.update(renderer, bakeScene);

  dome.geometry.dispose();
  material.dispose();

  let envMap = null;
  return {
    texture: target.texture,
    // Built lazily: PMREM costs a few ms and LOW quality skips it.
    environment() {
      if (!envMap) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        envMap = pmrem.fromCubemap(target.texture).texture;
        pmrem.dispose();
      }
      return envMap;
    },
    dispose() {
      target.dispose();
      envMap?.dispose();
    },
  };
}
