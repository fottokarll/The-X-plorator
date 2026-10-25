import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAudio, MUSIC_FILE, MUSIC_SECONDS, CUE_TRIM } from '../src/game/audio.js';
import { newProfile, sanitizeProfile } from '../src/game/profile.js';

function readWav(path) {
  const b = fs.readFileSync(new URL(`../src/${path}`, import.meta.url));
  const rate = b.readUInt32LE(24), n = (b.length - 44) / 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(44 + i * 2) / 32767;
  return { rate, s };
}

test('music loop: the last sample flows into the first (no click, no padding)', () => {
  const { rate, s } = readWav(MUSIC_FILE);
  const n = s.length;
  assert.equal(n, rate * MUSIC_SECONDS);
  const d2 = i => s[(i + 1) % n] - 2 * s[i] + s[(i - 1 + n) % n];
  let interior = 0;
  for (let i = 1; i < n - 1; i++) interior = Math.max(interior, Math.abs(d2(i)));
  // Curvature across the seam is no larger than anywhere inside the loop.
  assert.ok(Math.abs(d2(0)) <= interior, `seam ${d2(0)} vs interior ${interior}`);
  assert.ok(Math.abs(d2(n - 1)) <= interior);
  // The seam sits where the waveform crosses zero almost flat, so a browser
  // that resamples the file on decode has no edge to bend...
  assert.ok(Math.abs(s[0]) < 0.005 && Math.abs(s[n - 1]) < 0.005);
  assert.ok(Math.abs(s[1] - s[0]) < 0.003 && Math.abs(s[n - 1] - s[n - 2]) < 0.003);
  // ...but the music never pauses there: no silent padding (M1 started from a
  // filter at rest and jumped from -0.086 to 0.0).
  const rmsOf = a => Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length);
  assert.ok(rmsOf(s.slice(0, rate * 0.05)) > 0.04 && rmsOf(s.slice(n - rate * 0.05)) > 0.04);
});

test('levels: the pad is louder than any cue file, cues share one loudness', () => {
  const rms = a => Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length);
  const pad = rms(readWav(MUSIC_FILE).s);
  assert.ok(pad > 0.18 && pad < 0.22, `pad rms ${pad}`);
  for (const f of ['scan', 'scan-done', 'collect', 'dock', 'launch']) {
    const r = rms(readWav(`assets/audio/${f}.wav`).s);
    assert.ok(r < pad, `${f} rms ${r} should be below the pad ${pad}`);
  }
});

function fakeP0() {
  const calls = [];
  let id = 0, t = 0;
  const p0 = {
    get time() { return t; },
    sound: {
      play: (path, o) => { calls.push(['play', path, { ...o }, ++id]); return id; },
      stop: i => calls.push(['stop', i]), pause: i => calls.push(['pause', i]), resume: i => calls.push(['resume', i]),
      stopAll: () => calls.push(['stopAll']),
    },
    music: { play: () => calls.push(['music.play']), stop: () => calls.push(['music.stop']) },
  };
  return { p0, calls, advance: s => { t += s; } };
}

test('audio: the pad plays as ONE looping p0.sound (gapless Web Audio), never as p0.music', () => {
  const { p0, calls } = fakeP0();
  const audio = createAudio(p0);
  audio.configure({ sound: true, musicEnabled: true, sfx: 0.5, musicLevel: 0.8 });
  const loops = calls.filter(c => c[0] === 'play' && c[2].loop);
  assert.equal(loops.length, 1);
  assert.equal(loops[0][1], MUSIC_FILE);
  assert.equal(loops[0][2].volume, 0.8);
  assert.ok(!calls.some(c => c[0] === 'music.play'));
  // Configuring again with the same settings starts nothing new.
  audio.configure({ sound: true, musicEnabled: true, sfx: 0.5, musicLevel: 0.8 });
  assert.equal(calls.filter(c => c[0] === 'play' && c[2].loop).length, 1);
});

