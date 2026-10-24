import * as THREE from 'three';
import { SECTOR, PALETTE } from '../game/config.js';
import { createSky } from './sky.js';
import { createPlanet, PLANET_PALETTES } from './planet.js';
import { createGlowPoints, createTrails, createDust, createStars, createRays } from './effects.js';
import { createAsteroidField } from './asteroids.js';
import { createStation, createGhostTile } from './station.js';
import { buildShip, shipMaterials } from './ship-model.js';

/**
 * The Outer Verge scene graph. Everything that lives in the game universe is
 * a child of `universe`; each frame `universe.position = anchor - cameraWorld`
 * keeps the camera at the Project 0 lot's centre (floating origin), so the
 * camera never leaves the lot box while the sector is thousands of metres wide.
 */
export function createWorld({ renderer, scene, quality, layout, baseTiles, powered, vessel, loadout }) {
  const universe = new THREE.Group();
  universe.name = 'Universe';
  scene.add(universe);

  const sunDir = new THREE.Vector3(...SECTOR.sunDirection).normalize();
  const planetCenter = new THREE.Vector3(...SECTOR.planet.center);

  // Sky cube map (background + environment).
  const sky = createSky(renderer, {
    size: quality.sky, octaves: quality.octaves,
    sunDirection: SECTOR.sunDirection, planetDirection: planetCenter.clone().normalize().toArray(),
  });
  scene.background = sky.texture;
  scene.environment = quality.label === 'Low' ? null : sky.environment();
  scene.environmentIntensity = 0.85;

  // Lights: key from the hidden sun, cool fill from the camera side, sky/ground hemisphere.
  const sun = new THREE.DirectionalLight(0xdff4ff, 2.2);
  sun.position.copy(sunDir).multiplyScalar(100);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.lilac), 0.55);
  fill.position.set(0.4, -0.2, -1).multiplyScalar(100);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#5b8de0'), new THREE.Color('#2a1f5a'), 0.9);
  scene.add(sun, fill, hemi);

  // Planets: the unreachable hero world and two moons (IMG 07 composition).
  const planet = createPlanet({
    radius: SECTOR.planet.radius, position: SECTOR.planet.center, sunDirection: SECTOR.sunDirection,
    palette: PLANET_PALETTES.verge, seed: SECTOR.planet.seed, detail: quality.planetDetail, octaves: quality.octaves,
    ring: { inner: 1.12, outer: 1.62, tilt: [1.32, 0.18, -0.32], opacity: 0.55 },
  });
  const moons = [
    createPlanet({ radius: 820, position: [-4200, 5600, 21000], sunDirection: SECTOR.sunDirection, palette: PLANET_PALETTES.frost, seed: 41, detail: 32, octaves: Math.min(4, quality.octaves) }),
    createPlanet({ radius: 1100, position: [9400, -3600, 13500], sunDirection: SECTOR.sunDirection, palette: PLANET_PALETTES.dusk, seed: 77, detail: 32, octaves: Math.min(4, quality.octaves), rimStrength: 1.2 }),
    createPlanet({ radius: 260, position: [2600, 1500, 9000], sunDirection: SECTOR.sunDirection, palette: PLANET_PALETTES.frost, seed: 13, detail: 24, octaves: 3, atmosphere: false }),
  ];
  universe.add(planet.group, ...moons.map(m => m.group));

  const rays = createRays({ size: SECTOR.planet.radius * 4.2, intensity: 1.05, bias: [-0.55, 0.85] });
  rays.object.position.copy(planetCenter).addScaledVector(sunDir, SECTOR.planet.radius * 1.02);
  universe.add(rays.object);

  // Stars ride with the camera (infinitely far); dust wraps around it.
  const stars = createStars({ count: quality.stars });
  scene.add(stars.object);
  const dust = createDust({ count: quality.dust });
  scene.add(dust.object);

  const field = createAsteroidField(layout, { detail: 1 });
  universe.add(field.group);

  const station = createStation({ tiles: baseTiles, powered, position: SECTOR.station.position });
  universe.add(station.group);
  const ghost = createGhostTile();
  station.group.add(ghost.object);

  // Player ship (rebuilt when the loadout changes; materials are shared).
  const shipRoot = new THREE.Group();
  shipRoot.name = 'PlayerShip';
  universe.add(shipRoot);
  let ship = null;
  function setShip(nextVessel, nextLoadout) {
    if (ship) { shipRoot.remove(ship.group); ship.dispose(); }
    ship = buildShip({ vessel: nextVessel, loadout: nextLoadout });
    shipRoot.add(ship.group);
    trails?.reset();
    return ship;
  }
  let trails = null;
  setShip(vessel, loadout);
  trails = createTrails({
    emitters: [{ width: 0.07, strength: 1 }, { width: 0.07, strength: 1 }, { width: 0.32, strength: 0.28 }],
    points: 110, lifetime: 3.4,
  });
  universe.add(trails.object);

  const glows = createGlowPoints(64);
  universe.add(glows.object);

  // Remote explorers in the same session, drawn as small ghost ships.
  const remote = new Map();

  const anchor = new THREE.Vector3();
  const cameraWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const nozzleWorld = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  shipMaterials();

  return {
    scene, universe, sky, planet, moons, field, station, ghost, shipRoot, trails, glows, stars, dust, rays,
    get ship() { return ship; },
    setShip,
    planetCenter,
    sunDir,
    anchor,
    cameraWorld,
    /** Applies the floating origin for this frame. */
    setCameraWorld(world, renderAnchor) {
      cameraWorld.copy(world);
      anchor.copy(renderAnchor);
      universe.position.copy(renderAnchor).sub(world);
      stars.object.position.copy(renderAnchor);
      universe.updateMatrixWorld(true);
    },
    toRender(worldPoint, target = new THREE.Vector3()) {
      return target.copy(worldPoint).add(universe.position);
    },
    updateEffects(dt, time, { camera, viewportHeight, pixelRatio, thrust, boosting, showShip = true }) {
      planet.update(time);
      for (const m of moons) m.update(time);
      rays.update(time, camera);
      stars.update(time, pixelRatio);
      dust.update(cameraWorld, anchor, viewportHeight);
      field.update(dt);
      // Engine glows and contrails from the ship's nozzles (world space).
      glows.begin();
      if (showShip && ship) {
        shipRoot.updateMatrixWorld(true);
        const n = ship.nozzles;
        // shipRoot is a direct child of the universe: its local matrix is world space.
        const shipWorld = shipRoot.matrix;
        for (let i = 0; i < Math.min(2, n.length); i++) nozzleWorld[i].copy(n[i]).applyMatrix4(shipWorld);
        if (n.length === 1) nozzleWorld[1].copy(nozzleWorld[0]);
        if (n.length > 2) {
          // Multi-engine hulls: trails from the outermost pair.
          nozzleWorld[0].copy(n[0]).applyMatrix4(shipWorld);
          nozzleWorld[1].copy(n[n.length - 1]).applyMatrix4(shipWorld);
        }
        nozzleWorld[2].lerpVectors(nozzleWorld[0], nozzleWorld[1], 0.5);
        const glowSize = (0.32 + thrust * 0.22 + (boosting ? 0.22 : 0));
        for (const p of n) {
          tmp.copy(p).applyMatrix4(shipWorld);
          glows.add(tmp, glowSize, [1.0, 0.62, 0.3]);
          glows.add(tmp, glowSize * 2.4, [0.16, 0.42, 0.85]);
        }
        trails.update(dt, nozzleWorld, cameraWorld, 0.5 + thrust * 0.5 + (boosting ? 0.4 : 0));
      }
      // Crystal node halos.
      for (const n of layout.nodes) {
        const state = field.nodeState.get(n.id);
        if (!state || state.amount <= 0.01) continue;
        tmp.set(...n.position);
        if (n.type === 'crystal') glows.add(tmp, n.size * 9 * (0.4 + 0.6 * state.amount), [0.3, 0.85, 1.0]);
        else glows.add(tmp, n.size * 5 * (0.4 + 0.6 * state.amount), [1.0, 0.6, 0.25]);
      }
      for (const r of remote.values()) {
        if (!r.object.visible) continue;
        tmp.setFromMatrixPosition(r.object.matrix);
        glows.add(tmp, 1.2, [0.9, 0.7, 1.0]);
      }
      glows.end();
      glows.setViewportHeight(viewportHeight);
    },
    remote,
  };
}
