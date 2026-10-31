import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootState, runTask } from '../src/boot/boot-state.js';
import { createStoryState } from '../src/story/story-state.js';
import { STORY, t, beatText, artBytes } from '../src/story/story.js';
import STRINGS from '../src/story/strings.en.js';

function bootWith(clock = { t: 0 }) {
  const boot = createBootState({ now: () => clock.t });
  boot.add('world', { weight: 4 }).add('engines', { weight: 4 }).add('interface', { weight: 2 }).add('sound', { required: false });
  return boot;
}

test('boot: progress is the real weighted share of required work, 1 only when all are done', () => {
  const boot = bootWith();
  assert.equal(boot.fraction, 0);
  assert.equal(boot.ready, false);
  boot.start('world'); boot.progress('world', 0.5);
  assert.equal(boot.fraction, 0.2);
  boot.progress('world', 1.4); // a task cannot claim 100 % before done()
  assert.ok(boot.fraction < 0.4);
  boot.done('world'); boot.start('engines'); boot.done('engines');
  assert.equal(boot.ready, false);
  assert.equal(boot.fraction, 0.8);
  boot.start('interface'); boot.done('interface');
  assert.equal(boot.fraction, 1);
  // An optional task (sound) never holds the game back.
  assert.equal(boot.ready, true);
  assert.equal(boot.get('sound').state, 'pending');
});

test('boot: a failed step stops readiness, is reported, and runs again on retry', async () => {
  const boot = bootWith();
  let attempts = 0, cleaned = 0;
  let resume = null;
  const result = runTask(boot, 'world', async () => {
    attempts++;
    if (attempts === 1) throw new Error('lost context');
    return 'world';
  }, { waitRetry: () => new Promise(r => { resume = r; }), cleanup: () => { cleaned++; } });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(boot.failed?.id, 'world');
  assert.equal(boot.failed.error, 'lost context');
  assert.equal(cleaned, 1);
  assert.equal(boot.ready, false);
  resume(); // the player's RETRY
  assert.equal(await result, 'world');
  assert.equal(boot.failed, null);
  assert.equal(boot.get('world').attempts, 2);
});

test('boot: a stall is visible (idle time grows) without inventing progress', () => {
  const clock = { t: 0 };
  const boot = bootWith(clock);
  boot.start('world');
  clock.t = 30000;
  assert.equal(boot.idleSeconds(), 30);
  assert.equal(boot.fraction, 0);
});

test('story: BEGIN cannot be used before the game is ready and never goes away by itself', () => {
  let ready = false;
  const s = createStoryState({ count: 7, isReady: () => ready });
  assert.equal(s.primary(), 'next');
  for (let i = 0; i < 10; i++) s.next();
  assert.equal(s.index, 6);
  assert.equal(s.primary(), 'wait');
  assert.equal(s.canBegin(), false);
  ready = true;
  assert.equal(s.primary(), 'begin');
  // Nothing in the state moves on its own: still waiting for the reader.
  for (let i = 0; i < 1000; i++) assert.equal(s.primary(), 'begin');
  assert.equal(s.index, 6);
  assert.equal(s.canBegin(), true);
});

test('story: skip goes straight on only when ready, otherwise to the last beat to wait', () => {
  let ready = false;
  const s = createStoryState({ count: 7, isReady: () => ready });
  s.next();
  assert.equal(s.skip(), 'wait');
  assert.equal(s.index, 6);
  assert.equal(s.primary(), 'wait');
  ready = true;
  const s2 = createStoryState({ count: 7, isReady: () => ready });
  assert.equal(s2.skip(), 'begin');
});

test('story: a failed boot offers RETRY instead of BEGIN; back never leaves the first beat', () => {
  let failed = true;
  const s = createStoryState({ count: 7, isReady: () => true, isFailed: () => failed });
  s.back();
  assert.equal(s.index, 0);
  s.goTo(6);
  assert.equal(s.primary(), 'retry');
  assert.equal(s.canBegin(), false);
  failed = false;
  assert.equal(s.primary(), 'begin');
});

test('story data: seven beats, every word from the string table, art for both layouts', () => {
  assert.equal(STORY.length, 7);
  for (const beat of STORY) {
    for (const key of ['caption', 'narration', 'alt']) assert.ok(STRINGS[beat[key]], `${beat[key]} missing`);
    assert.ok(beat.bubble in STRINGS);
    for (const set of ['wide', 'tall']) {
      const a = beat.art[set];
      assert.match(a.file, new RegExp(`^assets/comic/${set}/panel_0${beat.n}\\.webp$`));
      assert.ok(a.poly.length >= 4 && a.width > 0 && a.height > 0);
      // A balloon exists in the art exactly where the beat has a spoken line.
      assert.equal(Boolean(a.balloon), Boolean(t(beat.bubble)), `beat ${beat.n} ${set} balloon`);
    }
  }
  assert.equal(t('story.4.bubble'), '');
  assert.match(beatText(STORY[0]), /^1\/7 EARTH WAS FADING\. "Can we still stay here\?" Earth gave us everything/);
  // Asset budget per art set (bytes measured by tools/comic-art.py).
  assert.ok(STORY[0].art.wide.bytes < 100 * 1024 && STORY[0].art.tall.bytes < 100 * 1024);
  assert.ok(artBytes('wide') < 400 * 1024 && artBytes('tall') < 450 * 1024);
});
