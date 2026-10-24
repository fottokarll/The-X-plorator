import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceForFraction, viewProfile } from '../src/camera/cinematic-camera.js';
import { CAMERA } from '../src/game/config.js';

// The ship's bounding sphere spans `fraction` of the view height at that distance.
const projected = (radius, distance, fov) => radius / (distance * Math.tan((fov * Math.PI) / 360));

test('distant framing targets 4-9% of view height on desktop and 5-11% on phones', () => {
  const desktop = viewProfile(1920, 1080), portrait = viewProfile(390, 844), landscape = viewProfile(844, 390);
  assert.ok(desktop.target >= 0.04 && desktop.target <= 0.09);
  for (const p of [portrait, landscape]) assert.ok(p.target >= 0.05 && p.target <= 0.11);
  assert.ok(portrait.fov > desktop.fov, 'portrait widens the view');
  for (const p of [desktop, portrait, landscape]) {
    const d = distanceForFraction(1.35, p.target, p.fov);
    assert.ok(Math.abs(projected(1.35, d, p.fov) - p.target) < 1e-9);
  }
});

test('composition limits never allow a close chase camera', () => {
  const near = distanceForFraction(1.35, CAMERA.maxFraction, CAMERA.fovDesktop);
  assert.ok(projected(1.35, near, CAMERA.fovDesktop) <= 0.11 + 1e-9);
  assert.ok(near > 20, 'even the closest framing keeps the ship small (> 20 m away)');
});
