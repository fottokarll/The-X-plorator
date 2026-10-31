/**
 * Vessels and equipment modules. ATT prices are DESIGN PLACEHOLDERS ONLY:
 * there is no payment code anywhere in M1, and paid vessels cannot be chosen.
 * Module upgrades cost in-game resources (Cryon / Ferrite), never ATT.
 */
export const VESSELS = Object.freeze([
  { id: 'survivor', name: 'Survivor', att: 0, crew: 3, cargoBonus: 0, available: true,
    perk: '3 survivors', blurb: 'A small crew, a new chance.',
    benefit: 'Free starter ship. Plays the whole journey.' },
  { id: 'pioneer', name: 'Pioneer', att: 2, crew: 8, cargoBonus: 4, available: false,
    perk: '8 survivors', blurb: 'More crew, more potential.',
    benefit: 'Planned: a larger crew and a little more cargo.' },
  { id: 'colony', name: 'Colony Ship', att: 5, crew: 12, cargoBonus: 16, available: false,
    perk: 'Increased cargo', blurb: 'Bring more resources for your new home.',
    benefit: 'Planned: a freighter with a large hold.' },
  { id: 'exodus', name: 'Exodus Vessel', att: 10, crew: 24, cargoBonus: 24, available: false,
    perk: 'Large crew + fast growth', blurb: 'A true beginning for a new civilisation.',
    benefit: 'Planned: a flagship for a large crew.' },
]);
// Base cargo of the starter Belly Pod (MODULES.cargo level 1), for vessel cards.
export const BASE_CARGO = 12;

export const SOCKET_INFO = Object.freeze({
  engine: { label: 'Engine', stat: 'Speed' },
  hull: { label: 'Hull', stat: 'Handling' },
  reactor: { label: 'Reactor', stat: 'Power' },
  scanner: { label: 'Scanner', stat: 'Scan range' },
  cargo: { label: 'Cargo', stat: 'Capacity' },
  shield: { label: 'Shield', stat: 'Shielding' },
  miner: { label: 'Mining Beam', stat: 'Mining' },
});

// Per socket, per level: display name, stats, crafting cost (null = starter).
export const MODULES = Object.freeze({
  engine: [
    { level: 1, name: 'Ion Drive I', stats: { speedFactor: 1.0 }, cost: null },
    { level: 2, name: 'Ion Drive II', stats: { speedFactor: 1.15 }, cost: { cryon: 6 } },
    { level: 3, name: 'Helix Drive', stats: { speedFactor: 1.3 }, cost: { cryon: 9, ferrite: 6 } },
  ],
  hull: [
    { level: 1, name: 'Frame Mk I', stats: { handlingFactor: 1.0, structure: 100 }, cost: null },
    { level: 2, name: 'Finned Frame', stats: { handlingFactor: 1.12, structure: 130 }, cost: { ferrite: 6 } },
    { level: 3, name: 'Canard Frame', stats: { handlingFactor: 1.24, structure: 170 }, cost: { ferrite: 10, cryon: 4 } },
  ],
  reactor: [
    { level: 1, name: 'Cell Reactor', stats: { power: 120 }, cost: null },
    { level: 2, name: 'Hex Core', stats: { power: 180 }, cost: { cryon: 5, ferrite: 3 } },
    { level: 3, name: 'Lumen Core', stats: { power: 260 }, cost: { cryon: 10, ferrite: 6 } },
  ],
  scanner: [
    { level: 1, name: 'Pulse Scanner', stats: { scanRange: 150, scanTime: 1.6 }, cost: null },
    { level: 2, name: 'Wide Array', stats: { scanRange: 220, scanTime: 1.2 }, cost: { cryon: 4 } },
    { level: 3, name: 'Deep Array', stats: { scanRange: 300, scanTime: 0.9 }, cost: { cryon: 8, ferrite: 4 } },
  ],
  cargo: [
    { level: 1, name: 'Belly Pod', stats: { capacity: 12 }, cost: null },
    { level: 2, name: 'Twin Pods', stats: { capacity: 20 }, cost: { ferrite: 5 } },
    { level: 3, name: 'Freight Pods', stats: { capacity: 32 }, cost: { ferrite: 9, cryon: 3 } },
  ],
  shield: [
    { level: 1, name: 'Veil Shield', stats: { shield: 40 }, cost: null },
    { level: 2, name: 'Prism Shield', stats: { shield: 70 }, cost: { cryon: 5 } },
    { level: 3, name: 'Aurora Shield', stats: { shield: 110 }, cost: { cryon: 9, ferrite: 5 } },
  ],
  miner: [
    { level: 1, name: 'Mining Beam I', stats: { mineTime: 2.2, yieldFactor: 1 }, cost: null },
    { level: 2, name: 'Mining Beam II', stats: { mineTime: 1.6, yieldFactor: 1.34 }, cost: { ferrite: 4, cryon: 2 } },
    { level: 3, name: 'Harmonic Beam', stats: { mineTime: 1.1, yieldFactor: 1.67 }, cost: { ferrite: 8, cryon: 6 } },
  ],
});

export const moduleId = (socket, level) => `${socket}-${level}`;
export const parseModuleId = id => {
  const [socket, level] = String(id).split('-');
  return MODULES[socket] && MODULES[socket][Number(level) - 1] ? { socket, level: Number(level) } : null;
};
export const moduleDef = (socket, level) => MODULES[socket]?.[level - 1] ?? null;

export function computeStats(vesselId, equipped) {
  const vessel = VESSELS.find(v => v.id === vesselId) ?? VESSELS[0];
  const get = s => moduleDef(s, equipped[s] ?? 1)?.stats ?? {};
  const engine = get('engine'), hull = get('hull'), reactor = get('reactor'), scanner = get('scanner');
  const cargo = get('cargo'), shield = get('shield'), miner = get('miner');
  return {
    speedFactor: engine.speedFactor,
    handlingFactor: hull.handlingFactor,
    structure: hull.structure,
    power: reactor.power,
    scanRange: scanner.scanRange,
    scanTime: scanner.scanTime,
    capacity: cargo.capacity + vessel.cargoBonus,
    shield: shield.shield,
    mineTime: miner.mineTime,
    yieldFactor: miner.yieldFactor,
    crew: vessel.crew,
  };
}

/** Stats shown in the hangar, with display values and 0..1 bars. */
export function displayStats(stats, cruiseBase = 13) {
  return [
    { id: 'speed', label: 'Speed', value: `${Math.round(cruiseBase * stats.speedFactor * 10)} m/s`, bar: (stats.speedFactor - 0.8) / 0.6 },
    { id: 'handling', label: 'Handling', value: `${Math.round(stats.handlingFactor * 100)}%`, bar: (stats.handlingFactor - 0.85) / 0.45 },
    { id: 'scan', label: 'Scan', value: `${stats.scanRange} m`, bar: stats.scanRange / 320 },
    { id: 'cargo', label: 'Cargo', value: `${stats.capacity}`, bar: stats.capacity / 40 },
    { id: 'power', label: 'Power', value: `${stats.power} MW`, bar: stats.power / 280 },
    { id: 'shield', label: 'Shield', value: `${stats.shield}`, bar: stats.shield / 120 },
  ];
}
