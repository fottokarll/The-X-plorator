import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * One render path for every quality level: scene -> linear HDR target ->
 * (bloom) -> final pass (NaN guard, ACES tone mapping, sRGB, opaque alpha)
 * -> screen, then the UI overlay at full resolution on top.
 * The Project 0 canvas is transparent; the final pass writes alpha = 1 so the
 * city never shows through, and finite colours so one NaN cannot spread.
 */
export const QUALITY = Object.freeze({
  high: { label: 'High', bloom: true, samples: 4, renderScale: 1, maxPixelRatio: 2, sky: 1024, octaves: 5, dust: 520, stars: 2600, planetDetail: 72 },
  medium: { label: 'Medium', bloom: true, samples: 0, renderScale: 0.85, maxPixelRatio: 1.5, sky: 512, octaves: 4, dust: 320, stars: 1800, planetDetail: 64 },
  low: { label: 'Low', bloom: false, samples: 0, renderScale: 0.7, maxPixelRatio: 1.25, sky: 256, octaves: 3, dust: 160, stars: 1100, planetDetail: 48 },
});

// Makes every pixel finite before bloom: one NaN pixel would otherwise be
// blurred across the whole frame (Project 0 games guide, section 6).
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      gl_FragColor = vec4(clamp(c, 0.0, 64.0), 1.0);
    }
  `,
};

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    varying vec2 vUv;
    vec3 xpRRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 xpAces(vec3 color) {
      const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExposure / 0.6;
      color = ACESInputMat * color;
      color = xpRRTAndODTFit(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 xpSrgb(vec3 c) {
      return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c));
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      c = clamp(c, 0.0, 64.0);
      c = xpSrgb(xpAces(c));
      // Tiny ordered dither against banding in the smooth blue gradients.
      float d = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
      c += (d - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function detectSoftwareRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return { name: String(name || 'unknown'), software: /swiftshader|llvmpipe|software|basic render|softpipe/i.test(String(name)) };
  } catch {
    return { name: 'unknown', software: false };
  }
}

export function createPipeline({ renderer, scene, camera, overlay }) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  let quality = QUALITY.high;
  let composer = null, bloomPass = null, finalPass = null;
  let width = 1, height = 1, basePixelRatio = 1;
  let dynamicScale = 1;
  const stats = { frameMs: 16, slowSince: 0, fastSince: 0 };

  function build() {
    composer?.dispose();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.samples });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = quality.bloom ? new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.65, 0.92) : null;
    if (bloomPass) {
      composer.addPass(new ShaderPass(SanitizeShader));
      composer.addPass(bloomPass);
    }
    finalPass = new ShaderPass(FinalShader);
    composer.addPass(finalPass);
    applySize();
  }

  function effectivePixelRatio() {
    return Math.min(basePixelRatio, quality.maxPixelRatio) * quality.renderScale * dynamicScale;
  }

  function applySize() {
    if (!composer) return;
    composer.setPixelRatio(effectivePixelRatio());
    composer.setSize(width, height);
  }

  return {
    get quality() { return quality; },
    get renderScale() { return quality.renderScale * dynamicScale; },
    // Pixels per CSS pixel of the 3D render target (for point-sprite sizing).
    get pixelRatio() { return effectivePixelRatio(); },
    setQuality(q) {
      quality = QUALITY[q] ?? QUALITY.high;
      dynamicScale = 1;
      build();
    },
    resize(w, h, pixelRatio) {
      width = Math.max(1, w); height = Math.max(1, h); basePixelRatio = pixelRatio || 1;
      applySize();
    },
    setBloom(strength) { if (bloomPass) bloomPass.strength = strength; },
    render() {
      composer.render();
      if (overlay) overlay.render(renderer);
    },
    // Dynamic resolution: step down after sustained slow frames, back up slowly.
    adapt(frameMs, now) {
      stats.frameMs += (frameMs - stats.frameMs) * 0.08;
      if (stats.frameMs > 26) {
        stats.fastSince = 0;
        if (!stats.slowSince) stats.slowSince = now;
        if (now - stats.slowSince > 1.5 && dynamicScale > 0.5) {
          dynamicScale = Math.max(0.5, dynamicScale * 0.85);
          stats.slowSince = now;
          applySize();
        }
      } else if (stats.frameMs < 14) {
        stats.slowSince = 0;
        if (!stats.fastSince) stats.fastSince = now;
        if (now - stats.fastSince > 4 && dynamicScale < 1) {
          dynamicScale = Math.min(1, dynamicScale * 1.1);
          stats.fastSince = now;
          applySize();
        }
      } else {
        stats.slowSince = 0; stats.fastSince = 0;
      }
    },
    get smoothedFrameMs() { return stats.frameMs; },
    // Compiles every material and pass up front (a shader compiles on the
    // first frame that draws it; mid-game that is a visible hitch).
    async warmUp() {
      const t0 = performance.now();
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      const saved = { w: width, h: height };
      composer.setPixelRatio(1);
      composer.setSize(64, 36);
      composer.render();
      if (overlay) overlay.render(renderer);
      width = saved.w; height = saved.h;
      applySize();
      return performance.now() - t0;
    },
  };
}
