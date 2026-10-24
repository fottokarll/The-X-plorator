import * as THREE from 'three';

/**
 * Screen-space UI for a sandbox with no DOM (Project 0 runs experiences in a
 * Web Worker): an OffscreenCanvas drawn with the 2D API and shown as a
 * full-screen texture, re-uploaded only when its content changes, plus a GPU
 * sprite layer for markers that must follow the 3D scene every frame.
 */
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = globalThis.document?.createElement('canvas');
  if (!c) throw new Error('No canvas available for the UI');
  c.width = w; c.height = h;
  return c;
}

const OVERLAY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const OVERLAY_FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vUv); }
`;

// Sprite shapes: 0 ring, 1 diamond, 2 arrow, 3 soft dot, 4 progress arc, 5 filled disc
const SPRITE_VERTEX = /* glsl */ `
attribute vec2 aCorner; // -0.5..0.5 quad corner
attribute vec4 aRect;   // centre x, y (css px), size (css px), rotation
attribute vec4 aColor;
attribute vec2 aShape;  // shape id, param (e.g. progress 0..1)
uniform vec2 uView;
varying vec2 vLocal;
varying vec4 vColor;
varying vec2 vShape;
void main() {
  vLocal = aCorner * 2.0;
  vColor = aColor;
  vShape = aShape;
  float c = cos(aRect.w), s = sin(aRect.w);
  vec2 p = mat2(c, s, -s, c) * aCorner * aRect.z + aRect.xy;
  vec2 ndc = vec2(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;
const SPRITE_FRAGMENT = /* glsl */ `
varying vec2 vLocal;
varying vec4 vColor;
varying vec2 vShape;
float aaStep(float edge, float x) { float w = fwidth(x) * 1.2; return smoothstep(edge - w, edge + w, x); }
void main() {
  float r = length(vLocal);
  float a = 0.0;
  int shape = int(vShape.x + 0.5);
  if (shape == 0) a = aaStep(0.78, r) * (1.0 - aaStep(0.94, r));
  else if (shape == 1) { float d = abs(vLocal.x) + abs(vLocal.y); a = aaStep(0.55, d) * (1.0 - aaStep(0.8, d)) + (1.0 - aaStep(0.22, d)); }
  else if (shape == 2) { vec2 q = vLocal; float d = max(abs(q.x) * 1.4 + q.y * 0.7, -q.y - 0.35); a = 1.0 - aaStep(0.6, d); }
  else if (shape == 3) a = exp(-r * r * 3.0) * (1.0 - aaStep(1.0, r));
  else if (shape == 4) {
    float ang = atan(vLocal.x, vLocal.y) / 6.2831853 + 0.5;
    float ring = aaStep(0.8, r) * (1.0 - aaStep(0.96, r));
    a = ring * (ang <= vShape.y ? 1.0 : 0.18);
  }
  else if (shape == 5) a = 1.0 - aaStep(0.96, r);
  a *= vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, a);
}
`;

export function createOverlay(maxSprites = 64) {
  let canvas = makeCanvas(2, 2);
  let ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.ShaderMaterial({
    vertexShader: OVERLAY_VERTEX,
    fragmentShader: OVERLAY_FRAGMENT,
    uniforms: { map: { value: texture } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const uiScene = new THREE.Scene();
  const uiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Sprite batch: plain quads (4 vertices per sprite) rewritten each frame.
  const spriteGeometry = new THREE.BufferGeometry();
  const corners = new Float32Array(maxSprites * 8);
  const indices = [];
  for (let i = 0; i < maxSprites; i++) {
    corners.set([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], i * 8);
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const aRect = new THREE.BufferAttribute(new Float32Array(maxSprites * 16), 4).setUsage(THREE.DynamicDrawUsage);
  const aColor = new THREE.BufferAttribute(new Float32Array(maxSprites * 16), 4).setUsage(THREE.DynamicDrawUsage);
  const aShape = new THREE.BufferAttribute(new Float32Array(maxSprites * 8), 2).setUsage(THREE.DynamicDrawUsage);
  spriteGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxSprites * 12), 3));
  spriteGeometry.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  spriteGeometry.setAttribute('aRect', aRect);
  spriteGeometry.setAttribute('aColor', aColor);
  spriteGeometry.setAttribute('aShape', aShape);
  spriteGeometry.setIndex(indices);
  spriteGeometry.setDrawRange(0, 0);
  const spriteMaterial = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
    uniforms: { uView: { value: new THREE.Vector2(1, 1) } },
    // CSS-pixel y grows downward, which flips the quads' winding in NDC.
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const sprites = new THREE.Mesh(spriteGeometry, spriteMaterial);
  sprites.frustumCulled = false;
  sprites.renderOrder = 2;
  quad.renderOrder = 1;
  uiScene.add(quad, sprites);

  let cssW = 1, cssH = 1, dpr = 1, dirty = true, spriteCount = 0;

  return {
    get ctx() { return ctx; },
    get width() { return cssW; },
    get height() { return cssH; },
    get dpr() { return dpr; },
    resize(w, h, pixelRatio) {
      cssW = Math.max(1, Math.round(w)); cssH = Math.max(1, Math.round(h));
      // Crisp text without enormous uploads on high-density phones.
      dpr = Math.min(pixelRatio || 1, cssW * cssH > 1400000 ? 1.25 : 2);
      const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas = makeCanvas(pw, ph);
        ctx = canvas.getContext('2d');
        texture.image = canvas;
        texture.dispose(); // re-allocate at the new size
      }
      spriteMaterial.uniforms.uView.value.set(cssW, cssH);
      dirty = true;
    },
    begin() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
      return ctx;
    },
    markDirty() { dirty = true; },
    get spriteMesh() { return sprites; },
    spritesBegin() { spriteCount = 0; },
    sprite(x, y, size, shape, color, { rotation = 0, param = 0 } = {}) {
      if (spriteCount >= maxSprites) return;
      for (let k = 0; k < 4; k++) {
        const v = spriteCount * 4 + k;
        aRect.setXYZW(v, x, y, size, rotation);
        aColor.setXYZW(v, color[0], color[1], color[2], color[3] ?? 1);
        aShape.setXY(v, shape, param);
      }
      spriteCount++;
    },
    spritesEnd() {
      spriteGeometry.setDrawRange(0, spriteCount * 6);
      aRect.needsUpdate = true; aColor.needsUpdate = true; aShape.needsUpdate = true;
    },
    render(renderer) {
      if (dirty) { texture.needsUpdate = true; dirty = false; }
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      renderer.render(uiScene, uiCamera);
      renderer.autoClear = autoClear;
    },
  };
}

export const SPRITE = Object.freeze({ RING: 0, DIAMOND: 1, ARROW: 2, DOT: 3, ARC: 4, DISC: 5 });
