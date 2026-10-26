import test from 'node:test';
import assert from 'node:assert/strict';
import { createTutorial, sanitizeTutorial, taskText, STEPS } from '../src/tutorial/tutorial.js';
import TEXT from '../src/tutorial/text.en.js';
import { DEFAULT_BINDINGS, sanitizeBindings } from '../src/input/keyboard.js';
import { newProfile, sanitizeProfile } from '../src/game/profile.js';

const run = (tut, events) => { for (const e of events) tut.handle(e); return tut.step; };

test('tutorial: advances only on the real event of the current task, one task at a time', () => {
  const tut = createTutorial();
  assert.equal(tut.step, 'steer');
  // Unrelated events and "button presses" do nothing.
  for (const e of ['launched', 'confirm', 'next', 'boosted', 'baseClosed']) assert.equal(tut.handle(e), false);
  assert.equal(tut.step, 'steer');
  assert.equal(run(tut, ['steered']), 'speed');
  assert.equal(run(tut, ['boosted']), 'speed', 'needs boost AND brake');
  assert.equal(run(tut, ['braked']), 'beacon');
  assert.equal(run(tut, ['approached', 'scanned', 'collected', 'holdReady', 'nearDock', 'docked']), 'base');
  assert.equal(run(tut, ['baseOpened']), 'free');
  assert.equal(run(tut, ['baseClosed']), 'free', 'the last line is shown back at the pad');
  assert.equal(run(tut, ['launched']), null);
  assert.equal(tut.done, true);
});

test('tutorial: a player ahead of it is caught up, never stuck; the first launch never skips it', () => {
  const tut = createTutorial();
  tut.handle('launched'); // a new journey starts with a launch
  assert.equal(tut.step, 'steer');
  tut.handle('steered');
  assert.equal(tut.step, 'speed');
  tut.handle('scanned'); // scanned before trying boost and brake
  assert.equal(tut.step, 'collect');
  tut.handle('docked');
  assert.equal(tut.step, 'base');
});

test('tutorial: opening the base or launching early never skips the lessons', () => {
  const tut = createTutorial();
  run(tut, ['steered', 'baseOpened', 'baseClosed', 'launched']);
  assert.equal(tut.step, 'speed');
});

test('tutorial: first-mission steps are passed over once that mission is done (replay)', () => {
  let first = true;
  const tut = createTutorial({ firstMission: () => first });
  run(tut, ['steered', 'boosted', 'braked', 'approached', 'scanned']);
  first = false;
  tut.handle('collected');
  assert.equal(tut.step, 'return', 'no "collect 6 Cryon" after First Light');
});

test('tutorial: radio lines change with reading time, the step only with events', () => {
  let t = 0;
  const lines = [];
  const tut = createTutorial({ now: () => t, onLine: l => lines.push(l[0]) });
  assert.equal(tut.current().speaker, 'control');
  t = 10;
  assert.equal(tut.current().speaker, 'pilot');
  t = 20;
  assert.equal(tut.current().line, 2);
  t = 500;
  assert.equal(tut.current().line, 2, 'the last line stays');
  assert.equal(tut.step, 'steer');
  assert.deepEqual(lines, ['control', 'pilot', 'control']);
});

test('tutorial: saved, resumed, skipped and replayed; old saves are not forced into it', () => {
  const tut = createTutorial();
  run(tut, ['steered', 'boosted', 'braked', 'approached']);
  const saved = tut.serialize();
  assert.deepEqual(saved, { step: 'scan', done: false, flags: { boosted: true, braked: true } });
  const resumed = createTutorial({ state: sanitizeTutorial(JSON.parse(JSON.stringify(saved))) });
  assert.equal(resumed.step, 'scan');
  resumed.skip();
  assert.equal(resumed.active, false);
  resumed.restart();
  assert.equal(resumed.step, 'steer');
  // A new journey starts it; an M1 save (no tutorial field) does not.
  assert.equal(newProfile().tutorial.done, false);
  const m1 = newProfile(); delete m1.tutorial;
  assert.equal(sanitizeProfile(JSON.parse(JSON.stringify(m1))).tutorial.done, true);
  assert.equal(sanitizeTutorial({ step: 'nonsense' }, false).step, 'steer');
});

test('tutorial: every line and task has English text; tasks follow the device and the bindings', () => {
  for (const s of STEPS) for (const [, id] of s.lines) assert.ok(TEXT[id], id);
  const b = sanitizeBindings(DEFAULT_BINDINGS);
  for (const s of STEPS) for (const dev of ['kbm', 'pad', 'touch']) assert.ok(!taskText(s.task, dev, b).startsWith('tut.'), `${s.task} ${dev}`);
  assert.equal(taskText('scan', 'kbm', b), 'Scan: Q');
  assert.equal(taskText('scan', 'pad', b), 'Scan: X');
  assert.equal(taskText('scan', 'touch', b), 'Tap SCAN');
  const rebound = { ...b, scan: ['KeyR'] };
  assert.equal(taskText('scan', 'kbm', rebound), 'Scan: R');
});
