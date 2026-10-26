import { buildShip as buildShipM1 } from './ship-model.js';
import { buildExplorerMk2 } from './ship-mk2.js';

/**
 * Chooses the model for a vessel. The free Survivor flies the M2 Explorer Mk2;
 * `model: 'm1'` (Settings > Developer > Ship model, or ?ship=m1 locally)
 * brings back the M1 ship for comparison and rollback. The planned paid
 * vessels keep their M1 preview shapes, so the four packages stay distinct.
 * The Mk2 reports the M1 Survivor's gameplay radius for the same loadout, so
 * collisions, docking and mining distances are exactly as before.
 */
export function buildShip({ vessel = 'survivor', loadout, model = 'mk2' } = {}) {
  if (vessel === 'survivor' && model !== 'm1') {
    const reference = buildShipM1({ vessel, loadout });
    const hitRadius = reference.radius;
    reference.dispose();
    return buildExplorerMk2({ loadout, hitRadius });
  }
  const ship = buildShipM1({ vessel, loadout });
  ship.hitRadius = ship.radius;
  ship.model = 'm1';
  return ship;
}
