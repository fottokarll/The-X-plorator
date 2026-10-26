import STRINGS from './strings.en.js';
import { ART } from './art-layout.js';

/**
 * The Exodus prologue: ONE ordered list of seven beats used by every layout
 * (desktop page, phone portrait, phone landscape). Words come from the string
 * table by id; art comes from art-layout.js (two crops of the approved art per
 * beat: `wide` for the desktop page, `tall` for single frames on phones).
 * `focus` is the horizontal centre (0..1) a narrow phone frame keeps in view;
 * `slide` lets that frame move to keep the drawn balloon whole (beat 7 keeps
 * the hero ship instead and gets a balloon of the game's own).
 */
export const STORY = Object.freeze([1, 2, 3, 4, 5, 6, 7].map(n => Object.freeze({
  n,
  id: `story.${n}`,
  caption: `story.${n}.caption`,
  bubble: `story.${n}.bubble`,
  narration: `story.${n}.narration`,
  alt: `story.${n}.alt`,
  focus: [0.2, 0.3, 0.2, 0.36, 0.3, 0.58, 0.27][n - 1],
  slide: n !== 7,
  art: { wide: ART.wide.panels[n - 1], tall: ART.tall.panels[n - 1] },
})));

export const PAGE = Object.freeze({ wide: ART.wide.page, tall: ART.tall.page });

let strings = STRINGS;
/** Text for an id (the id itself if missing, so a gap is visible, never blank). */
export const t = id => strings[id] ?? id;
/** Swap the string table (a translation with the same ids). */
export function setStrings(table) { strings = { ...STRINGS, ...table }; }

/** Plain-text transcript of one beat (screen readers via p0.hud, transcript page). */
export function beatText(beat, total = STORY.length) {
  const bubble = t(beat.bubble);
  return `${beat.n}/${total} ${t(beat.caption).toUpperCase()}${bubble ? ` "${bubble}"` : ''} ${t(beat.narration)}`;
}

/** Bytes of each art set, for the report and the loading plan. */
export function artBytes(set) {
  return STORY.reduce((sum, b) => sum + b.art[set].bytes, 0);
}
