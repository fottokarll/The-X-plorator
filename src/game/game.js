import * as THREE from 'three';
import { SECTOR, RESOURCES } from './config.js';
import { buildSectorLayout } from './sector.js';
import { newProfile, sanitizeProfile, serializeProfile } from './profile.js';
import { computeStats, MODULES, moduleId, VESSELS } from './ships.js';
import { objective, onApproach, onScanned, onCollected, onNearDock, onDocked, regrowNodes, cargoUsed, nodeAmount } from './mission.js';
import { placementStatus, spend, canAfford, BASE_MODULES, localToHex, hexToLocal } from './base.js';
import { createFlightState, stepFlight } from '../flight/assisted-flight.js';
import { profileFor } from '../flight/profiles.js';
import { createInputHub } from '../input/input-hub.js';
import { createCinematicCamera } from '../camera/cinematic-camera.js';
import { createWorld } from '../render/world.js';
import { createPipeline, detectSoftwareRenderer, QUALITY } from '../render/pipeline.js';
import { buildShip } from '../render/ship-model.js';
import { createFxLayer } from '../render/fx.js';
import { createAudio } from './audio.js';
import { createOverlay } from '../ui/overlay.js';
import { createUi } from '../ui/ui.js';
import { viewInfo } from '../ui/kit.js';
import { createHud } from '../ui/hud.js';
import { registerScreens } from '../ui/screens.js';
import { createHangarScreen } from '../ui/hangar.js';
import { createMapScreen } from '../ui/galaxy-map.js';
import { createBaseScreen } from '../ui/base-builder.js';

