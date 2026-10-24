// body.glsl: the indigo shell deepens to cobalt at the plinth and warms to
// violet toward the crown, with a faint ion-cyan rim on silhouette edges.
// glow is 0 for this material, so the rim never spills into a halo.
void p0Surface(inout P0Surface s) {
  float h = clamp(s.position.y / 28.0, 0.0, 1.0);
  s.color *= mix(vec3(0.85, 0.92, 1.12), vec3(1.2, 0.98, 1.55), h);
  float facing = clamp(dot(s.normal, s.view), 0.0, 1.0);
  float rim = pow(1.0 - facing, 3.0);
  s.emissive += vec3(0.04, 0.11, 0.19) * rim * (0.7 + 0.3 * p0Near);
}
