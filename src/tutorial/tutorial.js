import TEXT from './text.en.js';
import { prettyKey } from '../input/keyboard.js';

/**
 * First-flight tutorial: one task at a time, each finished only by a real game
 * event (the game reports them: 'steered', 'boosted', 'braked', 'approached',
 * 'scanned', 'collected', 'holdReady', 'nearDock', 'docked', 'baseOpened',
 * 'baseClosed', 'launched'). Pressing a button never advances it by itself, it
 * grants nothing and it never changes the mission. Radio lines are shown one
 * after another (reading time only); the step waits for the event.
 *
 * Saved in the profile as { step, done, flags } so it resumes after a visit;
 * skip ends it, restart replays it (steps that only make sense during the
 * first mission are passed over when that mission is already done).
 */
export const STEPS = Object.freeze([
  { id: 'steer', lines: [['control', 'tut.line.hello'], ['pilot', 'tut.line.ready'], ['control', 'tut.line.steer']], task: 'steer', done: e => e === 'steered' },
  { id: 'speed', lines: [['control', 'tut.line.speed']], task: 'speed', done: (e, f) => (e === 'boosted' || e === 'braked') && f.boosted && f.braked },
  // Mission steps can be caught up: a player who scans before trying the
  // brake finds the tutorial already at the next task, never stuck behind.
  { id: 'beacon', lines: [['control', 'tut.line.beacon']], task: 'beacon', catchUp: true, done: e => e === 'approached' },
  { id: 'scan', lines: [['control', 'tut.line.scan']], task: 'scan', catchUp: true, done: e => e === 'scanned' },
  { id: 'collect', lines: [['control', 'tut.line.collect']], task: 'collect', catchUp: true, done: e => e === 'collected' },
  { id: 'fill', lines: [['control', 'tut.line.fill']], task: 'fill', catchUp: true, firstMissionOnly: true, done: e => e === 'holdReady' },
  { id: 'return', lines: [['control', 'tut.line.home']], task: 'return', catchUp: true, done: e => e === 'nearDock' },
  { id: 'dock', lines: [['control', 'tut.line.dock']], task: 'dock', catchUp: true, done: e => e === 'docked' },
  // The base can be opened at any time (B), so opening it early skips nothing.
  { id: 'base', lines: [['control', 'tut.line.foothold']], task: 'base', done: e => e === 'baseOpened' },
  // Shown back at the pad after the base; the next launch ends the tutorial.
  { id: 'free', lines: [['control', 'tut.line.free']], task: 'free', done: e => e === 'launched' },
]);
const index = id => STEPS.findIndex(s => s.id === id);

export function tutorialText(id) { return TEXT[id] ?? id; }

/** The task line for the player's device, with their own key bindings. */
export function taskText(task, device, bindings) {
  const dev = device === 'pad' || device === 'touch' ? device : 'kbm';
  const id = TEXT[`tut.task.${task}.${dev}`] ? `tut.task.${task}.${dev}` : `tut.task.${task}.any`;
  const key = action => prettyKey(bindings?.[action]?.[0]);
  return tutorialText(id)
    .replace('{yaw}', `${key('yawLeft')} ${key('yawRight')}`)
    .replace('{pitch}', `${key('pitchUp')} ${key('pitchDown')}`)
    .replace('{boost}', key('boost')).replace('{brake}', key('brake'))
    .replace('{scan}', key('scan')).replace('{interact}', key('interact')).replace('{base}', key('base'));
}

/**
 * @param state saved { step, done, flags } (or null for a fresh start)
 * @param firstMission () => true while the First Light mission is not done
 * @param now clock in seconds (for the reading time of radio lines)
 */
export function createTutorial({ state = null, firstMission = () => true, now = () => 0, onLine = null } = {}) {
  let step = state?.done ? -1 : Math.max(0, index(state?.step ?? 'steer'));
  let done = Boolean(state?.done);
  let flags = { boosted: Boolean(state?.flags?.boosted), braked: Boolean(state?.flags?.braked) };
  let line = 0, lineAt = now();

  function enter(i) {
    step = i;
    // A first-mission step makes no sense once that mission is done.
    while (step >= 0 && step < STEPS.length && STEPS[step].firstMissionOnly && !firstMission()) step++;
    if (step >= STEPS.length) { done = true; step = -1; }
    line = 0; lineAt = now();
    if (!done) onLine?.(STEPS[step].lines[0]);
  }
  if (!done) enter(step);

  const api = {
    get active() { return !done && step >= 0; },
    get done() { return done; },
    get step() { return done ? null : STEPS[step]?.id ?? null; },
    get index() { return step; },
    get count() { return STEPS.length; },
    /** The radio line to show now: lines advance by reading time; the last one stays. */
    current() {
      if (!api.active) return null;
      const s = STEPS[step];
      while (line < s.lines.length - 1) {
        const text = tutorialText(s.lines[line][1]);
        const readFor = Math.max(2.4, text.length * 0.055);
        if (now() - lineAt < readFor) break;
        line++; lineAt = now();
        onLine?.(s.lines[line]);
      }
      const [speaker, id] = s.lines[line];
      return { step: s.id, speaker, text: tutorialText(id), task: s.task, line, lines: s.lines.length, number: step + 1 };
    },
    /** A game event; returns true when it finished the current step. */
    handle(event) {
      if (!api.active) return false;
      if (event === 'boosted') flags.boosted = true;
      if (event === 'braked') flags.braked = true;
      if (STEPS[step].done(event, flags)) { enter(step + 1); return true; }
      for (let i = step + 1; i < STEPS.length; i++) {
        if (STEPS[i].catchUp && STEPS[i].done(event, flags)) { enter(i + 1); return true; }
      }
      return false;
    },
    skip() { done = true; step = -1; },
    restart() { done = false; flags = { boosted: false, braked: false }; enter(0); },
    serialize() { return { step: done ? null : STEPS[step]?.id ?? null, done, flags: { ...flags } }; },
  };
  return api;
}

/** Validates a saved tutorial state (it comes from the player's browser). */
export function sanitizeTutorial(raw, fallbackDone) {
  if (!raw || typeof raw !== 'object') return { step: fallbackDone ? null : 'steer', done: Boolean(fallbackDone), flags: { boosted: false, braked: false } };
  const step = typeof raw.step === 'string' && index(raw.step) >= 0 ? raw.step : null;
  return {
    step: raw.done === true ? null : step ?? 'steer',
    done: raw.done === true,
    flags: { boosted: raw.flags?.boosted === true, braked: raw.flags?.braked === true },
  };
}
