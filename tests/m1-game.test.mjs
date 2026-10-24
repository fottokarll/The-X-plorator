import test from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, sanitizeProfile, serializeProfile, SAVE_VERSION } from '../src/game/profile.js';
import { objective, onApproach, onScanned, onCollected, onNearDock, onDocked, regrowNodes, GOAL_CRYON, cargoUsed } from '../src/game/mission.js';
import { placementStatus, hexToLocal, localToHex, canAfford, spend, STARTER_BASE, hexDistance } from '../src/game/base.js';
import { computeStats, MODULES, VESSELS } from '../src/game/ships.js';
import { buildSectorLayout } from '../src/game/sector.js';
import { SECTOR } from '../src/game/config.js';
import { createContactTracker } from '../src/input/pointer-contacts.js';
import { rebind, sanitizeBindings, DEFAULT_BINDINGS } from '../src/input/keyboard.js';
import { FLIGHT_PRESETS, profileFor } from '../src/flight/profiles.js';
import { createFlightState, stepFlight } from '../src/flight/assisted-flight.js';

const layout = buildSectorLayout();
const crystals = layout.nodes.filter(n => n.type === 'crystal');

test('mission: explore -> scan -> collect -> return -> dock completes First Light', () => {
  const p = newProfile();
  const stats = computeStats(p.vessel, p.equipped);
  let collected = 0;
  for (const node of crystals) {
    if (p.mission.step === 'return') break;
    assert.equal(objective(p, layout.nodes, [0, 0, 0]).kind, 'node');
    assert.ok(onApproach(p, node, 100, stats.scanRange) || p.mission.step === 'scan');
    onScanned(p, node);
    assert.equal(p.mission.step, 'collect');
    const r = onCollected(p, node, { capacity: stats.capacity, yieldFactor: 1, playSeconds: 10 });
    assert.ok(r.amount > 0);
    collected += r.amount;
  }
  assert.ok(collected >= GOAL_CRYON);
  assert.equal(p.mission.step, 'return');
  assert.equal(objective(p, layout.nodes, [0, 0, 0]).kind, 'station');
  onNearDock(p, 50);
  assert.equal(p.mission.step, 'dock');
  const d = onDocked(p);
  assert.equal(d.completed, true);
  assert.equal(p.mission.step, 'complete');
  assert.equal(p.powered, true);
  assert.equal(cargoUsed(p), 0);
  assert.equal(p.bank.cryon, collected);
});

test('mission: collecting ore never resets the crystal objective', () => {
  const p = newProfile();
  const ore = layout.nodes.find(n => n.type === 'ore');
  onScanned(p, crystals[0]);
  assert.equal(p.mission.step, 'collect');
  onScanned(p, ore);
  onCollected(p, ore, { capacity: 12, yieldFactor: 1, playSeconds: 0 });
  assert.equal(p.mission.step, 'collect');
  assert.equal(p.mission.target, crystals[0].id);
  assert.ok(p.cargo.ferrite > 0);
});

test('mission: cargo capacity is respected and spent nodes regrow', () => {
  const p = newProfile();
  p.cargo.ferrite = 11;
  const r = onCollected(p, crystals[0], { capacity: 12, yieldFactor: 1, playSeconds: 5 });
  assert.equal(r.amount, 1);
  assert.equal(r.full, true);
  assert.equal(p.nodes[crystals[0].id].amount, 0);
  assert.deepEqual(regrowNodes(p, 10), []);
  assert.deepEqual(regrowNodes(p, 5 + 241), [crystals[0].id]);
  assert.equal(p.nodes[crystals[0].id].amount, 1);
});

test('profile: sanitise rejects junk, clamps values and only allows the free vessel', () => {
  assert.equal(sanitizeProfile(null), null);
  assert.equal(sanitizeProfile({ v: 99 }), null);
  const evil = {
    v: SAVE_VERSION, vessel: 'exodus', equipped: { engine: 9, hull: -3 }, inventory: ['engine-3', 'bogus', 'engine-3'],
    cargo: { cryon: 1e9 }, bank: { ferrite: -5 }, base: [{ q: 0, r: 0, type: 'hub' }, { q: 9, r: 9, type: 'dock' }, { q: 1, r: 0, type: 'casino' }],
    settings: { quality: 'ultra', sensitivity: 99, bindings: { boost: ['KeyZ'] } }, mission: { step: 'hacked' },
  };
  const p = sanitizeProfile(evil);
  assert.equal(p.vessel, 'survivor');
  assert.equal(p.equipped.engine, MODULES.engine.length);
  assert.equal(p.equipped.hull, 1);
  assert.deepEqual(p.inventory, ['engine-3']);
  assert.equal(p.cargo.cryon, 999);
  assert.equal(p.bank.ferrite, 0);
  assert.deepEqual(p.base, [{ q: 0, r: 0, type: 'hub' }]);
  assert.equal(p.settings.quality, 'auto');
  assert.equal(p.settings.sensitivity, 1.6);
  assert.deepEqual(p.settings.bindings.boost, ['KeyZ']);
  assert.equal(p.mission.step, 'locate');
});

