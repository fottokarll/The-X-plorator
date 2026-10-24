import { DEFAULT_FLIGHT_PROFILE } from './assisted-flight.js';

/**
 * Handling presets for the Outer Verge scale (Survivor ~2.4 m long).
 * Both keep auto-cruise, one-stick steering and automatic banking; module
 * levels then scale speed and handling (see game/ships.js).
 */
export const FLIGHT_PRESETS = Object.freeze({
  tranquil: Object.freeze({
    ...DEFAULT_FLIGHT_PROFILE,
    cruiseSpeed: 13, boostSpeed: 36, maxSpeed: 44, acceleration: 9, braking: 22, coastDamping: 3,
    yawRate: 1.15, pitchRate: 0.9, maxPitch: Math.PI * 0.42, turnSmoothing: 5.5,
    autoBank: 0.62, bankSmoothing: 3.6, autoLevel: 0.35,
    freeLookRate: 1.6, freeLookReturn: 2.2,
  }),
  responsive: Object.freeze({
    ...DEFAULT_FLIGHT_PROFILE,
    cruiseSpeed: 15, boostSpeed: 40, maxSpeed: 48, acceleration: 14, braking: 30, coastDamping: 3.5,
    yawRate: 1.55, pitchRate: 1.25, maxPitch: Math.PI * 0.45, turnSmoothing: 9,
    autoBank: 0.55, bankSmoothing: 5, autoLevel: 0.2,
    freeLookRate: 1.9, freeLookReturn: 2.8,
  }),
});

/** Applies loadout stats (engine speed, hull handling) to a base preset. */
export function profileFor(presetName, stats) {
  const base = FLIGHT_PRESETS[presetName] ?? FLIGHT_PRESETS.tranquil;
  const speed = stats?.speedFactor ?? 1;
  const handling = stats?.handlingFactor ?? 1;
  return {
    ...base,
    cruiseSpeed: base.cruiseSpeed * speed,
    boostSpeed: base.boostSpeed * speed,
    maxSpeed: base.maxSpeed * speed,
    acceleration: base.acceleration * speed,
    yawRate: base.yawRate * handling,
    pitchRate: base.pitchRate * handling,
  };
}
