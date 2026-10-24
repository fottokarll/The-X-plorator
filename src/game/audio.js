/**
 * Sound through the documented p0.sound / p0.music API (files synthesised by
 * tools/generate-audio.mjs, original). Browsers start sound only after the
 * player's first click or key; the city handles that, and players can mute.
 * Effects are rate-limited so nothing ever stacks into noise.
 */
const FILES = {
  scan: 'assets/audio/scan.wav',
  scanDone: 'assets/audio/scan-done.wav',
  collect: 'assets/audio/collect.wav',
  dock: 'assets/audio/dock.wav',
  launch: 'assets/audio/launch.wav',
  ui: 'assets/audio/ui.wav',
};
const MUSIC = 'assets/audio/verge-ambient.wav';
const VOLUME = { scan: 0.45, scanDone: 0.5, collect: 0.55, dock: 0.6, launch: 0.4, ui: 0.25 };

export function createAudio(p0) {
  let effects = true, music = true, musicOn = false;
  const last = new Map();
  const safe = fn => { try { return fn(); } catch { return null; } };

  return {
    configure({ sound, musicEnabled }) {
      effects = sound !== false;
      music = musicEnabled !== false;
      if (!effects) safe(() => p0.sound?.stopAll());
      if (!music && musicOn) { safe(() => p0.music?.stop()); musicOn = false; }
      if (music && !musicOn) this.startMusic();
    },
    startMusic() {
      if (!music || musicOn || !p0.music) return;
      safe(() => p0.music.play(MUSIC, { volume: 0.32, loop: true }));
      musicOn = true;
    },
    play(name, now = 0) {
      if (!effects || !FILES[name] || !p0.sound) return;
      if (now - (last.get(name) ?? -9) < 0.12) return;
      last.set(name, now);
      safe(() => p0.sound.play(FILES[name], { volume: VOLUME[name] ?? 0.5 }));
    },
  };
}
