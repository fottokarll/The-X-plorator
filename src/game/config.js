/**
 * Shared constants for THE X-PLORATOR M1 "Outer Verge".
 * World units are logical metres of the game universe. They are NOT the
 * Project 0 lot's metres: the renderer keeps the camera at the lot's centre and
 * moves the universe around it (floating origin), see render/world-frame.js.
 */

// IMG 07 locked palette (docs/ART_BIBLE.md, handoff ART_DIRECTION_LOCKED.md).
export const PALETTE = Object.freeze({
  abyss: '#071631',
  cobalt: '#123C85',
  violet: '#1B205A',
  lilac: '#985DC8',
  cyan: '#70E2F4',
  azure: '#2189C9',
  white: '#E6F6FD',
  rose: '#E5A1CF',
  gold: '#F8BD78',
});

export const SECTOR = Object.freeze({
  id: 'outer-verge',
  name: 'Outer Verge',
  subtitle: 'Sector 1',
  seed: 0x0323_07,
  // Soft boundary: beyond this radius navigation assist turns the ship home.
  playRadius: 2600,
  // Hero planet, deliberately unreachable: huge, far and luminous (IMG 07).
  // Looking down +z (the start view), +x is screen-left: the planet sits lower-right.
  planet: { center: [-7900, -7300, 13900], radius: 9200, seed: 0x7a11 },
  // Light comes from behind the planet, upper-left, so its limb glows.
  sunDirection: [0.38, 0.55, 0.74],
  station: { position: [0, 0, 0] },
  // The field sits left of the start line so the view toward the planet stays open.
  field: { center: [140, 10, 640], radius: 460, rocks: 72 },
});

export const SHIP_SCALE = Object.freeze({
  length: 2.4,
  boundingRadius: 1.35,
});

// Camera composition contract (handoff CAMERA_WIDE_FOLLOW_LOCKED.md):
// ship ~4-9% of viewport height on desktop, ~5-11% on phones.
export const CAMERA = Object.freeze({
  fovDesktop: 50,
  fovPortrait: 62,
  fovLandscapePhone: 52,
  // Measured as the ship's largest projected extent (height or wingspan) in
  // units of the viewport height: IMG 07 / IMG 05 show roughly 4.5-6%.
  targetFractionDesktop: 0.066,
  targetFractionPhone: 0.08,
  minFraction: 0.04,
  maxFraction: 0.11,
  elevation: 0.2, // radians above the ship's travel line
  lookAhead: 0.55, // fraction of distance the aim point leads the ship
  positionDamping: 2.4,
  aimDamping: 3.2,
  zoomMin: 0.62,
  zoomMax: 1.35,
});

export const RESOURCES = Object.freeze({
  cryon: { id: 'cryon', label: 'Cryon crystal', short: 'Cryon', color: '#70E2F4' },
  ferrite: { id: 'ferrite', label: 'Ferrite ore', short: 'Ferrite', color: '#F8BD78' },
});