test('profile: a full save stays under the 16 KB Project 0 limit and round-trips', () => {
  const p = newProfile();
  p.inventory = Object.keys(MODULES).flatMap(s => [2, 3].map(l => `${s}-${l}`));
  for (let i = 0; i < 30; i++) p.nodes[`node-${i}`] = { amount: 0.5, regrowAt: 1234.5 };
  const saved = serializeProfile(p);
  assert.ok(JSON.stringify(saved).length < 16000);
  assert.deepEqual(sanitizeProfile(saved).inventory.length, p.inventory.length);
});

test('base: hex maths round-trips and placement requires a free, connected hex', () => {
  for (const [q, r] of [[0, 0], [1, -1], [-2, 3], [3, 0]]) {
    const [x, z] = hexToLocal(q, r);
    assert.deepEqual(localToHex(x, z), [q, r]);
  }
  const tiles = STARTER_BASE.map(t => ({ ...t }));
  assert.equal(placementStatus(tiles, 0, 0).ok, false);
  assert.equal(placementStatus(tiles, 1, 0).ok, true);
  assert.equal(placementStatus(tiles, 3, -3).ok, false);
  assert.equal(hexDistance(3, -3), 3);
  const bank = { cryon: 2, ferrite: 5 };
  assert.equal(canAfford(bank, { ferrite: 6 }), false);
  assert.equal(spend(bank, { ferrite: 4, cryon: 2 }), true);
  assert.deepEqual(bank, { cryon: 0, ferrite: 1 });
});

test('ships: module levels change stats; paid vessels are not available in M1', () => {
  const base = computeStats('survivor', { engine: 1, hull: 1, reactor: 1, scanner: 1, cargo: 1, shield: 1, miner: 1 });
  const up = computeStats('survivor', { engine: 3, hull: 1, reactor: 1, scanner: 2, cargo: 3, shield: 1, miner: 1 });
  assert.ok(up.speedFactor > base.speedFactor);
  assert.ok(up.scanRange > base.scanRange);
  assert.ok(up.capacity > base.capacity);
  assert.deepEqual(VESSELS.filter(v => v.available).map(v => v.id), ['survivor']);
  for (const v of VESSELS) assert.equal(typeof v.att, 'number');
});

test('sector: layout is deterministic and keeps nodes clear of the station', () => {
  const a = buildSectorLayout(), b = buildSectorLayout();
  assert.deepEqual(a, b);
  for (const n of a.nodes) assert.ok(Math.hypot(...n.position) > 200);
  for (const r of a.rocks) assert.ok(Math.hypot(...r.position) > 110);
  assert.ok(a.rocks.length > 40 && a.rocks.length <= SECTOR.field.rocks);
});

test('contacts: two fingers are tracked without pointer ids (delta matching)', () => {
  const t = createContactTracker();
  const a = t.down({ x: 100, y: 600, touch: true });
  const b = t.down({ x: 330, y: 700, touch: true });
  // Finger B moves first; its event carries its own previous endpoint via dx/dy.
  assert.equal(t.move({ x: 340, y: 690, dx: 10, dy: -10, touch: true }).id, b.id);
  assert.equal(t.move({ x: 120, y: 580, dx: 20, dy: -20, touch: true }).id, a.id);
  assert.equal(t.up({ x: 340, y: 690, dx: 0, dy: 0, touch: true }).id, b.id);
  assert.equal(t.size, 1);
  assert.equal(t.up({ x: 120, y: 580, touch: true }).id, a.id);
  assert.equal(t.size, 0);
});

test('keyboard: rebinding moves a key, refuses reserved keys and survives sanitising', () => {
  let r = rebind(DEFAULT_BINDINGS, 'scan', 'KeyE');
  assert.equal(r.ok, true);
  assert.equal(r.bindings.scan[0], 'KeyE');
  assert.ok(!r.bindings.interact.includes('KeyE'));
  assert.ok(r.bindings.interact.length > 0);
  r = rebind(DEFAULT_BINDINGS, 'boost', 'Enter');
  assert.equal(r.ok, false);
  assert.deepEqual(sanitizeBindings({ boost: 'nope' }).boost, DEFAULT_BINDINGS.boost);
});

test('flight presets: auto-cruise, engine upgrades go faster, auto-level drifts the nose level', () => {
  for (const name of Object.keys(FLIGHT_PRESETS)) {
    const s = createFlightState();
    const p = profileFor(name, { speedFactor: 1, handlingFactor: 1 });
    for (let i = 0; i < 240; i++) stepFlight(s, {}, 1 / 60, p);
    assert.ok(s.speed > p.cruiseSpeed * 0.8, `${name} cruises`);
  }
  const fast = profileFor('tranquil', { speedFactor: 1.3, handlingFactor: 1 });
  assert.ok(fast.cruiseSpeed > FLIGHT_PRESETS.tranquil.cruiseSpeed);
  const s = createFlightState();
  const p = FLIGHT_PRESETS.tranquil;
  for (let i = 0; i < 60; i++) stepFlight(s, { pitch: 1 }, 1 / 60, p);
  const climbed = s.pitch;
  for (let i = 0; i < 300; i++) stepFlight(s, {}, 1 / 60, p);
  assert.ok(climbed > 0.3 && s.pitch < climbed * 0.4);
});
