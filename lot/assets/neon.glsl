// neon.glsl: THE X-PLORATOR beacon strips. Soft bands of light rise up the
// spire (about 2.9 s a band), the hue drifts slowly from ion cyan to violet.
// No atan/normalize of possibly-zero vectors, so no NaN can reach the glow.
void p0Surface(inout P0Surface s) {
  vec3 p = s.position;
  float rise = pow(0.5 + 0.5 * sin(p.y * 0.42 - p0Time * 2.2), 6.0);
  float drift = 0.5 + 0.5 * sin(p.y * 0.07 + p.x * 0.11 + p.z * 0.09 + p0Time * 0.45);
  vec3 cyan = vec3(0.16, 0.76, 0.91);
  vec3 violet = vec3(0.42, 0.22, 0.85);
  vec3 hue = mix(cyan, violet, drift * 0.65);
  s.color = vec3(0.02, 0.03, 0.06);
  s.emissive = hue * (1.0 + rise * 1.6 + p0Near * 0.35 + pulse * 1.2);
}
