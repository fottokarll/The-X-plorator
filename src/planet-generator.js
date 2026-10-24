// Deterministic, client-side concept generator — NEVER authoritative for ATT sales.
export const PLANET_TYPES = [
  { key: "oceanic", label: "Oceanic", palette: ["#77F4DC", "#238BA7", "#1C2C67"], resources: ["ice", "crystal", "iron"], mood: "quiet cyan piano" },
  { key: "volcanic", label: "Volcanic", palette: ["#FFD390", "#F06E76", "#4B285C"], resources: ["iron", "crystal", "sulfur"], mood: "warm low synth" },
  { key: "frozen", label: "Frozen", palette: ["#EBFCFF", "#88B7E8", "#354575"], resources: ["ice", "crystal", "iron"], mood: "high airy piano" },
  { key: "verdant", label: "Verdant", palette: ["#F6E7B3", "#5DC9A3", "#163E60"], resources: ["biomass", "ice", "iron"], mood: "hopeful piano" },
  { key: "gas", label: "Gas Giant", palette: ["#FFE4A6", "#BE7CB7", "#3A3268"], resources: ["hydrogen", "crystal", "ice"], mood: "subtle deep ambient" }
];

function rng32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function generatePlanet(seed, options = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
    throw new RangeError("Seed must be a uint32 integer");
  }
  const rand = rng32(seed ^ 0xA57B1023);
  const type = PLANET_TYPES[Math.floor(rand() * PLANET_TYPES.length)];
  const sizeIndex = Math.floor(rand() * 3);
  const size = ["small", "medium", "large"][sizeIndex];
  const richness = 0.15 + rand() * 0.85;
  const habitability = type.key === "gas" ? 0 : Math.round(rand() * 100);
  const rings = rand() > 0.4;
  const tilt = Math.round((rand() - 0.5) * 52);
  const resourceCount = 2 + Math.floor(rand() * 2);
  const resources = type.resources.slice(0, resourceCount).map((kind, i) => {
    const abundance = Math.floor((180 + rand() * 1300) * (0.65 + sizeIndex * 0.55) * (0.45 + richness));
    return { kind, initial: abundance, remaining: abundance };
  });
  const total = resources.reduce((n, v) => n + v.initial, 0);
  const scarce = resources.some(x => x.kind === "crystal" || x.kind === "hydrogen");
  const rawPrice = 2 + Math.floor(total / 1550) + Math.floor(habitability / 25) + (scarce ? 2 : 0);
  const starter = options.starter === true;
  const deposits = starter
    ? resources.map(x => ({...x, initial: Math.min(x.initial, 260), remaining: Math.min(x.remaining, 260)}))
    : resources;
  return {
    schema: 1,
    id: starter ? "Haven-01" : "planet-" + seed.toString(16).padStart(8, "0"),
    seed,
    starter,
    class: type.key,
    classLabel: type.label,
    size,
    richness: Number(richness.toFixed(3)),
    habitability,
    visual: { palette: [...type.palette], rings, tiltDegrees: tilt, atmosphere: type.mood },
    resources: deposits,
    suggestedAttPrice: starter ? 0 : Math.max(2, Math.min(20, rawPrice)),
    disclaimer: "Mock design values only. Not a real Project 0 ATT offer."
  };
}
