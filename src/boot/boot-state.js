/**
 * Boot state: the ordered list of real tasks the game must finish before it
 * can be played, with honest progress. Fraction = weighted share of required
 * work actually done (a running task may report its own 0..1); nothing is
 * estimated from time and nothing reaches 1 before the last required task is
 * done. A failed task stops readiness and can be retried by the caller.
 * Optional tasks (the prologue art, sound files) never block the game.
 */
export function createBootState({ now = () => performance.now() } = {}) {
  const tasks = new Map();
  const listeners = new Set();
  let lastChange = now();
  const changed = () => { lastChange = now(); for (const fn of listeners) { try { fn(); } catch { /* listener */ } } };

  function task(id) {
    const t = tasks.get(id);
    if (!t) throw new Error(`boot: unknown task ${id}`);
    return t;
  }

  return {
    add(id, { label = id, weight = 1, required = true } = {}) {
      tasks.set(id, { id, label, weight, required, state: 'pending', progress: 0, error: null, attempts: 0, startedAt: 0, ms: 0 });
      return this;
    },
    start(id) {
      const t = task(id);
      t.state = 'running'; t.progress = 0; t.error = null; t.attempts++; t.startedAt = now();
      changed();
    },
    progress(id, fraction) {
      const t = task(id);
      const f = Math.max(0, Math.min(0.99, Number(fraction) || 0));
      if (t.state === 'running' && f > t.progress) { t.progress = f; changed(); }
    },
    done(id) {
      const t = task(id);
      t.state = 'done'; t.progress = 1; t.ms = now() - t.startedAt;
      changed();
    },
    fail(id, error) {
      const t = task(id);
      t.state = 'failed'; t.error = String(error?.message ?? error ?? 'failed'); t.ms = now() - t.startedAt;
      changed();
    },
    /** Weighted progress of the required tasks, 0..1 (1 only when all are done). */
    get fraction() {
      let total = 0, done = 0;
      for (const t of tasks.values()) {
        if (!t.required) continue;
        total += t.weight;
        done += t.weight * (t.state === 'done' ? 1 : t.state === 'running' ? t.progress : 0);
      }
      return total ? done / total : 0;
    },
    get ready() {
      for (const t of tasks.values()) if (t.required && t.state !== 'done') return false;
      return tasks.size > 0;
    },
    get failed() {
      for (const t of tasks.values()) if (t.required && t.state === 'failed') return t;
      return null;
    },
    /** The task now being worked on (its label is shown while preparing). */
    get current() {
      for (const t of tasks.values()) if (t.state === 'running') return t;
      for (const t of tasks.values()) if (t.required && t.state === 'pending') return t;
      return null;
    },
    /** Seconds since anything changed (a stall is reported, never hidden). */
    idleSeconds() { return (now() - lastChange) / 1000; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get(id) { return tasks.get(id) ?? null; },
    snapshot() {
      return [...tasks.values()].map(t => ({ id: t.id, state: t.state, required: t.required, ms: Math.round(t.ms), attempts: t.attempts, error: t.error }));
    },
  };
}

/**
 * Runs one boot task: start, run `fn(progress)`, done; on failure records it
 * and waits for `retry()` (the player's RETRY button) before trying again.
 * `cleanup` undoes a partial attempt before the next one.
 */
export async function runTask(boot, id, fn, { waitRetry, cleanup = null } = {}) {
  for (;;) {
    boot.start(id);
    try {
      const value = await fn(f => boot.progress(id, f));
      boot.done(id);
      return value;
    } catch (error) {
      boot.fail(id, error);
      try { cleanup?.(); } catch { /* best effort */ }
      if (!waitRetry) throw error;
      await waitRetry(id);
    }
  }
}
