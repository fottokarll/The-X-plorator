/**
 * Multi-touch contact tracking without pointer ids.
 * Project 0 forwards pointer events as { x, y, dx, dy, button, buttons, touch }
 * but no pointerId (also observed by the STARBOX team on the official
 * runtime). Each touch move/up is matched to the contact whose last known
 * position equals the event's previous endpoint (x - dx, y - dy), falling back
 * to the nearest contact. Mouse uses a single contact per button.
 */
export function createContactTracker({ tolerance = 3, fallback = 90 } = {}) {
  const contacts = [];
  let nextId = 1;

  function match(event) {
    if (!event.touch) return contacts.findIndex(c => !c.touch && (event.button === undefined || c.button === event.button || event.type === 'move'));
    const px = event.x - (event.dx || 0), py = event.y - (event.dy || 0);
    let best = -1, bestDistance = Infinity;
    contacts.forEach((c, i) => {
      if (!c.touch) return;
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < bestDistance) { bestDistance = d; best = i; }
    });
    if (best >= 0 && bestDistance <= tolerance) return best;
    // Fallback: nearest to the current point (coalesced or dropped events).
    best = -1; bestDistance = Infinity;
    contacts.forEach((c, i) => {
      if (!c.touch) return;
      const d = Math.hypot(c.x - event.x, c.y - event.y);
      if (d < bestDistance) { bestDistance = d; best = i; }
    });
    return bestDistance <= fallback ? best : -1;
  }

  return {
    get size() { return contacts.length; },
    down(event) {
      const contact = { id: nextId++, x: event.x, y: event.y, startX: event.x, startY: event.y, touch: Boolean(event.touch), button: event.button ?? 0 };
      contacts.push(contact);
      return contact;
    },
    move(event) {
      const i = match({ ...event, type: 'move' });
      if (i < 0) return null;
      const c = contacts[i];
      c.x = event.x; c.y = event.y;
      return c;
    },
    up(event) {
      const i = match(event);
      if (i < 0) return null;
      const [c] = contacts.splice(i, 1);
      c.x = event.x; c.y = event.y;
      return c;
    },
    clear() {
      const all = contacts.splice(0);
      return all;
    },
    list() { return contacts.slice(); },
  };
}
