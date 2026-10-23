import test from "node:test";
import assert from "node:assert/strict";
import { generatePlanet, PLANET_TYPES } from "../src/planet-generator.mjs";

test("reproducible result for a fixed seed", () => {
  assert.deepEqual(generatePlanet(42), generatePlanet(42));
});
test("seed changes at least some properties", () => {
  assert.notDeepEqual(generatePlanet(42), generatePlanet(43));
});
test("ATT suggestion bounded, separate from real payment", () => {
  for (let i = 0; i < 2000; i++) {
    const p = generatePlanet(i);
    assert.ok(p.suggestedAttPrice >= 2 && p.suggestedAttPrice <= 20);
    assert.equal(typeof p.disclaimer, "string");
    assert.ok(p.resources.every(x => x.initial >= 0 && x.remaining === x.initial));
    assert.ok(PLANET_TYPES.some(t => t.key === p.class));
  }
});
test("free starter is limited, repeatable and never a token charge", () => {
  const p = generatePlanet(17, {starter:true});
  assert.equal(p.id, "Haven-01");
  assert.equal(p.suggestedAttPrice, 0);
  assert.ok(p.resources.every(x => x.initial <= 260));
  assert.deepEqual(generatePlanet(17,{starter:true}), p);
});
test("invalid seeds are rejected", () => {
  for (const value of [-1, 1.5, 2**32, NaN, "42"]) {
    assert.throws(() => generatePlanet(value), RangeError);
  }
});
