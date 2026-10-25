/**
 * Sound through the documented p0.sound / p0.music API (files synthesised by
 * tools/generate-audio.mjs, original). Browsers start sound only after the
 * player's first click or key; the city handles that, and players can mute.
 * Effects are rate-limited so nothing ever stacks into noise.
 *
 * Music loop (M2): Project 0 streams p0.music through an HTML audio element,
 * whose `loop` leaves a short gap at the seam (and ignores volume on iOS).
 * p0.sound decodes the file and loops it sample-accurately in Web Audio, so the
 * 24 s ambient pad plays there as ONE looping sound (never overlapping copies).
 * p0.sound has no volume control for a playing sound: a new music volume is
 * applied once, shortly after the player stops moving the slider, by starting
 * the loop again at the estimated position. Muting pauses and resumes it in
 * place. See docs/AUDIO.md.
 */
const FILES = {
  scan: 'assets/audio/scan.wav',
  scanDone: 'assets/audio/scan-done.wav',
  collect: 'assets/audio/collect.wav',
  dock: 'assets/audio/dock.wav',
  launch: 'assets/audio/launch.wav',
  ui: 'assets/audio/ui.wav',
};
export const MUSIC_FILE = 'assets/audio/verge-ambient.wav';
export const MUSIC_SECONDS = 24;
// Every cue file has the same active loudness; these trims set the mix under
// the player's effects volume. The pad file is levelled 3 dB above the cues.
export const CUE_TRIM = Object.freeze({ scan: 0.75, scanDone: 0.7, collect: 0.8, dock: 0.85, launch: 0.7, ui: 0.4 });
export const DEFAULT_VOLUME = Object.freeze({ music: 0.8, sfx: 0.55 });
const MIN_GAP = { scan: 0.4, scanDone: 0.3 };
const VOLUME_SETTLE = 0.35; // seconds after the last slider step

const clamp01 = v => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function createAudio(p0, { clock = () => p0.time ?? 0 } = {}) {
  let effectsOn = true, musicOn = true;
  let sfxVolume = DEFAULT_VOLUME.sfx, musicVolume = DEFAULT_VOLUME.music;
  const last = new Map();
  const effectIds = new Set();
  let preloaded = false;
  // The looping music sound: its id, the volume it was started at and the
  // clock time it started from `offset` (position estimate for restarts).
  let music = null;
  let pendingVolumeAt = 0;
  let unlockedAt = null; // first player gesture: browsers start audio there
  const safe = fn => { try { return fn(); } catch { return null; } };
  const useSoundLoop = () => Boolean(p0.sound?.play);

  function position() {
    if (!music) return 0;
    if (music.paused) return music.offset;
    const from = Math.max(music.startedAt, unlockedAt ?? Infinity);
    const elapsed = Number.isFinite(from) ? Math.max(0, clock() - from) : 0;
    return (music.offset + elapsed) % MUSIC_SECONDS;
  }

  function startMusic(offset = 0) {
    if (!musicOn || musicVolume <= 0) return;
    if (useSoundLoop()) {
      const id = safe(() => p0.sound.play(MUSIC_FILE, { volume: musicVolume, loop: true, at: offset }));
      if (id === null || id === undefined) return;
      music = { id, volume: musicVolume, offset, startedAt: clock(), paused: false, stream: false };
    } else if (p0.music?.play) {
      // Fallback for hosts without p0.sound: the streamed track.
      safe(() => p0.music.play(MUSIC_FILE, { volume: musicVolume, loop: true, at: offset }));
      music = { id: null, volume: musicVolume, offset, startedAt: clock(), paused: false, stream: true };
    }
  }

  function stopMusic() {
    if (!music) return;
    if (music.stream) safe(() => p0.music.stop());
    else safe(() => p0.sound.stop(music.id));
    music = null;
  }

  function stopEffects() {
    for (const id of effectIds) safe(() => p0.sound.stop(id));
    effectIds.clear();
  }

  const api = {
    get musicVolume() { return musicVolume; },
    get sfxVolume() { return sfxVolume; },
    get musicPlaying() { return Boolean(music && !music.paused); },
    /** Settings from the profile: mute toggles and the two volumes (0..1). */
    configure({ sound, musicEnabled, sfx = sfxVolume, musicLevel = musicVolume }) {
      effectsOn = sound !== false;
      sfxVolume = clamp01(sfx);
      if (!effectsOn || sfxVolume <= 0) stopEffects();
      const wantMusic = musicEnabled !== false;
      const level = clamp01(musicLevel);
      if (!wantMusic || level <= 0) {
        musicOn = wantMusic;
        musicVolume = level;
        // Pause in place, so un-muting goes on where it was.
        if (music && !music.paused) {
          music.offset = position();
          music.paused = true;
          if (music.stream) safe(() => p0.music.stop()); else safe(() => p0.sound.pause(music.id));
        }
        return;
      }
      musicOn = true;
      if (music && music.paused && Math.abs(level - music.volume) < 1e-3 && !music.stream) {
        safe(() => p0.sound.resume(music.id));
        music.startedAt = clock();
        music.paused = false;
      } else if (music && music.paused) {
        const at = music.offset;
        stopMusic();
        musicVolume = level;
        startMusic(at);
      } else if (!music) {
        musicVolume = level;
        startMusic(0);
      } else if (Math.abs(level - music.volume) >= 1e-3) {
        musicVolume = level;
        if (music.stream) safe(() => p0.music.volume(level));
        else pendingVolumeAt = clock() + VOLUME_SETTLE;
      }
    },
    /** Call once per frame: applies a settled music volume change. */
    update() {
      if (!pendingVolumeAt || clock() < pendingVolumeAt) return;
      pendingVolumeAt = 0;
      if (!music || music.paused || music.stream || Math.abs(musicVolume - music.volume) < 1e-3) return;
      const at = position();
      stopMusic();
      startMusic(at);
    },
    /** The player's first click, tap or key: the moment browsers let sound start. */
    gesture() { if (unlockedAt === null) unlockedAt = clock(); },
    // Plays every effect once at volume 0, so each file is fetched and decoded
    // before it is first needed (no hitch on the first scan or launch).
    preload() {
      if (!p0.sound || preloaded) return;
      preloaded = true;
      for (const file of Object.values(FILES)) safe(() => p0.sound.play(file, { volume: 0 }));
    },
    play(name, now = 0) {
      if (!effectsOn || sfxVolume <= 0 || !FILES[name] || !p0.sound) return;
      if (now - (last.get(name) ?? -9) < (MIN_GAP[name] ?? 0.12)) return;
      last.set(name, now);
      const id = safe(() => p0.sound.play(FILES[name], { volume: clamp01(sfxVolume * (CUE_TRIM[name] ?? 0.6)) }));
      if (id !== null && id !== undefined) {
        effectIds.add(id);
        if (effectIds.size > 24) effectIds.delete(effectIds.values().next().value);
      }
    },
    /** Read-only snapshot for tests and the dev report. */
    debug() { return { music: music ? { ...music, position: position() } : null, musicVolume, sfxVolume, effectsOn, musicOn, unlockedAt }; },
  };
  return api;
}
