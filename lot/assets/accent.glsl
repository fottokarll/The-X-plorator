// accent.glsl: warm amber details. The beacon at the tip breathes slowly
// (about 0.4 Hz, far below any flashing limit); engine glows shimmer gently.
void p0Surface(inout P0Surface s) {
  float beacon = step(28.8, s.position.y);
  float slow = 0.5 + 0.5 * sin(p0Time * 2.4);
  float shimmer = 0.9 + 0.1 * sin(p0Time * 9.0 + s.position.z * 6.0);
  vec3 amber = vec3(1.0, 0.56, 0.2);
  s.emissive = amber * mix(shimmer, 0.6 + slow * 1.8, beacon) * (1.0 + pulse * 0.8);
}
