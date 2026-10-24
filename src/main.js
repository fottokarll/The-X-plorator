import { createGame } from './game/game.js';

/**
 * THE X-PLORATOR: Project 0 experience entry (see experience.json).
 * The same module runs unchanged in the Project 0 sandbox, in the official
 * dev kit, and in the standalone browser host (standalone/host.js), which
 * implements the documented subset of the p0 object this game uses.
 */
export default async function start(p0) {
  // The returned game object is ignored by Project 0; the standalone host keeps
  // it for local test scripts.
  return createGame(p0);
}
