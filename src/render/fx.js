import * as THREE from 'three';

/**
 * Interaction effects in world space: expanding scan pulse, mining beam from
 * the ship's miner socket to a resource node, and a soft burst on collection.
 * All meshes exist from the start (hidden) so warm-up compiles their shaders.
 */
const PULSE_VERTEX = /* glsl */ `
varying vec3 vN; varying vec3 vP;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const PULSE_FRAGMENT = /* glsl */ `
uniform float uFade; uniform vec3 uColor;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 V = normalize(cameraPosition - vP);
  float f = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);
  float a = f * uFade;
  gl_FragColor = vec4(uColor * a, a);
}
`;
const BEAM_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BEAM_FRAGMENT = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uOn;
varying vec2 vUv;
void main() {
  float across = sin(vUv.x * 3.14159);
  float bands = 0.6 + 0.4 * sin(vUv.y * 40.0 - uTime * 18.0);
  float a = across * bands * uOn * 0.85;
  gl_FragColor = vec4(uColor * a, a);
}
`;
const BURST_VERTEX = /* glsl */ `
attribute vec3 aDir;
uniform float uAge; uniform float uScale;
varying float vA;
void main() {
  vec3 p = position + aDir * (uAge * 26.0);
  vA = max(0.0, 1.0 - uAge);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uScale * 1.6 / -mv.z, 1.5, 24.0);
  gl_Position = projectionMatrix * mv;
}
`;
const BURST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 4.0) * vA;
  gl_FragColor = vec4(uColor * a * 1.6, a);
}
`;

export function createFxLayer() {
  const group = new THREE.Group();
  group.name = 'Fx';
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

  const pulseMat = new THREE.ShaderMaterial({ vertexShader: PULSE_VERTEX, fragmentShader: PULSE_FRAGMENT, side: THREE.DoubleSide, ...add,
    uniforms: { uFade: { value: 0 }, uColor: { value: new THREE.Color(0.45, 0.9, 1.0) } } });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), pulseMat);
  pulse.visible = false;
  pulse.frustumCulled = false;

  const beamGeo = new THREE.CylinderGeometry(0.08, 0.5, 1, 10, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beamMat = new THREE.ShaderMaterial({ vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT, side: THREE.DoubleSide, ...add,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.72, 0.4) }, uOn: { value: 0 } } });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  beam.frustumCulled = false;

  const count = 48;
  const dirs = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(Math.sin(i * 12.9898) * 2 - 1, Math.sin(i * 78.233) * 2 - 1, Math.sin(i * 37.719) * 2 - 1).normalize();
    v.multiplyScalar(0.5 + ((i * 0.618) % 1));
    dirs.set([v.x, v.y, v.z], i * 3);
  }
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  burstGeo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  const burstMat = new THREE.ShaderMaterial({ vertexShader: BURST_VERTEX, fragmentShader: BURST_FRAGMENT, ...add,
    uniforms: { uAge: { value: 1 }, uScale: { value: 600 }, uColor: { value: new THREE.Color(0.45, 0.9, 1) } } });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.visible = false;
  burst.frustumCulled = false;

  group.add(pulse, beam, burst);
  let pulseT = -1, pulseRange = 150, burstT = -1, time = 0;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    group,
    prepare() { pulse.visible = beam.visible = burst.visible = true; pulseMat.uniforms.uFade.value = 0.01; beamMat.uniforms.uOn.value = 0.01; },
    reset() { pulse.visible = beam.visible = burst.visible = false; },
    pulse(origin, range) {
      pulse.position.copy(origin);
      pulseRange = range;
      pulseT = 0;
      pulse.visible = true;
    },
    burst(position, color) {
      burst.position.set(...position);
      burstMat.uniforms.uColor.value.setRGB(...color);
      burstT = 0;
      burst.visible = true;
    },
    update(dt, { mining, shipWorld, minerSocket }) {
      time += dt;
      if (pulseT >= 0) {
        pulseT += dt / 1.1;
        const e = 1 - Math.pow(1 - Math.min(1, pulseT), 3);
        pulse.scale.setScalar(Math.max(0.01, e * pulseRange));
        pulseMat.uniforms.uFade.value = (1 - Math.min(1, pulseT)) * 0.9;
        if (pulseT >= 1) { pulseT = -1; pulse.visible = false; }
      }
      if (burstT >= 0) {
        burstT += dt / 1.3;
        burstMat.uniforms.uAge.value = Math.min(1, burstT);
        if (burstT >= 1) { burstT = -1; burst.visible = false; }
      }
      if (mining && shipWorld && minerSocket) {
        from.copy(minerSocket).applyMatrix4(shipWorld.matrix);
        to.set(...mining.node.position);
        dir.subVectors(to, from);
        const length = Math.max(0.1, dir.length() - mining.node.radius * 0.55);
        beam.position.copy(from);
        beam.quaternion.setFromUnitVectors(up, dir.normalize());
        beam.scale.set(1, length, 1);
        beamMat.uniforms.uTime.value = time;
        beamMat.uniforms.uColor.value.setRGB(...(mining.node.type === 'crystal' ? [0.45, 0.9, 1.0] : [1.0, 0.72, 0.4]));
        beamMat.uniforms.uOn.value = Math.min(1, mining.t * 4);
        beam.visible = true;
      } else beam.visible = false;
    },
  };
}
