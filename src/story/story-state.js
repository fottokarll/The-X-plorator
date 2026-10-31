/**
 * Reading state of the prologue, kept apart from drawing so its rules can be
 * tested: the reader alone moves through it (there is no timer anywhere), the
 * last beat offers BEGIN only once the game is really ready, and once offered
 * it stays until the reader uses it.
 *
 *   primary(): 'next' | 'wait' (last beat, still preparing) | 'retry' (a boot
 *   step failed) | 'begin' (ready)
 */
export function createStoryState({ count = 7, isReady = () => false, isFailed = () => false } = {}) {
  let index = 0;
  let furthest = 0;
  return {
    get index() { return index; },
    get count() { return count; },
    get furthest() { return furthest; },
    get atEnd() { return index === count - 1; },
    next() {
      if (index < count - 1) index++;
      furthest = Math.max(furthest, index);
      return index;
    },
    back() {
      if (index > 0) index--;
      return index;
    },
    goTo(i) {
      index = Math.max(0, Math.min(count - 1, Math.round(i)));
      furthest = Math.max(furthest, index);
      return index;
    },
    /** Skip: straight on when the game is ready, else to the last beat to wait there. */
    skip() {
      if (isReady() && !isFailed()) return 'begin';
      index = count - 1;
      furthest = index;
      return 'wait';
    },
    primary() {
      if (index < count - 1) return 'next';
      if (isFailed()) return 'retry';
      return isReady() ? 'begin' : 'wait';
    },
    canBegin() { return index === count - 1 && isReady() && !isFailed(); },
    reset() { index = 0; furthest = 0; },
  };
}
