/**
 * "First Light": the M1 loop EXPLORE -> SCAN -> COLLECT -> RETURN -> DOCK.
 * Pure rules over the profile, so they can be tested without a renderer.
 *
 *   locate  -> fly within scan range of an unspent Cryon crystal asteroid
 *   scan    -> complete a scan of it
 *   collect -> mine it (Cryon goes into cargo)
 *   ...repeat until GOAL Cryon are aboard...
 *   return  -> fly back to Haven Outpost
 *   dock    -> dock on the pad, cargo is delivered, station power restored
 *   complete-> mission summary shown once, then free exploration
 */
export const GOAL_CRYON = 6;
export const REGROW_SECONDS = 240;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function nodeAmount(profile, node) {
  return profile.nodes[node.id]?.amount ?? 1;
}

/** Nearest node of a type that still has material. */
export function nearestNode(profile, nodes, from, type = 'crystal') {
  let best = null, bestD = Infinity;
  for (const n of nodes) {
    if (type && n.type !== type) continue;
    if (nodeAmount(profile, n) < 0.5) continue;
    const d = dist(from, n.position);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best ? { node: best, distance: bestD } : null;
}

export function cargoUsed(profile) {
  return profile.cargo.cryon + profile.cargo.ferrite;
}

/** Current objective for the HUD: text, target kind and target node id. */
export function objective(profile, nodes, shipPos) {
  const m = profile.mission;
  if (m.step === 'locate' || m.step === 'scan' || m.step === 'collect') {
    const aboard = profile.cargo.cryon;
    const near = nearestNode(profile, nodes, shipPos, 'crystal');
    const target = m.target ? nodes.find(n => n.id === m.target) : near?.node;
    const counter = `${Math.min(aboard, GOAL_CRYON)}/${GOAL_CRYON} Cryon`;
    if (m.step === 'scan' && target) return { text: `Scan the crystal asteroid`, detail: counter, kind: 'node', target: target.id };
    if (m.step === 'collect' && target) return { text: `Collect the Cryon crystals`, detail: counter, kind: 'node', target: target.id };
    return { text: 'Fly to the Cryon signal', detail: counter, kind: 'node', target: target?.id ?? null };
  }
  if (m.step === 'return') return { text: 'Return to Haven Outpost', detail: `${profile.cargo.cryon} Cryon aboard`, kind: 'station', target: 'dock' };
  if (m.step === 'dock') return { text: 'Dock at the landing pad', detail: 'Press interact', kind: 'station', target: 'dock' };
  if (m.step === 'complete') return { text: 'Mission complete', detail: 'First Light', kind: 'none', target: null };
  // Free exploration after the first mission.
  const near = nearestNode(profile, nodes, shipPos, null);
  if (cargoUsed(profile) > 0 && near === null) return { text: 'Deliver your cargo at Haven Outpost', detail: '', kind: 'station', target: 'dock' };
  return { text: 'Free exploration', detail: near ? 'Scan and collect resources' : 'Resources are regrowing', kind: near ? 'node' : 'station', target: near ? near.node.id : 'dock' };
}

export function onApproach(profile, node, distance, scanRange) {
  const m = profile.mission;
  if (m.step === 'locate' && node.type === 'crystal' && distance <= scanRange && nodeAmount(profile, node) >= 0.5) {
    m.step = 'scan';
    m.target = node.id;
    return true;
  }
  return false;
}

export function onScanned(profile, node) {
  const m = profile.mission;
  if (!m.scanned.includes(node.id)) m.scanned.push(node.id);
  if (m.step === 'scan' || (m.step === 'locate' && node.type === 'crystal')) {
    m.step = 'collect';
    m.target = node.id;
  }
}

/** Mining result: adds to cargo (bounded by capacity), depletes the node. */
export function onCollected(profile, node, { capacity, yieldFactor = 1, playSeconds = 0 }) {
  const free = Math.max(0, capacity - cargoUsed(profile));
  const amount = Math.min(free, Math.round(node.yield * yieldFactor));
  if (amount <= 0) return { amount: 0, full: true };
  const key = node.type === 'crystal' ? 'cryon' : 'ferrite';
  profile.cargo[key] += amount;
  profile.nodes[node.id] = { amount: 0, regrowAt: playSeconds + REGROW_SECONDS };
  if (node.type === 'crystal') profile.stats.crystals += amount; else profile.stats.ore += amount;
  const m = profile.mission;
  if (!m.collected.includes(node.id)) m.collected.push(node.id);
  // Only crystals advance First Light; ore is a welcome bonus.
  if (node.type === 'crystal' && ['locate', 'scan', 'collect'].includes(m.step)) {
    m.target = undefined;
    m.step = profile.cargo.cryon >= GOAL_CRYON ? 'return' : 'locate';
  }
  return { amount, key, full: cargoUsed(profile) >= capacity };
}

export function onNearDock(profile, distance) {
  if (profile.mission.step === 'return' && distance < 70) profile.mission.step = 'dock';
}

/** Docking delivers cargo to the station bank; completes the first mission. */
export function onDocked(profile) {
  const delivered = { cryon: profile.cargo.cryon, ferrite: profile.cargo.ferrite };
  profile.bank.cryon += delivered.cryon;
  profile.bank.ferrite += delivered.ferrite;
  profile.cargo.cryon = 0;
  profile.cargo.ferrite = 0;
  profile.stats.docks += 1;
  const m = profile.mission;
  let completed = false;
  if ((m.step === 'dock' || m.step === 'return') && delivered.cryon + m.delivered >= GOAL_CRYON) {
    m.delivered += delivered.cryon;
    m.step = 'complete';
    profile.powered = true;
    completed = true;
  } else if (m.step === 'dock' || m.step === 'return') {
    m.delivered += delivered.cryon;
    m.step = 'locate';
  }
  return { delivered, completed };
}

export function regrowNodes(profile, playSeconds) {
  const changed = [];
  for (const [id, n] of Object.entries(profile.nodes)) {
    if (n.amount < 1 && playSeconds >= n.regrowAt) {
      profile.nodes[id] = { amount: 1, regrowAt: 0 };
      changed.push(id);
    }
  }
  return changed;
}
