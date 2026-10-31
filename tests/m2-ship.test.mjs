import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildShip } from '../src/render/ship-builder.js';
import { buildShip as buildShipM1, SOCKETS } from '../src/render/ship-model.js';
import { MK2_EXHAUST } from '../src/render/ship-mk2.js';

const level = lv => Object.fromEntries(SOCKETS.map(s => [s, lv]));
const triangles = ship => { let n = 0; ship.group.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; };

test('Mk2: the free Survivor flies the Explorer Mk2, three draw calls, light geometry', () => {
  for (const lv of [1, 2, 3]) {
    const ship = buildShip({ vessel: 'survivor', loadout: level(lv) });
    assert.equal(ship.model, 'mk2');
    assert.equal(ship.group.children.filter(o => o.isMesh).length, 3);
    assert.ok(triangles(ship) < 3000, `lv${lv}: ${triangles(ship)} triangles`);
    ship.dispose();
  }
});

test('Mk2: same frame as M1 (+Z nose, +Y up) and always exactly two engines', () => {
  for (const lv of [1, 2, 3]) {
    const ship = buildShip({ vessel: 'survivor', loadout: level(lv) });
    assert.equal(ship.nozzles.length, 2);
    for (const n of ship.nozzles) assert.ok(n.z < -1.1, 'nozzles at the rear (-Z)');
    assert.ok(ship.nozzles[0].x < 0 && ship.nozzles[1].x > 0, 'engines side by side');
    assert.ok(ship.sockets.miner.z > 1, 'mining prongs at the nose (+Z)');
    assert.ok(ship.sockets.reactor.y > 0 && ship.sockets.cargo.y < 0, 'dorsal reactor up, cargo belly down');
    for (const s of SOCKETS) assert.ok(ship.sockets[s]?.isVector3, `socket ${s}`);
    const size = ship.bounds.getSize(new THREE.Vector3());
    assert.ok(size.z > size.x * 1.5 && size.x > size.y * 1.8, 'an elongated, flat wedge');
    assert.deepEqual(ship.exhaust, MK2_EXHAUST);
    ship.dispose();
  }
});

test('Mk2: gameplay radius is the M1 Survivor radius for the same loadout (collisions, docking, mining unchanged)', () => {
  for (const lv of [1, 2, 3]) {
    const m1 = buildShipM1({ vessel: 'survivor', loadout: level(lv) });
    const mk2 = buildShip({ vessel: 'survivor', loadout: level(lv) });
    assert.equal(mk2.hitRadius, m1.radius);
    m1.dispose(); mk2.dispose();
  }
});

test('Mk2: the M1 ship is kept for rollback and the paid previews keep their own shapes', () => {
  const m1 = buildShip({ vessel: 'survivor', model: 'm1' });
  assert.equal(m1.model, 'm1');
  assert.equal(m1.hitRadius, m1.radius);
  for (const vessel of ['pioneer', 'colony', 'exodus']) {
    const ship = buildShip({ vessel });
    assert.equal(ship.model, 'm1');
    assert.match(ship.group.name, new RegExp(vessel));
    ship.dispose();
  }
  m1.dispose();
});
