import * as THREE from 'three';
import { CAMERA } from '../game/config.js';

/**
 * Distant cinematic follow camera (handoff CAMERA_WIDE_FOLLOW_LOCKED.md).
 * - Distance is solved from the ship's bounding sphere and the field of view,
 *   then corrected by feedback from the ship's measured projected height, so
 *   the craft stays ~4-9% of the viewport height (5-11% on phones).
 * - Soft spring follow, look-ahead aim, framing bias away from the planet,
 *   optional free-look that recentres, gentle zoom that eases back.
 * - Never a close chase view: the distance is clamped to the fraction range.
 */
const UP = new THREE.Vector3(0, 1, 0);

export function viewProfile(width, height) {
  const portrait = height > width;
  const phone = Math.min(width, height) < 520;
  let fov = CAMERA.fovDesktop;
  if (portrait) fov = CAMERA.fovPortrait;
  else if (phone) fov = CAMERA.fovLandscapePhone;
  return {
    portrait,
    phone,
    fov,
    target: phone || portrait ? CAMERA.targetFractionPhone : CAMERA.targetFractionDesktop,
  };
}

// Distance at which a sphere of radius r spans `fraction` of the view height.
export function distanceForFraction(radius, fraction, fovDeg) {
  return radius / (fraction * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
}

export function createCinematicCamera(camera) {
  const state = {
    position: new THREE.Vector3(0, 6, -40),
    aim: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    feedback: 1, // multiplier from measured screen fraction
    zoom: 1, // player zoom (decays back to 1)
    baseZoom: 1, // settings: wide / standard / close
    zoomIdle: 0,
    actionZoom: 1, // scan/dock zoom request
    actionZoomTarget: 1,
    lateral: 0,
    roll: 0,
    measured: 0,
    initialised: false,
  };
  const desired = new THREE.Vector3(), aimTarget = new THREE.Vector3();
  const forward = new THREE.Vector3(), flat = new THREE.Vector3(), right = new THREE.Vector3();
  const tmp = new THREE.Vector3(), ndc = new THREE.Vector3();
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const lookMatrix = new THREE.Matrix4();
  const targetQuat = new THREE.Quaternion();
  const worldCamera = new THREE.PerspectiveCamera();

  function measure(shipObject, bounds, cam) {
    // Project the ship's oriented bounding box corners; report its largest
    // on-screen extent (height or wingspan) as a fraction of the view height.
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    let k = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      corners[k].set(x, y, z).applyMatrix4(shipObject.matrixWorld);
      ndc.copy(corners[k]).project(cam);
      minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y);
      minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x);
      k++;
    }
    return Math.max(0, (maxY - minY) / 2, ((maxX - minX) / 2) * cam.aspect);
  }

  return {
    state,
    reset() { state.initialised = false; state.feedback = 1; state.zoom = 1; },
    zoomBy(delta) {
      state.zoom = THREE.MathUtils.clamp(state.zoom * (1 + delta), CAMERA.zoomMin, CAMERA.zoomMax);
      state.zoomIdle = 0;
    },
    setActionZoom(z) { state.actionZoomTarget = z; },
    setBaseZoom(z) { state.baseZoom = THREE.MathUtils.clamp(z, 0.8, 1.25); },
    /**
     * @param {object} o
     *  ship: { position: Vector3 (world), yaw, pitch, bank, speed, lookYaw, lookPitch }
     *  shipObject, bounds, radius: rendered ship + local bounds for measurement
     *  anchor: Vector3, render position of the camera (floating origin)
     *  planetWorld: Vector3 | null, used to bias framing away from the planet
     *  width, height: viewport CSS size; reducedMotion
     */
    update(dt, o) {
      const profile = viewProfile(o.width, o.height);
      camera.fov += (profile.fov - camera.fov) * Math.min(1, dt * 4);
      if (!state.initialised) camera.fov = profile.fov;
      camera.aspect = o.width / o.height;
      camera.updateProjectionMatrix();

      // Player zoom eases back to the wide view after a few idle seconds.
      state.zoomIdle += dt;
      if (state.zoomIdle > 6) state.zoom += (1 - state.zoom) * Math.min(1, dt * 0.8);
      state.actionZoom += (state.actionZoomTarget - state.actionZoom) * Math.min(1, dt * 1.5);

      const s = o.ship;
      const speedFactor = THREE.MathUtils.clamp((s.speed - 14) / 26, 0, 1);
      const base = distanceForFraction(o.radius, profile.target, camera.fov);
      let distance = base * state.feedback * state.baseZoom * state.zoom * state.actionZoom * (1 + speedFactor * 0.12);
      // Sanity bounds only; the 4-11% composition limits are enforced on the
      // measured screen size by the feedback below.
      distance = THREE.MathUtils.clamp(distance,
        distanceForFraction(o.radius, 0.3, camera.fov),
        distanceForFraction(o.radius, 0.012, camera.fov));

      const viewYaw = s.yaw + s.lookYaw;
      // Looking up (positive lookPitch) lowers the camera so the view tilts up.
      const viewPitch = s.pitch * 0.45 - CAMERA.elevation + s.lookPitch;
      forward.set(Math.sin(viewYaw) * Math.cos(viewPitch), Math.sin(viewPitch), Math.cos(viewYaw) * Math.cos(viewPitch));
      flat.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      right.crossVectors(flat, UP).normalize(); // screen-right when looking along flat

      // Framing bias: keep the craft off-centre, on the side away from the planet.
      let lateralTarget = 0.18;
      if (o.planetWorld) {
        tmp.subVectors(o.planetWorld, s.position).normalize();
        lateralTarget = tmp.dot(right) > 0 ? -0.2 : 0.2;
      }
      if (o.portrait) lateralTarget *= 0.35;
      state.lateral += (lateralTarget - state.lateral) * Math.min(1, dt * 0.35);

      desired.copy(s.position).addScaledVector(forward, -distance).addScaledVector(right, state.lateral * distance * 0.25);
      aimTarget.copy(s.position)
        .addScaledVector(flat, distance * CAMERA.lookAhead * (1 - Math.abs(s.lookYaw) / Math.PI))
        .addScaledVector(right, -state.lateral * distance * 0.35)
        .addScaledVector(UP, distance * (o.portrait ? 0.02 : 0.06));

      if (!state.initialised) {
        state.position.copy(desired);
        state.aim.copy(aimTarget);
        state.initialised = true;
      }
      // Restrained critically-damped follow; reduced motion follows more firmly.
      const posK = 1 - Math.exp(-CAMERA.positionDamping * (o.reducedMotion ? 1.6 : 1) * dt);
      const aimK = 1 - Math.exp(-CAMERA.aimDamping * (o.reducedMotion ? 1.6 : 1) * dt);
      state.position.lerp(desired, posK);
      state.aim.lerp(aimTarget, aimK);

      // Keep the camera outside obstacles (asteroids, station).
      if (o.obstacles) {
        for (const b of o.obstacles) {
          const r = b.radius + 2;
          const d2 = state.position.distanceToSquared(b.position);
          if (d2 < r * r) {
            tmp.subVectors(state.position, b.position).normalize();
            state.position.copy(b.position).addScaledVector(tmp, r);
          }
        }
      }

      // Orientation in world space, then expressed at the render anchor.
      worldCamera.position.copy(state.position);
      lookMatrix.lookAt(state.position, state.aim, UP);
      targetQuat.setFromRotationMatrix(lookMatrix);
      const rollTarget = o.reducedMotion ? 0 : -s.bank * 0.22;
      state.roll += (rollTarget - state.roll) * Math.min(1, dt * 2);
      tmp.set(0, 0, 1);
      targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(tmp, state.roll));
      camera.quaternion.copy(targetQuat);
      camera.position.copy(o.anchor);
      camera.updateMatrixWorld();

      // Screen-space validation and gentle correction toward the target.
      if (o.shipObject && o.bounds) {
        state.measured = measure(o.shipObject, o.bounds, camera);
        // Converge on the target; the player's zoom may vary it, but never
        // beyond the locked limits (never a close chase view, never lost).
        const goal = THREE.MathUtils.clamp(profile.target / (state.zoom * state.baseZoom * state.actionZoom), CAMERA.minFraction, CAMERA.maxFraction);
        if (state.measured > 0.002) {
          // Equilibrium: measured size == goal (zoom already lives in goal).
          const ratio = state.measured / goal;
          state.feedback = THREE.MathUtils.clamp(state.feedback * Math.pow(ratio, Math.min(1, dt * 0.8)), 0.25, 4);
        }
      }
      return { worldPosition: state.position, distance, fraction: state.measured, profile };
    },
  };
}