export const DISPLAY_METRES = 10; // one world unit reads as 10 m on the HUD
export const formatDistance = units => {
  const m = units * DISPLAY_METRES;
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m / 10) * 10} m`;
};

const HELP_TEXT = 'Auto-cruise flies you. Steer: WASD / left stick. Boost Shift/RT · Brake C/LT · Scan Q/X · Collect & dock E/A · '
  + 'Map M · Hangar H · Base B · Pause P. Look: right-drag (optional). Goal: scan and collect 6 Cryon, dock at Haven Outpost.';
const HELP_TEXT_TOUCH = 'Auto-cruise flies you. Left thumb steers, hold Boost or Brake, tap Scan and Action. Drag right to look. Goal: collect 6 Cryon, dock at Haven Outpost.';

const v3 = o => new THREE.Vector3(o.x, o.y, o.z);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export async function createGame(p0) {
  const loading = (f, label) => { try { p0.loading?.(f, label); } catch { /* optional */ } };
  loading(0.02, 'charting the Outer Verge');
  try { p0.createRenderer?.({ antialias: false, powerPreference: 'high-performance' }); } catch (e) { p0.log?.('createRenderer:', e?.message); }
  const renderer = p0.renderer;
  p0.autoRender = false;
  if (p0.controls) { p0.controls.mode = 'none'; p0.controls.vertical = false; }
  if (p0.bodies) p0.bodies.visible = false;
  const scene = p0.scene;
  const camera = p0.camera;
  for (const child of [...scene.children]) if (child.isLight) scene.remove(child);
  camera.near = 0.3;
  camera.far = 90000;
  camera.updateProjectionMatrix();
  const lot = p0.lot ?? { width: 16, depth: 16, height: 30 };
  // Floating origin: the camera always renders from the lot's centre.
  const anchor = new THREE.Vector3(0, (lot.height ?? 30) / 2, 0);

  // ------------------------------------------------------------- profile
  const loaded = sanitizeProfile(p0.saved);
  let profile = loaded ?? newProfile();
  let hasSave = Boolean(loaded && loaded.started);
  let stats = computeStats(profile.vessel, profile.equipped);

  const soft = detectSoftwareRenderer(renderer);
  const viewport = () => ({ w: Math.max(1, p0.width || 1280), h: Math.max(1, p0.height || 720), pr: p0.pixelRatio || 1 });
  function resolveQuality(setting) {
    if (setting && setting !== 'auto') return setting;
    if (soft.software) return 'low';
    const v = viewport();
    return Math.min(v.w, v.h) < 520 ? 'medium' : 'high';
  }
  let qualityName = resolveQuality(profile.settings.quality);

  // ------------------------------------------------------------- world
  loading(0.12, 'painting the nebula');
  const layout = buildSectorLayout();
  const world = createWorld({
    renderer, scene, quality: QUALITY[qualityName], layout,
    baseTiles: profile.base, powered: profile.powered, vessel: profile.vessel, loadout: profile.equipped,
  });
  for (const [id, n] of Object.entries(profile.nodes)) world.field.setNodeAmount(id, n.amount);
  const fx = createFxLayer();
  world.universe.add(fx.group);
  loading(0.5, 'assembling Haven Outpost');

  const overlay = createOverlay();
  const pipeline = createPipeline({ renderer, scene, camera, overlay });
  pipeline.setQuality(qualityName);
  const camRig = createCinematicCamera(camera);
  const audio = createAudio(p0);
  const ui = createUi({ overlay, onActivate: () => audio.play('ui', game.time) });

  const input = createInputHub({
    getKeys: () => p0.input?.keys ?? new Set(),
    getGamepad: () => p0.input?.gamepad ?? null,
    isPadActive: () => Boolean(p0.input?.pad),
    touch: ui.touch,
  });
  input.setBindings(profile.settings.bindings);
  input.setOptions({ invert: profile.settings.invertY, sens: profile.settings.sensitivity });
  if (viewInfo(viewport().w, viewport().h).phone) input.device = 'touch';

  // ------------------------------------------------------------- state
  const flight = createFlightState();
  let flightProfile = profileFor(profile.settings.handling, stats);
  let mode = 'attract'; // attract | select | flight | docking | docked | launching | hangar | base | map
  let paused = false;
  let scanning = null, mining = null, docking = null, launching = null;
  let warning = null;
  const toasts = [];
  let toastId = 0;
  let scanCard = null;
  let hudModel = null;
  let saveTimer = 0, saveQueued = false;
  let regrowTimer = 0;
  const camWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const stationPos = new THREE.Vector3(...SECTOR.station.position);
  const obstacles = [];

  function rebuildObstacles() {
    obstacles.length = 0;
    for (const b of world.field.bodies) obstacles.push({ position: b.position, radius: b.radius * 0.95 });
    for (const t of profile.base) {
      const [x, z] = hexToLocal(t.q, t.r);
      obstacles.push({ position: new THREE.Vector3(x, -0.5, z).add(stationPos), radius: 8.5, deck: true });
      if (t.type === 'hub') obstacles.push({ position: new THREE.Vector3(x, 12, z).add(stationPos), radius: 6 });
    }
  }
  rebuildObstacles();

  function toast(textValue, color) {
    toasts.push({ id: ++toastId, text: textValue, color, until: game.time + 3.6 });
    if (toasts.length > 3) toasts.shift();
  }

  function saveSoon() { saveQueued = true; saveTimer = 1.2; }
  async function saveNow() {
    saveQueued = false;
    try {
      const r = await p0.save?.(serializeProfile(profile));
      if (r && r.ok === false && r.reason) p0.log?.('save:', r.reason);
    } catch (e) { p0.log?.('save failed:', e?.message); }
  }

  function applyStats() {
    stats = computeStats(profile.vessel, profile.equipped);
    // Each Scanner Array on the outpost extends the ship's scan range.
    stats.scanRange += 25 * profile.base.filter(t => t.type === 'scanner').length;
    flightProfile = profileFor(profile.settings.handling, stats);
  }

  function placeAtDock(offset = 3.2) {
    const dock = world.station.dockPoint(tmp);
    // dockPoint is in render space; convert back to world.
    dock.sub(world.universe.position);
    flight.position = { x: dock.x, y: dock.y + offset, z: dock.z };
    flight.yaw = 0; flight.pitch = 0; flight.bank = 0; flight.speed = 0;
    flight.yawInput = 0; flight.pitchInput = 0; flight.lookYaw = 0; flight.lookPitch = 0;
    applyShipTransform();
    world.trails.reset();
  }

  function applyShipTransform() {
    world.shipRoot.position.set(flight.position.x, flight.position.y, flight.position.z);
    world.shipRoot.quaternion.setFromEuler(new THREE.Euler(-flight.pitch, flight.yaw, flight.bank, 'YXZ'));
    world.shipRoot.updateMatrix();
  }

  // ------------------------------------------------------------- flight
  const SUB = 1 / 60;
  function updateFlight(dt, inp) {
    profile.stats.playSeconds += dt;
    let yaw = -inp.yaw, pitch = inp.pitch;
    const pos = v3(flight.position);
    const fromHome = pos.distanceTo(stationPos);
    warning = null;
    if (fromHome > SECTOR.playRadius) {
      warning = 'Leaving the Outer Verge · navigation assist';
      tmp.copy(stationPos).sub(pos).normalize();
      const desiredYaw = Math.atan2(tmp.x, tmp.z), desiredPitch = Math.asin(clamp(tmp.y, -1, 1));
      const k = clamp((fromHome - SECTOR.playRadius) / 250, 0, 1);
      yaw = THREE.MathUtils.lerp(yaw, clamp(wrap(desiredYaw - flight.yaw) * 2, -1, 1), k);
      pitch = THREE.MathUtils.lerp(pitch, clamp((desiredPitch - flight.pitch) * 2, -1, 1), k);
    }
    // Gentle avoidance: steer softly around rocks and station parts ahead.
    const avoid = avoidance(pos);
    yaw = clamp(yaw + avoid.yaw, -1, 1);
    pitch = clamp(pitch + avoid.pitch, -1, 1);
    const brake = Math.max(inp.brake, mining ? 0.75 : 0, avoid.brake);
    flight.cruiseEnabled = profile.settings.autoCruise;
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(SUB, remaining);
      stepFlight(flight, { yaw, pitch, thrust: inp.boost, boost: inp.boost > 0.5, brake, cameraYaw: -inp.lookX, cameraPitch: inp.lookY }, h, flightProfile);
      remaining -= h;
    }
    collide();
    applyShipTransform();
    interactions(dt);
  }

  const fwdV = new THREE.Vector3(), rightV = new THREE.Vector3(), upV = new THREE.Vector3(), relV = new THREE.Vector3();
  function avoidance(pos) {
    const cp = Math.cos(flight.pitch);
    fwdV.set(Math.sin(flight.yaw) * cp, Math.sin(flight.pitch), Math.cos(flight.yaw) * cp);
    rightV.crossVectors(fwdV, upV.set(0, 1, 0)).normalize();
    upV.crossVectors(rightV, fwdV).normalize();
    const look = 18 + flight.speed * 1.6;
    const shipR = world.ship.radius;
    let sx = 0, sy = 0, brake = 0;
    for (const o of obstacles) {
      relV.subVectors(o.position, pos);
      const along = relV.dot(fwdV);
      if (along <= 0 || along > look + o.radius) continue;
      relV.addScaledVector(fwdV, -along); // perpendicular offset of the obstacle from the path
      const lateral = relV.length();
      const clearance = o.radius + shipR + 4;
      if (lateral >= clearance) continue;
      const urgency = (1 - along / (look + o.radius)) * (1 - lateral / clearance);
      const ax = lateral > 1e-3 ? -relV.dot(rightV) / lateral : 1;
      const ay = lateral > 1e-3 ? -relV.dot(upV) / lateral : 0.3;
      sx += ax * urgency; sy += ay * urgency;
      if (along < o.radius + 10) brake = Math.max(brake, urgency * 0.6);
    }
    // Positive yaw input turns toward +x (screen-left): 'right' maps to negative yaw.
    return { yaw: clamp(-sx * 2.4, -0.9, 0.9), pitch: clamp(sy * 2.4, -0.9, 0.9), brake };
  }

  function collide() {
    const p = v3(flight.position);
    const shipR = world.ship.radius * 0.8;
    for (const o of obstacles) {
      const r = o.radius + shipR;
      const d2 = p.distanceToSquared(o.position);
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 1;
        tmp.subVectors(p, o.position).divideScalar(d);
        p.copy(o.position).addScaledVector(tmp, r);
        flight.speed *= 0.86;
      }
    }
    flight.position = { x: p.x, y: p.y, z: p.z };
  }

  // The mission's target node when it is within range, else the nearest node.
  function preferredNode(maxDistance, filter = () => true) {
    const p = v3(flight.position);
    const obj = objective(profile, layout.nodes, [p.x, p.y, p.z]);
    const target = obj.kind === 'node' ? layout.nodes.find(n => n.id === obj.target) : null;
    if (target && nodeAmount(profile, target) >= 0.5 && filter(target)) {
      const d = p.distanceTo(tmp2.set(...target.position)) - target.radius;
      if (d <= maxDistance) return { node: target, distance: Math.max(0, d) };
    }
    return nearestNode(maxDistance, filter);
  }

  function nearestNode(maxDistance, filter = () => true) {
    const p = v3(flight.position);
    let best = null, bestD = maxDistance;
    for (const n of layout.nodes) {
      if (nodeAmount(profile, n) < 0.5 || !filter(n)) continue;
      const d = p.distanceTo(tmp2.set(...n.position)) - n.radius;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best ? { node: best, distance: Math.max(0, bestD) } : null;
  }

  function dockDistance() {
    const dock = world.station.dockPoint(tmp2).sub(world.universe.position);
    return v3(flight.position).distanceTo(dock);
  }

  function interactions(dt) {
    const p = v3(flight.position);
    // Mission approach: entering scan range of the objective crystal.
    const obj = objective(profile, layout.nodes, [p.x, p.y, p.z]);
    if (obj.kind === 'node' && obj.target) {
      const n = layout.nodes.find(x => x.id === obj.target);
      if (n && onApproach(profile, n, p.distanceTo(tmp.set(...n.position)) - n.radius, stats.scanRange)) saveSoon();
    }
    onNearDock(profile, dockDistance());

    if (scanning) {
      scanning.t += dt;
      const d = p.distanceTo(tmp.set(...scanning.node.position)) - scanning.node.radius;
      if (d > stats.scanRange * 1.2) { toast('Scan lost: stay within range', '#E5A1CF'); scanning = null; camRig.setActionZoom(1); }
      else if (scanning.t >= scanning.duration) {
        const node = scanning.node;
        scanning = null;
        camRig.setActionZoom(1);
        onScanned(profile, node);
        audio.play('scanDone', game.time);
        const purity = 72 + Math.round(((node.position[0] * 13 + node.position[2] * 7) % 25 + 25) % 25);
        scanCard = {
          id: node.id + game.time.toFixed(1), type: node.type, until: game.time + 5,
          title: node.type === 'crystal' ? 'Cryon crystal' : 'Ferrite ore',
          lines: [['Purity', `${purity}%`], ['Yield', `${Math.round(node.yield * stats.yieldFactor)} units`], ['Distance', formatDistance(d)]],
        };
        saveSoon();
      }
    }
    if (mining) {
      mining.t += dt;
      const d = p.distanceTo(tmp.set(...mining.node.position)) - mining.node.radius;
      if (d > 85) { toast('Mining interrupted: move closer', '#E5A1CF'); mining = null; }
      else if (mining.t >= mining.duration) {
        const node = mining.node;
        mining = null;
        const r = onCollected(profile, node, { capacity: stats.capacity, yieldFactor: stats.yieldFactor, playSeconds: profile.stats.playSeconds });
        if (r.amount > 0) {
          world.field.setNodeAmount(node.id, 0);
          toast(`+${r.amount} ${RESOURCES[r.key].label}`, RESOURCES[r.key].color);
          audio.play('collect', game.time);
          fx.burst(node.position, node.type === 'crystal' ? [0.45, 0.9, 1] : [1, 0.7, 0.3]);
        }
        if (r.full) toast('Cargo hold full · return to Haven Outpost', '#F8BD78');
        saveSoon();
      }
    }
    // Regrowth of spent nodes.
    regrowTimer -= dt;
    if (regrowTimer <= 0) {
      regrowTimer = 2;
      for (const id of regrowNodes(profile, profile.stats.playSeconds)) world.field.setNodeAmount(id, 1);
    }
  }

  function interactState() {
    if (mode === 'docked') return 'launch';
    if (mode !== 'flight') return null;
    // Docking is offered when there is something to deliver or the mission asks for it.
    const wantsDock = cargoUsed(profile) > 0 || ['return', 'dock'].includes(profile.mission.step);
    if (wantsDock && dockDistance() < 70) return 'dock';
    const near = preferredNode(70, n => profile.mission.scanned.includes(n.id));
    if (near && cargoUsed(profile) < stats.capacity) return 'collect';
    return null;
  }

  function doScan() {
    if (mode !== 'flight' || scanning) return;
    fx.pulse(v3(flight.position), stats.scanRange);
    if (!preferredNode(stats.scanRange)) audio.play('scan', game.time);
    const target = preferredNode(stats.scanRange, n => !profile.mission.scanned.includes(n.id)) ?? preferredNode(stats.scanRange);
    if (!target) { toast(`No signal within ${formatDistance(stats.scanRange)}`, '#E5A1CF'); return; }
    if (profile.mission.scanned.includes(target.node.id)) {
      scanCard = { id: target.node.id + 'k' + game.time.toFixed(1), type: target.node.type, until: game.time + 3,
        title: target.node.type === 'crystal' ? 'Cryon crystal' : 'Ferrite ore', lines: [['Status', 'Already scanned'], ['Distance', formatDistance(target.distance)]] };
      return;
    }
    scanning = { node: target.node, t: 0, duration: stats.scanTime };
    camRig.setActionZoom(0.9);
    audio.play('scan', game.time);
  }

  function doInteract() {
    const state = interactState();
    if (state === 'launch') return launch();
    if (state === 'dock') return startDocking();
    if (state === 'collect') {
      const near = preferredNode(70, n => profile.mission.scanned.includes(n.id));
      if (near && !mining) mining = { node: near.node, t: 0, duration: stats.mineTime };
      return;
    }
    const near = nearestNode(70);
    if (near && !profile.mission.scanned.includes(near.node.id)) toast('Scan it first', '#70E2F4');
    else if (near && cargoUsed(profile) >= stats.capacity) toast('Cargo hold full', '#F8BD78');
    else toast('Nothing to collect here', '#9fb6d8');
  }

  function startDocking() {
    scanning = null; mining = null;
    const from = v3(flight.position);
    const dock = world.station.dockPoint(new THREE.Vector3()).sub(world.universe.position);
    const to = dock.clone().add(new THREE.Vector3(0, 2.4, 0));
    const control = to.clone().add(new THREE.Vector3(0, 18, -26));
    docking = { t: 0, from, control, to, fromQuat: world.shipRoot.quaternion.clone() };
    mode = 'docking';
    camRig.setActionZoom(0.8);
  }

  function updateDocking(dt) {
    docking.t = Math.min(1, docking.t + dt / 3.2);
    const t = docking.t, e = t * t * (3 - 2 * t);
    const a = docking.from, b = docking.control, c = docking.to;
    const p = new THREE.Vector3()
      .addScaledVector(a, (1 - e) * (1 - e)).addScaledVector(b, 2 * (1 - e) * e).addScaledVector(c, e * e);
    const prevPos = v3(flight.position);
    flight.position = { x: p.x, y: p.y, z: p.z };
    const vel = p.clone().sub(prevPos);
    // Readout: the glide's approach speed, never above cruise.
    flight.speed = Math.min(vel.length() / Math.max(dt, 1e-3), flightProfile.cruiseSpeed);
    world.shipRoot.position.copy(p);
    world.shipRoot.quaternion.slerpQuaternions(docking.fromQuat, new THREE.Quaternion(), e);
    world.shipRoot.updateMatrix();
    const euler = new THREE.Euler().setFromQuaternion(world.shipRoot.quaternion, 'YXZ');
    flight.yaw = euler.y; flight.pitch = -euler.x; flight.bank = euler.z;
    if (t >= 1) {
      docking = null;
      mode = 'docked';
      flight.speed = 0;
      camRig.setActionZoom(0.9);
      const r = onDocked(profile);
      audio.play('dock', game.time);
      const parts = [];
      if (r.delivered.cryon) parts.push(`${r.delivered.cryon} Cryon`);
      if (r.delivered.ferrite) parts.push(`${r.delivered.ferrite} Ferrite`);
      if (parts.length) toast(`Delivered ${parts.join(' · ')}`, '#8CF5C8');
      if (r.completed) {
        world.station.rebuild(profile.base, true);
        ui.push('complete');
      } else ui.push('docked');
      saveSoon();
    }
  }

  function launch() {
    if (ui.is('docked') || ui.is('complete')) ui.pop();
    if (profile.mission.step === 'complete') profile.mission.step = 'free';
    const from = v3(flight.position);
    launching = { t: 0, from, to: from.clone().add(new THREE.Vector3(0, 7, 28)) };
    audio.play('launch', game.time);
    mode = 'launching';
    camRig.setActionZoom(1);
    saveSoon();
  }

  function updateLaunching(dt) {
    launching.t = Math.min(1, launching.t + dt / 2.2);
    const e = launching.t * launching.t * (3 - 2 * launching.t);
    const p = launching.from.clone().lerp(launching.to, e);
    flight.position = { x: p.x, y: p.y, z: p.z };
    flight.yaw = 0; flight.pitch = 0.18 * (1 - e); flight.bank = 0;
    flight.speed = flightProfile.cruiseSpeed * e;
    applyShipTransform();
    if (launching.t >= 1) { launching = null; mode = 'flight'; ui.show('hud'); }
  }

  // ------------------------------------------------------------- attract
  const attract = { t: 0 };
  function updateAttract(dt) {
    attract.t += dt * 0.045;
    const a = attract.t;
    // A slow loop between the station and the field, with the planet framed.
    const path = t => new THREE.Vector3(Math.sin(t) * 160 - 40, 42 + Math.sin(t * 2) * 14, 90 + Math.cos(t) * 120);
    const p = path(a);
    const q = path(a + 0.01);
    const dir = q.sub(p).normalize();
    const yaw = Math.atan2(dir.x, dir.z), pitch = Math.asin(clamp(dir.y, -1, 1));
    const yawRate = wrap(yaw - flight.yaw) / Math.max(dt, 1e-3);
    flight.position = { x: p.x, y: p.y, z: p.z };
    flight.bank += (clamp(-yawRate * 6, -0.6, 0.6) - flight.bank) * Math.min(1, dt * 2);
    flight.yaw = yaw; flight.pitch = pitch; flight.speed = 14; flight.lookYaw = 0; flight.lookPitch = 0;
    applyShipTransform();
  }

  // ------------------------------------------------------------- showroom
  // Vessel cards (select) and the hangar both show real ship geometry.
  const showroom = new THREE.Group();
  showroom.name = 'Showroom';
  scene.add(showroom);
  const showShips = new Map();
  const hangarPad = createHangarPad();
  showroom.add(hangarPad);
  function showroomShip(key, vessel, loadout) {
    const sig = `${vessel}:${JSON.stringify(loadout)}`;
    let entry = showShips.get(key);
    if (entry && entry.sig === sig) return entry;
    if (entry) { showroom.remove(entry.ship.group); entry.ship.dispose(); }
    const ship = buildShip({ vessel, loadout });
    showroom.add(ship.group);
    entry = { ship, sig };
    showShips.set(key, entry);
    return entry;
  }
  function hideShowroom() {
    for (const e of showShips.values()) e.ship.group.visible = false;
    hangarPad.visible = false;
    world.field.group.visible = true;
    world.station.group.visible = true;
  }

  // ------------------------------------------------------------- camera per mode
  const flatCam = { yaw: 0, pitch: 0 };
  const attractCam = { pos: new THREE.Vector3(), aim: new THREE.Vector3(), init: false };
  function updateCamera(dt) {
    const v = viewport();
    const info = viewInfo(v.w, v.h);
    if (mode === 'hangar') return;
    if (mode === 'base') return;
    if (mode === 'attract') {
      // Menu: a slow cinematic view that always faces the planet (IMG 01 framing:
      // menu on the left, world on the right) while the ship drifts across.
      camera.fov = info.portrait ? 62 : 48;
      camera.aspect = v.w / v.h;
      camera.updateProjectionMatrix();
      const ship = v3(flight.position);
      const toPlanet = world.planetCenter.clone().sub(ship).normalize();
      const side = new THREE.Vector3().crossVectors(toPlanet, new THREE.Vector3(0, 1, 0)).normalize();
      // Aim up and to the left of the planet so it fills the lower right (side = screen right).
      const aimDir = toPlanet.clone().add(new THREE.Vector3(0, info.portrait ? 0.55 : 0.62, 0)).addScaledVector(side, info.portrait ? -0.2 : -0.5).normalize();
      const wantAim = ship.clone().addScaledVector(aimDir, 60);
      const wantPos = ship.clone().addScaledVector(aimDir, -58).addScaledVector(side, info.portrait ? 0 : -22).add(new THREE.Vector3(0, 7, 0));
      if (!attractCam.init) { attractCam.pos.copy(wantPos); attractCam.aim.copy(wantAim); attractCam.init = true; }
      attractCam.pos.lerp(wantPos, 1 - Math.exp(-dt * 0.8));
      attractCam.aim.lerp(wantAim, 1 - Math.exp(-dt * 1.2));
      camWorld.copy(attractCam.pos);
      camera.position.copy(anchor);
      camera.lookAt(anchor.clone().add(attractCam.aim.clone().sub(attractCam.pos)));
      camera.updateMatrixWorld();
      return;
    }
    if (mode === 'select') {
      // Stationary view from the station toward the planet, ships in front.
      camera.fov = info.portrait ? 60 : 46;
      camera.aspect = v.w / v.h;
      camera.updateProjectionMatrix();
      camWorld.set(-30, 26, -70);
      camera.position.copy(anchor);
      camera.lookAt(anchor.clone().add(new THREE.Vector3(0.12, -0.02, 1)));
      return;
    }
    const s = {
      position: v3(flight.position), yaw: flight.yaw, pitch: flight.pitch, bank: flight.bank,
      speed: flight.speed, lookYaw: flight.lookYaw, lookPitch: flight.lookPitch,
    };
    const r = camRig.update(dt, {
      ship: s, shipObject: world.ship.group, bounds: world.ship.bounds, radius: world.ship.radius,
      anchor, planetWorld: world.planetCenter, width: v.w, height: v.h, portrait: info.portrait,
      reducedMotion: profile.settings.reducedMotion, obstacles: mode === 'flight' ? obstacles : null,
    });
    camWorld.copy(r.worldPosition);
    flatCam.yaw = flight.yaw;
  }

  // ------------------------------------------------------------- HUD model
  function project(worldPoint) {
    const v = viewport();
    const pr = world.toRender(worldPoint, tmp);
    const ndc = pr.clone().project(camera);
    const behind = ndc.z > 1 || pr.clone().sub(camera.position).dot(camera.getWorldDirection(tmp2)) < 0;
    let x = (ndc.x * 0.5 + 0.5) * v.w, y = (-ndc.y * 0.5 + 0.5) * v.h;
    const margin = 48;
    // Arrows stay below the Project 0 toolbar and above the bottom controls.
    const topInset = 92, bottomInset = input.device === 'touch' ? 190 : 170;
    const onScreen = !behind && x > margin && x < v.w - margin && y > margin && y < v.h - margin;
    let angle = 0;
    if (!onScreen) {
      let dx = x - v.w / 2, dy = y - v.h / 2;
      if (behind) { dx = -dx; dy = -dy; }
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1;
      const cy = (topInset + v.h - bottomInset) / 2, halfH = Math.max(40, (v.h - bottomInset - topInset) / 2);
      const sx = (v.w / 2 - margin) / Math.abs(dx || 1e-6), sy = halfH / Math.abs(dy || 1e-6);
      const s = Math.min(sx, sy);
      x = v.w / 2 + dx * s; y = cy + dy * s;
      angle = Math.atan2(-dx, dy);
    }
    return { x, y, onScreen, angle };
  }

  function computeHudModel() {
    const p = v3(flight.position);
    const obj = objective(profile, layout.nodes, [p.x, p.y, p.z]);
    let target = null, kind = 'node';
    if (obj.kind === 'node' && obj.target) {
      const n = layout.nodes.find(x => x.id === obj.target);
      if (n) target = new THREE.Vector3(...n.position);
    } else if (obj.kind === 'station') {
      target = world.station.dockPoint(new THREE.Vector3()).sub(world.universe.position);
      kind = 'station';
    }
    const distance = target ? Math.max(0, p.distanceTo(target) - (kind === 'node' ? 8 : 0)) : 0;
    const markers = [];
    if (target && (mode === 'flight' || mode === 'launching')) {
      const mk = project(target);
      mk.kind = kind;
      mk.progress = scanning && scanning.node.id === obj.target ? scanning.t / scanning.duration
        : mining && mining.node.id === obj.target ? mining.t / mining.duration : 0;
      markers.push(mk);
    }
    while (toasts.length && toasts[0].until < game.time) toasts.shift();
    if (scanCard && scanCard.until < game.time) scanCard = null;
    const interact = interactState();
    const touchMode = input.device === 'touch';
    let prompt = null;
    if (mode === 'flight') {
      if (interact === 'dock') prompt = { text: 'Dock at Haven Outpost', action: 'interact' };
      else if (interact === 'collect' && !mining) prompt = { text: 'Collect resources', action: 'interact' };
      else if (!scanning && !mining) {
        const near = nearestNode(stats.scanRange);
        if (near && !profile.mission.scanned.includes(near.node.id)) prompt = { text: 'Scan the signal', action: 'scan' };
      }
      if (scanning) prompt = { text: `Scanning ${Math.round(scanning.t / scanning.duration * 100)}%`, action: 'scan' };
      if (mining) prompt = { text: `Mining ${Math.round(mining.t / mining.duration * 100)}%`, action: 'interact' };
    }
    hudModel = {
      mode,
      sector: SECTOR.name,
      sub: SECTOR.subtitle,
      cargo: { cryon: profile.cargo.cryon, ferrite: profile.cargo.ferrite, used: cargoUsed(profile), capacity: stats.capacity },
      bank: { ...profile.bank },
      objective: { ...obj, distance, distanceLabel: distance > 0 ? formatDistance(distance) : '' },
      prompt,
      speed: flight.speed,
      cruise: profile.settings.autoCruise,
      boosting: lastInput.boost > 0.5,
      braking: lastInput.brake > 0.3,
      scan: scanning ? { active: true, progress: scanning.t / scanning.duration } : null,
      mining: mining ? { active: true, progress: mining.t / mining.duration } : null,
      toasts: toasts.slice(),
      scanCard,
      interact,
      canScan: Boolean(nearestNode(stats.scanRange)),
      warning,
      device: input.device,
      touch: touchMode,
      markers,
      docked: mode === 'docked',
    };
    return hudModel;
  }

  // ------------------------------------------------------------- remote explorers
  // Positions are shared by Project 0 inside the lot box; we map the sector
  // into that box (scale k) and back, then draw each explorer's small ship.
  const boxScale = Math.min((lot.width ?? 16) / 2 - 0.5, (lot.height ?? 30) / 2 - 0.5) / (SECTOR.playRadius * 1.15);
  function syncPresence(dt) {
    if (!p0.me) return;
    const p = flight.position;
    try {
      const pos = p0.me.position;
      const x = clamp(p.x * boxScale, -(lot.width ?? 16) / 2 + 0.2, (lot.width ?? 16) / 2 - 0.2);
      const y = clamp(anchor.y + p.y * boxScale, 0.2, (lot.height ?? 30) - 0.2);
      const z = clamp(p.z * boxScale, -(lot.depth ?? 16) / 2 + 0.2, (lot.depth ?? 16) / 2 - 0.2);
      if (pos?.set) pos.set(x, y, z); else if (pos) { pos.x = x; pos.y = y; pos.z = z; }
      p0.me.yaw = flight.yaw;
    } catch { /* presence is best effort */ }
    const players = p0.players;
    if (!players?.forEach) return;
    const seen = new Set();
    players.forEach((pl, id) => {
      if (pl.isMe || id === p0.me?.id) return;
      seen.add(id);
      let r = world.remote.get(id);
      if (!r) {
        const ship = buildShip({ vessel: 'survivor' });
        ship.group.scale.setScalar(0.9);
        world.universe.add(ship.group);
        r = { object: ship.group, ship, pos: new THREE.Vector3(), yaw: 0, init: false };
        world.remote.set(id, r);
      }
      const target = new THREE.Vector3(pl.position.x / boxScale, (pl.position.y - anchor.y) / boxScale, pl.position.z / boxScale);
      if (!r.init) { r.pos.copy(target); r.init = true; }
      r.pos.lerp(target, Math.min(1, dt * 6));
      r.yaw += wrap((pl.yaw ?? 0) - r.yaw) * Math.min(1, dt * 6);
      r.object.position.copy(r.pos);
      r.object.rotation.set(0, r.yaw, 0);
      r.object.visible = mode !== 'hangar' && mode !== 'select';
      r.object.updateMatrix();
    });
    for (const [id, r] of world.remote) if (!seen.has(id)) { world.universe.remove(r.object); r.ship.dispose(); world.remote.delete(id); }
  }

  // ------------------------------------------------------------- game API for screens
  let lastInput = { boost: 0, brake: 0 };
  const game = {
    p0, ui, input, world, layout, overlay, time: 0,
    get profile() { return profile; },
    get stats() { return stats; },
    get hasSave() { return hasSave; },
    get mode() { return mode; },
    get quality() { return qualityName; },
    get software() { return soft; },
    get pipeline() { return pipeline; },
    get camera() { return camera; },
    get anchor() { return anchor; },
    hudModel: () => hudModel ?? computeHudModel(),
    formatDistance,

    hudAction(id) {
      switch (id) {
        case 'scan': doScan(); break;
        case 'interact': doInteract(); break;
        case 'pause': game.pause(); break;
        case 'map': game.openMap(); break;
        case 'hangar': game.openHangar(); break;
        case 'base': game.openBase(); break;
        case 'zoomIn': camRig.zoomBy(-0.12); break;
        case 'zoomOut': camRig.zoomBy(0.12); break;
        case 'boost': case 'brake': break; // held buttons are read by the input hub
        default: break;
      }
    },
    pause() {
      if (mode === 'flight' || mode === 'docked') { paused = true; ui.push('pause'); }
    },
    resume() {
      paused = false;
      if (ui.is('pause')) ui.pop();
    },
    startNewJourney(vessel = 'survivor') {
      profile = newProfile(vessel);
      hasSave = true;
      applyStats();
      world.setShip(profile.vessel, profile.equipped);
      world.station.rebuild(profile.base, profile.powered);
      for (const n of layout.nodes) world.field.setNodeAmount(n.id, 1);
      rebuildObstacles();
      game.applySettings();
      enterFlightFromDock();
      saveNow();
    },
    continueJourney() {
      if (!hasSave) return;
      enterFlightFromDock();
    },
    toMenu() {
      paused = false; scanning = null; mining = null; docking = null; launching = null;
      mode = 'attract';
      hideShowroom();
      world.universe.visible = true;
      camRig.reset();
      if (saveQueued) saveNow();
      ui.show('menu');
    },
    openSelect() {
      mode = 'select';
      world.shipRoot.visible = false;
      world.field.group.visible = false;
      world.station.group.visible = false;
      ui.show('select');
    },
    restartSector() {
      paused = false; scanning = null; mining = null;
      enterFlightFromDock();
    },
    openHangar(from) {
      if (!hasSave) return;
      game.returnMode = from ?? (mode === 'docked' ? 'docked' : mode === 'attract' ? 'attract' : 'flight');
      paused = true; scanning = null; mining = null;
      mode = 'hangar';
      ui.show('hangar');
    },
    openBase(from) {
      if (!hasSave) return;
      game.returnMode = from ?? (mode === 'docked' ? 'docked' : mode === 'attract' ? 'attract' : 'flight');
      paused = true; scanning = null; mining = null;
      mode = 'base';
      ui.show('base');
    },
    openMap(from) {
      game.returnMode = from ?? (mode === 'docked' ? 'docked' : mode === 'attract' ? 'attract' : 'flight');
      if (mode === 'flight' || mode === 'docked') paused = true;
      game.mapReturnMode = mode;
      ui.show('map');
    },
    closeSubscreen() {
      hideShowroom();
      world.universe.visible = true;
      world.shipRoot.visible = true;
      const back = game.returnMode ?? 'flight';
      paused = false;
      if (back === 'attract') { game.toMenu(); return; }
      if (back === 'docked') { mode = 'docked'; ui.show('hud'); ui.push('docked'); return; }
      mode = 'flight';
      camRig.reset();
      ui.show('hud');
    },
    // Hangar operations (resources come from the station bank).
    equip(socket, level) {
      if (level !== 1 && !profile.inventory.includes(moduleId(socket, level))) return false;
      const prev = profile.equipped[socket];
      if (prev === level) return false;
      // Unequipped modules return to the inventory.
      if (prev !== 1 && !profile.inventory.includes(moduleId(socket, prev))) profile.inventory.push(moduleId(socket, prev));
      profile.equipped[socket] = level;
      applyStats();
      world.setShip(profile.vessel, profile.equipped);
      saveSoon();
      return true;
    },
    craft(socket, level) {
      const def = MODULES[socket]?.[level - 1];
      if (!def?.cost || profile.inventory.includes(moduleId(socket, level))) return false;
      if (!spend(profile.bank, def.cost)) return false;
      profile.inventory.push(moduleId(socket, level));
      saveSoon();
      return true;
    },
    canAfford: cost => canAfford(profile.bank, cost),
    // Base operations.
    placeModule(type, q, r) {
      const def = BASE_MODULES.find(m => m.type === type);
      if (!def) return { ok: false, reason: 'Unknown module' };
      const status = placementStatus(profile.base, q, r);
      if (!status.ok) return status;
      if (!spend(profile.bank, def.cost)) return { ok: false, reason: 'Not enough resources in the station bank' };
      profile.base.push({ q, r, type });
      applyStats();
      world.station.rebuild(profile.base, profile.powered);
      rebuildObstacles();
      saveSoon();
      return { ok: true };
    },
    placementStatus: (q, r) => placementStatus(profile.base, q, r),
    localToHex,
    hexToLocal,
    showroomShip,
    hideShowroom,
    hangarPad,
    setCameraWorld(p) { camWorld.copy(p); },
    camWorld,
    setSetting(key, value) {
      profile.settings[key] = value;
      game.applySettings(key);
      saveSoon();
    },
    applySettings(changed) {
      input.setBindings(profile.settings.bindings);
      input.setOptions({ invert: profile.settings.invertY, sens: profile.settings.sensitivity });
      camRig.setBaseZoom(profile.settings.cameraZoom);
      audio.configure({ sound: profile.settings.sound, musicEnabled: profile.settings.music });
      applyStats();
      if (!changed || changed === 'quality') {
        const next = resolveQuality(profile.settings.quality);
        if (next !== qualityName) { qualityName = next; pipeline.setQuality(qualityName); resize(true); }
      }
    },
    resetProgress() {
      profile = newProfile();
      hasSave = false;
      applyStats();
      world.setShip(profile.vessel, profile.equipped);
      world.station.rebuild(profile.base, false);
      for (const n of layout.nodes) world.field.setNodeAmount(n.id, 1);
      rebuildObstacles();
      game.applySettings();
      p0.save?.(null);
    },
    saveNow,
    // Read-only snapshot for local test scripts (never used by the game itself).
    debugState() {
      const p = flight.position;
      const obj = objective(profile, layout.nodes, [p.x, p.y, p.z]);
      let target = null;
      if (obj.kind === 'node' && obj.target) target = layout.nodes.find(n => n.id === obj.target)?.position ?? null;
      else if (obj.kind === 'station') { const d = world.station.dockPoint(new THREE.Vector3()).sub(world.universe.position); target = [d.x, d.y, d.z]; }
      return {
        mode, top: ui.topId, pos: [p.x, p.y, p.z], yaw: flight.yaw, pitch: flight.pitch, speed: flight.speed,
        step: profile.mission.step, cargo: { ...profile.cargo }, bank: { ...profile.bank }, scanned: [...profile.mission.scanned],
        target, targetId: obj.target, kind: obj.kind, scanRange: stats.scanRange, scanning: Boolean(scanning), mining: Boolean(mining),
        interact: interactState(), fraction: camRig.state.measured, quality: qualityName,
        equipped: { ...profile.equipped }, inventory: [...profile.inventory], powered: profile.powered,
      };
    },
  };

  function enterFlightFromDock() {
    paused = false; scanning = null; mining = null; docking = null;
    hideShowroom();
    world.universe.visible = true;
    world.shipRoot.visible = true;
    placeAtDock(2.4);
    camRig.reset();
    ui.show('hud');
    launch();
  }

  // ------------------------------------------------------------- screens
  ui.register('hud', createHud(game));
  registerScreens(ui, game);
  ui.register('hangar', createHangarScreen(game));
  ui.register('map', createMapScreen(game));
  ui.register('base', createBaseScreen(game));

  // ------------------------------------------------------------- events
  let lastSize = '';
  function resize(force = false) {
    const v = viewport();
    const key = `${v.w}x${v.h}@${v.pr}`;
    if (!force && key === lastSize) return;
    lastSize = key;
    pipeline.resize(v.w, v.h, v.pr);
    ui.resize(v.w, v.h, v.pr);
    camera.aspect = v.w / v.h;
    camera.updateProjectionMatrix();
  }
  resize(true);

  const safe = fn => e => { try { fn(e ?? {}); } catch (err) { p0.log?.('input error:', err?.message); } };
  let pointerLogged = false;
  p0.on?.('pointerdown', safe(e => {
    if (!pointerLogged) { pointerLogged = true; p0.log?.('[xplorator] pointer fields:', Object.keys(e).join(','), 'touch=' + Boolean(e.touch)); }
    if (e.touch) input.device = 'touch';
    ui.pointerDown(e);
  }));
  p0.on?.('pointermove', safe(e => ui.pointerMove(e)));
  p0.on?.('pointerup', safe(e => ui.pointerUp(e)));
  p0.on?.('wheel', safe(e => {
    const dy = e.deltaY ?? e.dy ?? e.y ?? 0;
    if (ui.topId === 'map') ui.screen('map').wheel?.(dy);
    else if (mode === 'flight') camRig.zoomBy(Math.sign(dy) * 0.08);
  }));
  p0.on?.('keydown', safe(e => input.latchKey(typeof e === 'string' ? e : e.code)));
  p0.on?.('resize', () => resize());
  p0.on?.('pad', active => { input.device = active ? 'pad' : 'kbm'; ui.invalidate(); });
  p0.on?.('pointerlock', () => ui.cancelTouches());
  p0.on?.('update', () => toast('A new version is ready next time you enter', '#70E2F4'));

  // Start in the menu with the attract flight behind it.
  placeAtDock(4);
  updateAttract(0.016);
  ui.show('menu');

  // ------------------------------------------------------------- warm-up
  loading(0.75, 'warming the engines');
  updateCamera(0.016);
  world.setCameraWorld(camWorld, anchor);
  world.updateEffects(0.016, 0, { camera, viewportHeight: viewport().h, pixelRatio: viewport().pr, thrust: 0.5, boosting: false });
  // Make every material visible once (showroom pad included) for compilation.
  hangarPad.visible = true;
  // Build the four vessel previews now, so the selection screen opens without a stall.
  for (const v of VESSELS) showroomShip(`select-${v.id}`, v.id, undefined).ship.group.visible = true;
  fx.prepare();
  const warmMs = await pipeline.warmUp();
  hangarPad.visible = false;
  hideShowroom();
  fx.reset();
  // Compile time is not frame time: only a software renderer (or an extreme
  // warm-up) starts on the light version; slow frames are handled at runtime.
  if (profile.settings.quality === 'auto' && qualityName !== 'low' && (soft.software || warmMs > 15000)) {
    qualityName = 'low';
    pipeline.setQuality('low');
    resize(true);
  }
  p0.log?.(`[xplorator] renderer=${soft.name} quality=${qualityName} warmup=${Math.round(warmMs)}ms`);
  try { p0.hud?.(input.device === 'touch' ? HELP_TEXT_TOUCH : HELP_TEXT); } catch { /* optional */ }
  audio.configure({ sound: profile.settings.sound, musicEnabled: profile.settings.music });
  loading(1, 'Outer Verge');
  // Let the final progress message reach the host before start() resolves.
  await new Promise(resolve => setTimeout(resolve, 60));

  // ------------------------------------------------------------- frame loop
  let slowFrames = 0;
  p0.loop((dtRaw) => {
    const dt = Math.min(Math.max(Number(dtRaw) || 0, 0), 0.1);
    game.time += dt;
    resize();
    const inp = input.poll(dt, { menu: ui.menuInput });
    lastInput = inp;
    ui.handleEdges(inp.edges);

    if (mode === 'attract') updateAttract(dt);
    else if (mode === 'flight' && !paused) updateFlight(dt, inp);
    else if (mode === 'docking') updateDocking(dt);
    else if (mode === 'launching') updateLaunching(dt);
    else if (mode === 'docked') { applyShipTransform(); flight.speed = 0; }

    if (mode === 'hangar') ui.screen('hangar').update3d?.(dt);
    else if (mode === 'base') ui.screen('base').update3d?.(dt);
    else if (mode === 'select') ui.screen('select').update3d?.(dt);
    if (mode !== 'hangar' && mode !== 'base') updateCamera(dt);

    world.setCameraWorld(camWorld, anchor);
    const v = viewport();
    const showShip = mode !== 'hangar' && mode !== 'select';
    world.shipRoot.visible = showShip;
    world.updateEffects(dt, game.time, {
      camera, viewportHeight: v.h * pipeline.pixelRatio, pixelRatio: pipeline.pixelRatio,
      thrust: mode === 'flight' ? Math.max(inp.boost, 0.3) : 0.5, boosting: mode === 'flight' && inp.boost > 0.5, showShip,
    });
    fx.update(dt, { mining, shipWorld: world.shipRoot, minerSocket: world.ship.sockets.miner });
    syncPresence(dt);
    computeHudModel();
    ui.update(dt);

    if (saveQueued) { saveTimer -= dt; if (saveTimer <= 0) saveNow(); }
    pipeline.render();
    pipeline.adapt(dt * 1000, game.time);
    // Very slow device (or the review's software renderer): drop to the light version.
    if (dt > 0.2 && game.time > 2 && game.time < 12) slowFrames++;
    if (slowFrames > 6 && qualityName !== 'low' && profile.settings.quality === 'auto') {
      qualityName = 'low'; pipeline.setQuality('low'); resize(true); slowFrames = 0;
    }
  });

  return game;
}

// Soft hex pad and rings under the ship in the hangar.
function createHangarPad() {
  const group = new THREE.Group();
  group.name = 'HangarPad';
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.5, 0.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x07102a, roughness: 0.75, metalness: 0.25, flatShading: true }),
  );
  deck.position.y = -0.55;
  group.add(deck);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.62, 0.72) });
  for (const r of [4.0, 2.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.43;
    group.add(ring);
  }
  group.visible = false;
  return group;
}

export { VESSELS };
