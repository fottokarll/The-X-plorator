import { createRegistry, viewInfo } from './kit.js';
import { createContactTracker } from '../input/pointer-contacts.js';
import { createTouchFlightController } from '../input/touch.js';

/**
 * Screen stack + input routing for the canvas UI.
 * Screens implement: draw(ctx, view, reg, state), and optionally
 * enter(params), exit(), onAction(id, data), back(), signature(),
 * sprites(overlay, view), pointerDown/Move/Up(contact, event), modal,
 * menuInput (true: arrows/confirm navigate instead of steering), dimBelow.
 */
export function createUi({ overlay, onActivate = null }) {
  const reg = createRegistry();
  const contacts = createContactTracker();
  const state = { focus: null, hover: null, pressed: null };
  const screens = new Map();
  let stack = [];
  let view = viewInfo(1280, 720);
  let dirty = true;
  let lastSignature = '';
  let sinceDraw = 0;
  let lastPointerTouch = false;

  // Touch flight controls feed the existing pure touch controller.
  const touchCtrl = createTouchFlightController({ stickRadius: 58, lookRadius: 150, deadzone: 0.08 });
  const touchEdges = [];
  const contactRole = new Map(); // contact id -> role

  const top = () => stack[stack.length - 1] ?? null;

  function focusFirst() {
    const s = top();
    // Draw once so the registry knows the screen's items.
    draw();
    const preferred = s?.defaultFocus ? reg.find(s.defaultFocus()) : null;
    const first = preferred ?? reg.firstFocusable();
    state.focus = first ? first.id : null;
    dirty = true;
  }

  function draw() {
    const ctx = overlay.begin();
    reg.reset();
    stack.forEach((s, i) => {
      const isTop = i === stack.length - 1;
      if (!isTop && stack[i + 1]?.hideBelow) return;
      if (isTop && i > 0 && s.dimBelow !== false) {
        ctx.fillStyle = 'rgba(3,9,30,0.55)';
        ctx.fillRect(0, 0, view.w, view.h);
      }
      // Lower screens draw without registering focusable items.
      if (!isTop) { const saved = reg.items.length; s.draw(ctx, view, reg, {}); reg.items.length = saved; return; }
      s.draw(ctx, view, reg, state);
    });
    sinceDraw = 0;
    dirty = false;
  }

  function activate(item) {
    if (!item || !item.enabled) return;
    onActivate?.(item.id);
    top()?.onAction?.(item.id, item.data);
    dirty = true;
  }

  function releaseTouchRole(contact) {
    const role = contactRole.get(contact.id);
    if (role) { touchCtrl.up(contact.id); contactRole.delete(contact.id); }
  }

  return {
    register(id, screen) { screens.set(id, screen); screen.ui = this; },
    get view() { return view; },
    get state() { return state; },
    get stack() { return stack.map(s => s.id); },
    get topId() { return top()?.id ?? null; },
    screen(id) { return screens.get(id); },
    get lastPointerTouch() { return lastPointerTouch; },
    resize(w, h, pixelRatio) {
      view = viewInfo(w, h);
      overlay.resize(w, h, pixelRatio);
      dirty = true;
    },
    show(id, params) {
      for (const s of stack) s.exit?.();
      const s = screens.get(id);
      stack = [s];
      s.enter?.(params);
      this.cancelTouches();
      focusFirst();
    },
    push(id, params) {
      const s = screens.get(id);
      if (stack.includes(s)) return;
      stack.push(s);
      s.enter?.(params);
      this.cancelTouches();
      focusFirst();
    },
    pop() {
      const s = stack.pop();
      s?.exit?.();
      this.cancelTouches();
      focusFirst();
    },
    is(id) { return top()?.id === id; },
    has(id) { return stack.some(s => s.id === id); },
    invalidate() { dirty = true; },
    get menuInput() { return Boolean(top()?.menuInput); },
    focus(id) { state.focus = id; dirty = true; },

    handleEdges(edges) {
      const s = top();
      if (!s) return;
      for (const e of edges) {
        if (s.menuInput && ['up', 'down', 'left', 'right'].includes(e)) {
          if (s.onNav?.(e)) { dirty = true; continue; }
          const n = reg.neighbour(state.focus, e);
          if (n) { state.focus = n.id; dirty = true; }
        } else if (s.menuInput && e === 'confirm') {
          activate(reg.find(state.focus));
        } else if (e === 'back') {
          s.back?.();
          dirty = true;
        } else s.onEdge?.(e);
      }
    },

    pointerDown(event) {
      lastPointerTouch = Boolean(event.touch);
      const contact = contacts.down(event);
      const item = reg.hit(event.x, event.y);
      const s = top();
      if (item && item.enabled) {
        contact.itemId = item.id;
        state.pressed = item.id;
        state.focus = item.focusable ? item.id : state.focus;
        if (item.hold) { touchCtrl.down(contact.id, item.id, event.x, event.y); contactRole.set(contact.id, item.id); }
        // Tap-type flight buttons fire on press for responsiveness.
        if (s?.pressActions?.includes(item.id)) { touchEdges.push(item.id); contact.fired = true; }
        dirty = true;
        return;
      }
      const role = s?.pointerDown?.(contact, event);
      if (role === 'stick' || role === 'look') {
        if (touchCtrl.down(contact.id, role, event.x, event.y)) contactRole.set(contact.id, role);
      }
    },
    pointerMove(event) {
      const contact = contacts.move(event);
      if (!event.touch && !event.buttons) {
        const item = reg.hit(event.x, event.y);
        const id = item?.enabled ? item.id : null;
        if (id !== state.hover) { state.hover = id; dirty = true; }
      }
      if (!contact) { top()?.pointerHover?.(event); return; }
      if (contactRole.has(contact.id)) touchCtrl.move(contact.id, event.x, event.y);
      top()?.pointerMove?.(contact, event);
    },
    pointerUp(event) {
      const contact = contacts.up(event);
      if (!contact) return;
      releaseTouchRole(contact);
      if (contact.itemId) {
        const item = reg.hit(event.x, event.y) ?? reg.find(contact.itemId);
        const sameItem = item && item.id === contact.itemId;
        if (state.pressed === contact.itemId) state.pressed = null;
        if (sameItem && !contact.fired && !item.hold) activate(item);
        dirty = true;
        return;
      }
      top()?.pointerUp?.(contact, event);
    },
    cancelTouches() {
      for (const c of contacts.clear()) releaseTouchRole(c);
      touchCtrl.reset();
      contactRole.clear();
      state.pressed = null;
    },
    // Touch provider for the input hub.
    touch: {
      snapshot() {
        const snap = touchCtrl.snapshot();
        return snap;
      },
      takeEdges() { return touchEdges.splice(0); },
    },
    stickState() {
      // For drawing the virtual stick: origin and current point of the stick contact.
      for (const c of contacts.list()) if (contactRole.get(c.id) === 'stick') return { ox: c.startX, oy: c.startY, x: c.x, y: c.y };
      return null;
    },
    holding(id) { for (const r of contactRole.values()) if (r === id) return true; return false; },

    update(dt) {
      sinceDraw += dt;
      const s = top();
      const sig = stack.map(x => x.signature?.() ?? '').join('|');
      if (sig !== lastSignature) { lastSignature = sig; dirty = true; }
      // Animated screens may ask for a capped refresh rate.
      const fps = s?.refreshRate ?? 0;
      if (fps && sinceDraw >= 1 / fps) dirty = true;
      s?.tick?.(dt);
      if (dirty) draw();
      overlay.spritesBegin();
      // Only the top screen draws sprites (they would sit above any dimmed panel).
      s?.sprites?.(overlay, view);
      overlay.spritesEnd();
    },
  };
}
