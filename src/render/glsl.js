/**
 * Shared GLSL snippets. Hashes are integer-based (PCG) rather than sin-based:
 * the Project 0 games guide notes that sin hashes of large numbers flicker.
 * Requires WebGL2 / GLSL ES 3.0 (three r186 is WebGL2-only).
 */

export const GLSL_NOISE = /* glsl */ `
uvec3 xpPcg3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 xpHash33(vec3 p) {
  uvec3 u = xpPcg3(uvec3(ivec3(floor(p)) + 32768));
  return vec3(u) * (1.0 / 4294967295.0);
}
float xpHash13(vec3 p) { return xpHash33(p).x; }

#ifdef XP_LITE
// Light version (software renderers, low quality): value noise with one short
// integer hash per corner, about four times less code to compile and to run.
uint xpH(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float xpCorner(vec3 c) { uvec3 u = uvec3(ivec3(c) + 32768); return float(xpH(u.x + xpH(u.y + xpH(u.z)))) * (2.0 / 4294967295.0) - 1.0; }
float xpNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(xpCorner(i), xpCorner(i + vec3(1, 0, 0)), u.x);
  float b = mix(xpCorner(i + vec3(0, 1, 0)), xpCorner(i + vec3(1, 1, 0)), u.x);
  float c = mix(xpCorner(i + vec3(0, 0, 1)), xpCorner(i + vec3(1, 0, 1)), u.x);
  float d = mix(xpCorner(i + vec3(0, 1, 1)), xpCorner(i + vec3(1, 1, 1)), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}
#else
// Gradient noise in roughly [-1, 1].
float xpNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(xpHash33(i) * 2.0 - 1.0, f);
  float n100 = dot(xpHash33(i + vec3(1, 0, 0)) * 2.0 - 1.0, f - vec3(1, 0, 0));
  float n010 = dot(xpHash33(i + vec3(0, 1, 0)) * 2.0 - 1.0, f - vec3(0, 1, 0));
  float n110 = dot(xpHash33(i + vec3(1, 1, 0)) * 2.0 - 1.0, f - vec3(1, 1, 0));
  float n001 = dot(xpHash33(i + vec3(0, 0, 1)) * 2.0 - 1.0, f - vec3(0, 0, 1));
  float n101 = dot(xpHash33(i + vec3(1, 0, 1)) * 2.0 - 1.0, f - vec3(1, 0, 1));
  float n011 = dot(xpHash33(i + vec3(0, 1, 1)) * 2.0 - 1.0, f - vec3(0, 1, 1));
  float n111 = dot(xpHash33(i + vec3(1, 1, 1)) * 2.0 - 1.0, f - vec3(1, 1, 1));
  float nx00 = mix(n000, n100, u.x), nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x), nx11 = mix(n011, n111, u.x);
  return 1.6 * mix(mix(nx00, nx10, u.y), mix(nx01, nx11, u.y), u.z);
}
#endif

#ifndef XP_OCTAVES
#define XP_OCTAVES 5
#endif
// Fractal noise remapped to roughly [0, 1].
float xpFbm(vec3 p) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < XP_OCTAVES; i++) {
    sum += amp * xpNoise(p);
    norm += amp;
    p = p * 2.03 + vec3(17.1, 9.2, 4.7);
    amp *= 0.5;
  }
  return 0.5 + 0.5 * sum / norm;
}
`;

// Note: with three's colour management, new THREE.Color('#rrggbb') already
// converts the sRGB hex value into linear working space for uniforms.