test('audio: muting music pauses it in place and un-muting resumes the same sound', () => {
  const { p0, calls, advance } = fakeP0();
  const audio = createAudio(p0);
  audio.configure({ sound: true, musicEnabled: true, musicLevel: 0.7 });
  const musicId = calls.find(c => c[2]?.loop)[3];
  audio.gesture();
  advance(5);
  audio.configure({ sound: true, musicEnabled: false, musicLevel: 0.7 });
  assert.deepEqual(calls.at(-1), ['pause', musicId]);
  assert.ok(Math.abs(audio.debug().music.position - 5) < 1e-6);
  audio.configure({ sound: true, musicEnabled: true, musicLevel: 0.7 });
  assert.deepEqual(calls.at(-1), ['resume', musicId]);
  assert.ok(!calls.some(c => c[0] === 'stopAll'));
});

test('audio: a new music volume applies once the slider settles, from the current position', () => {
  const { p0, calls, advance } = fakeP0();
  const audio = createAudio(p0);
  audio.configure({ sound: true, musicEnabled: true, musicLevel: 0.8 });
  audio.gesture();
  advance(30); // past one 24 s loop
  for (const v of [0.7, 0.6, 0.5]) { audio.configure({ sound: true, musicEnabled: true, musicLevel: v }); advance(0.1); audio.update(); }
  assert.equal(calls.filter(c => c[2]?.loop).length, 1, 'no restart while the slider moves');
  advance(0.5);
  audio.update();
  const loops = calls.filter(c => c[2]?.loop);
  assert.equal(loops.length, 2);
  assert.equal(loops[1][2].volume, 0.5);
  assert.ok(Math.abs(loops[1][2].at - (30.3 % MUSIC_SECONDS)) < 0.6, `restart at ${loops[1][2].at}`);
  // The old sound was stopped first: only one music loop at a time.
  const stopIndex = calls.findIndex(c => c[0] === 'stop' && c[1] === loops[0][3]);
  assert.ok(stopIndex >= 0 && stopIndex < calls.indexOf(loops[1]));
});

test('audio: effects follow the effects volume with per-cue trims; muting stops only effects', () => {
  const { p0, calls } = fakeP0();
  const audio = createAudio(p0);
  audio.configure({ sound: true, musicEnabled: true, sfx: 0.6, musicLevel: 0.8 });
  audio.play('scan', 1);
  audio.play('scan', 1.1); // rate-limited
  const scans = calls.filter(c => c[1]?.endsWith('scan.wav'));
  assert.equal(scans.length, 1);
  assert.ok(Math.abs(scans[0][2].volume - 0.6 * CUE_TRIM.scan) < 1e-9);
  const musicId = calls.find(c => c[2]?.loop)[3];
  audio.configure({ sound: false, musicEnabled: true, sfx: 0.6, musicLevel: 0.8 });
  assert.ok(calls.some(c => c[0] === 'stop' && c[1] === scans[0][3]));
  assert.ok(!calls.some(c => c[0] === 'stop' && c[1] === musicId));
  assert.ok(!calls.some(c => c[0] === 'stopAll'));
});

test('profile: M1 saves load with the new M2 defaults and keep their progress', () => {
  const m1 = newProfile();
  delete m1.flags;
  delete m1.settings.musicVolume; delete m1.settings.sfxVolume; delete m1.settings.perfOverlay; delete m1.settings.shipModel;
  m1.bank.cryon = 9; m1.mission.step = 'free'; m1.settings.music = false;
  const p = sanitizeProfile(JSON.parse(JSON.stringify(m1)));
  assert.equal(p.bank.cryon, 9);
  assert.equal(p.mission.step, 'free');
  assert.equal(p.settings.music, false);
  assert.equal(p.settings.musicVolume, 0.8);
  assert.equal(p.settings.sfxVolume, 0.55);
  assert.equal(p.settings.shipModel, 'mk2');
  assert.equal(p.flags.prologueSeen, false);
  const m2 = sanitizeProfile({ ...JSON.parse(JSON.stringify(p)), flags: { prologueSeen: true }, settings: { ...p.settings, musicVolume: 2, sfxVolume: -1 } });
  assert.equal(m2.flags.prologueSeen, true);
  assert.equal(m2.settings.musicVolume, 1);
  assert.equal(m2.settings.sfxVolume, 0);
});
