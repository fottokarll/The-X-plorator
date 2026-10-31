/**
 * Drawing kit for the canvas UI in the IMG 07 language: restrained glass-dark
 * panels, thin cyan outlines, soft off-white letter-spaced type, round icon
 * buttons, rare gold highlights. Also the hit-test / focus registry that makes
 * every screen usable by mouse, touch, keyboard and gamepad.
 */
export const COLORS = Object.freeze({
  text: '#E6F6FD',
  dim: 'rgba(214,234,250,0.62)',
  faint: 'rgba(200,225,250,0.38)',
  cyan: '#70E2F4',
  cyanSoft: 'rgba(112,226,244,0.45)',
  line: 'rgba(132,214,250,0.34)',
  glass: 'rgba(8,20,52,0.58)',
  glassStrong: 'rgba(7,16,44,0.82)',
  gold: '#F8BD78',
  lilac: '#985DC8',
  rose: '#E5A1CF',
  danger: '#FF8FA3',
  ok: '#8CF5C8',
});

// Light version (software renderers): canvas shadows and big gradients are
// skipped, they are slow to rasterise there and add little at that size.
export const UI_FX = { shadows: true };

export const FONT = '"Exo 2", "Rajdhani", "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Layout context from the viewport (CSS px). */
export function viewInfo(w, h) {
  const portrait = h > w;
  const phone = Math.min(w, h) < 520;
  const u = phone
    ? Math.max(0.82, Math.min(1.15, (portrait ? w : h) / 390))
    : Math.max(0.78, Math.min(1.6, Math.min(w / 1280, h / 720)));
  // Project 0 draws its toolbar across the top centre: keep ~58 px clear there,
  // and its round fullscreen button in the top-left corner (~48 px square).
  // A worker cannot read the device's safe-area insets (no CSS env()), so
  // landscape phones keep a fixed side margin for notches and rounded corners,
  // and phones a small bottom margin for the home indicator.
  const landscapePhone = phone && !portrait;
  return { w, h, u, portrait, phone, landscapePhone, pad: Math.round(16 * u), p0Top: 58, p0Corner: 48, safeX: landscapePhone ? 30 : 0, safeBottom: phone ? 10 : 0 };
}

export function setFont(ctx, size, weight = 400) {
  ctx.font = `${weight} ${Math.round(size * 10) / 10}px ${FONT}`;
}

/** Text with manual letter spacing (consistent across browsers). Returns width. */
export function text(ctx, str, x, y, { size = 14, weight = 400, color = COLORS.text, align = 'left', tracking = 0, baseline = 'middle', alpha = 1, maxWidth = 0, shadow = false } = {}) {
  str = String(str);
  // A line that does not fit gives up letter spacing first, then up to 18 % of
  // its size, and only then is cut with an ellipsis.
  if (maxWidth && tracking) {
    const chars = [...str];
    setFont(ctx, size, weight);
    const base = ctx.measureText(str).width;
    if (base + tracking * (chars.length - 1) > maxWidth) {
      tracking = Math.max(0, (maxWidth - base) / Math.max(1, chars.length - 1));
      if (base > maxWidth) { size = Math.max(size * 0.82, size * maxWidth / base); tracking = 0; }
    }
  }
  setFont(ctx, size, weight);
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  if (shadow && UI_FX.shadows) { ctx.shadowColor = 'rgba(2,8,26,0.85)'; ctx.shadowBlur = 8; }
  let width;
  if (!tracking) {
    width = ctx.measureText(str).width;
    if (maxWidth && width > maxWidth) {
      while (str.length > 1 && ctx.measureText(str + '…').width > maxWidth) str = str.slice(0, -1);
      str += '…';
      width = ctx.measureText(str).width;
    }
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  } else {
    const chars = [...str];
    const widths = chars.map(c => ctx.measureText(c).width);
    width = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + tracking; });
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  return width;
}

export function measure(ctx, str, size, weight = 400, tracking = 0) {
  setFont(ctx, size, weight);
  const chars = [...String(str)];
  return ctx.measureText(String(str)).width + tracking * Math.max(0, chars.length - 1);
}

/** Word-wrapped paragraph (optionally at most `maxLines`, the last cut with an ellipsis); returns the height used. */
export function paragraph(ctx, str, x, y, maxWidth, { size = 14, lineHeight = 1.45, color = COLORS.dim, align = 'left', weight = 400, maxLines = 0 } = {}) {
  setFont(ctx, size, weight);
  const words = String(str).split(/\s+/);
  let lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineHeight));
  return lines.length * size * lineHeight;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, { r = 14, fill = COLORS.glass, stroke = COLORS.line, glow = 0, highlight = true } = {}) {
  ctx.save();
  if (glow && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.55)'; ctx.shadowBlur = glow; }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (highlight) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(150,200,255,0.10)');
    g.addColorStop(0.35, 'rgba(150,200,255,0.0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

export function divider(ctx, x, y, w, { color = COLORS.line, diamond = true } = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(132,214,250,0)');
  g.addColorStop(0.5, color);
  g.addColorStop(1, 'rgba(132,214,250,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  if (diamond) {
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    const cx = x + w / 2;
    ctx.moveTo(cx, y - 3); ctx.lineTo(cx + 3, y); ctx.lineTo(cx, y + 3); ctx.lineTo(cx - 3, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Segmented stat bar (IMG 03 hangar style). */
export function segBar(ctx, x, y, w, h, value, color, segments = 5) {
  const gap = 3, sw = (w - gap * (segments - 1)) / segments;
  for (let i = 0; i < segments; i++) {
    const fill = Math.max(0, Math.min(1, value * segments - i));
    roundRect(ctx, x + i * (sw + gap), y, sw, h, h / 2);
    ctx.fillStyle = 'rgba(120,150,200,0.18)';
    ctx.fill();
    if (fill > 0) {
      roundRect(ctx, x + i * (sw + gap), y, sw * fill, h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------------ icons
// Line icons on a 24-unit grid, centred on (cx, cy), drawn at `size` px.
export function icon(ctx, name, cx, cy, size, color = COLORS.text, lineWidth = 1.6) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  // The context is scaled by s, so this is lineWidth device-independent px.
  ctx.lineWidth = lineWidth / s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  (ICONS[name] ?? ICONS.dot)(ctx);
  ctx.restore();
}

const stroke = (ctx, d) => ctx.stroke(new Path2D(d));
const fill = (ctx, d) => ctx.fill(new Path2D(d));

const ICONS = {
  dot: ctx => { ctx.beginPath(); ctx.arc(12, 12, 3, 0, 7); ctx.fill(); },
  boost: ctx => { stroke(ctx, 'M12 2.5c3 2.6 4.4 6 4.4 10.2l-1.9 3.3h-5l-1.9-3.3C7.6 8.5 9 5.1 12 2.5z'); stroke(ctx, 'M9.5 16l-2.3 3 2.6-.4M14.5 16l2.3 3-2.6-.4'); stroke(ctx, 'M12 17.5v4'); ctx.beginPath(); ctx.arc(12, 9.5, 1.6, 0, 7); ctx.stroke(); },
  brake: ctx => { stroke(ctx, 'M7 6v12M17 6v12'); stroke(ctx, 'M3.5 12h3M17.5 12h3'); },
  scan: ctx => { for (const r of [9.5, 6, 2.2]) { ctx.beginPath(); ctx.arc(12, 12, r, 0, 7); ctx.stroke(); } stroke(ctx, 'M12 12l6.5-6.5'); },
  base: ctx => { ctx.beginPath(); ctx.arc(12, 12, 5.2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(12, 12.5, 10.5, 3.6, -0.35, 0, 7); ctx.stroke(); },
  cargo: ctx => { stroke(ctx, 'M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z'); stroke(ctx, 'M4 7.2l8 4.3 8-4.3M12 11.5V21'); },
  bag: ctx => { stroke(ctx, 'M5.5 8.5h13l-1 11.5h-11z'); stroke(ctx, 'M9 8.5V7a3 3 0 016 0v1.5'); stroke(ctx, 'M9.5 13h5'); },
  map: ctx => { stroke(ctx, 'M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z'); stroke(ctx, 'M9 4v13.5M15 6.5V20'); },
  settings: ctx => { stroke(ctx, 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z'); ctx.beginPath(); ctx.arc(12, 12, 3.2, 0, 7); ctx.stroke(); },
  pause: ctx => { stroke(ctx, 'M9 6v12M15 6v12'); },
  play: ctx => { fill(ctx, 'M8 5.5l11 6.5-11 6.5z'); },
  engine: ctx => { stroke(ctx, 'M3.5 9h9l3-2v10l-3-2h-9z'); stroke(ctx, 'M17.5 9.5c1.6.8 2.4 1.6 3 2.5-.6.9-1.4 1.7-3 2.5'); },
  hull: ctx => { stroke(ctx, 'M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z'); stroke(ctx, 'M12 7v10M8.5 10.5h7'); },
  reactor: ctx => { stroke(ctx, 'M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z'); stroke(ctx, 'M12 3.5v8.5l7.4 4.25M12 12l-7.4 4.25'); },
  scanner: ctx => { stroke(ctx, 'M5 13a7 7 0 0110-7.5'); stroke(ctx, 'M4.5 6.5l9 9'); stroke(ctx, 'M9 18l-2.5 3h7l-2.5-3'); ctx.beginPath(); ctx.arc(16.5, 6.5, 1.6, 0, 7); ctx.stroke(); stroke(ctx, 'M18.5 3a5 5 0 012.5 4.5'); },
  shield: ctx => { stroke(ctx, 'M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z'); stroke(ctx, 'M8.5 12l2.5 2.5 4.5-5'); },
  miner: ctx => { stroke(ctx, 'M4 18l7-7'); stroke(ctx, 'M10 7l7 7 3-3-7-7z'); stroke(ctx, 'M4 18l2 2'); stroke(ctx, 'M19 18.5l1.5 1.5M17 20.5l.8 1.5M20.5 16l1.5.6'); },
  lock: ctx => { stroke(ctx, 'M6.5 10.5h11v9.5h-11z'); stroke(ctx, 'M8.5 10.5V8a3.5 3.5 0 017 0v2.5'); stroke(ctx, 'M12 14.5v2'); },
  crystal: ctx => { stroke(ctx, 'M12 2.5l4.5 6.5L12 21.5 7.5 9z'); stroke(ctx, 'M7.5 9h9M12 2.5V21.5'); },
  ore: ctx => { stroke(ctx, 'M5 14l3-7 7-2 4.5 5.5-2 7.5-8 1.5z'); stroke(ctx, 'M8 7l3 5 6.5-1.5M11 12l-2.5 7.5'); },
  crew: ctx => { for (const [x, y, r] of [[12, 8, 2.8], [6, 10, 2.1], [18, 10, 2.1]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); } stroke(ctx, 'M7.5 19.5c0-3 2-5.2 4.5-5.2s4.5 2.2 4.5 5.2M2.5 19c0-2.4 1.4-4.2 3.5-4.2M21.5 19c0-2.4-1.4-4.2-3.5-4.2'); },
  back: ctx => { stroke(ctx, 'M19 12H5.5M11 6l-6 6 6 6'); },
  next: ctx => { stroke(ctx, 'M5 12h13.5M13 6l6 6-6 6'); },
  hangar: ctx => { stroke(ctx, 'M12 2.5l2 6 6.5 6-6.5-1.2L12 21l-2-7.7-6.5 1.2 6.5-6z'); },
  check: ctx => { stroke(ctx, 'M5 12.5l4.5 4.5L19 7.5'); },
  close: ctx => { stroke(ctx, 'M6 6l12 12M18 6L6 18'); },
  help: ctx => { ctx.beginPath(); ctx.arc(12, 12, 9, 0, 7); ctx.stroke(); stroke(ctx, 'M9.5 9.5a2.6 2.6 0 115 1c-.8 1.2-2.5 1.6-2.5 3.2'); ctx.beginPath(); ctx.arc(12, 16.8, 0.6, 0, 7); ctx.fill(); },
  action: ctx => { ctx.beginPath(); ctx.arc(12, 12, 8.5, 0, 7); ctx.stroke(); stroke(ctx, 'M12 7.5v9M7.5 12h9'); },
  star: ctx => { stroke(ctx, 'M12 3l2.6 5.8 6.3.6-4.8 4.2 1.4 6.2L12 16.6 6.5 19.8l1.4-6.2L3.1 9.4l6.3-.6z'); },
  power: ctx => { stroke(ctx, 'M13.5 2.5L6 13.5h5.5L10.5 21.5 18 10.5h-5.5z'); },
  speed: ctx => { stroke(ctx, 'M4.5 17a8 8 0 1115 0'); stroke(ctx, 'M12 13l4-4.5'); },
  dock: ctx => { stroke(ctx, 'M12 3v8M8.5 7.5L12 11l3.5-3.5'); ctx.beginPath(); ctx.ellipse(12, 17, 8.5, 3.2, 0, 0, 7); ctx.stroke(); },
  plus: ctx => { stroke(ctx, 'M12 5v14M5 12h14'); },
  minus: ctx => { stroke(ctx, 'M5 12h14'); },
  reset: ctx => { stroke(ctx, 'M5 12a7 7 0 117 7'); stroke(ctx, 'M5 7v5h5'); },
  book: ctx => { stroke(ctx, 'M12 6.5c-2.2-1.6-5-2-8-1.5v13c3-.5 5.8-.1 8 1.5 2.2-1.6 5-2 8-1.5V5c-3-.5-5.8-.1-8 1.5z'); stroke(ctx, 'M12 6.5v13'); },
};

// ------------------------------------------------------------- hit registry
/**
 * Items registered while drawing: { id, x, y, w, h, enabled, data }.
 * Directional focus picks the nearest item in the pressed direction.
 */
export function createRegistry() {
  let items = [];
  return {
    reset() { items = []; },
    add(id, x, y, w, h, opts = {}) {
      const item = { id, x, y, w, h, enabled: opts.enabled !== false, focusable: opts.focusable !== false, data: opts.data, hold: Boolean(opts.hold), drag: Boolean(opts.drag) };
      items.push(item);
      return item;
    },
    get items() { return items; },
    hit(px, py) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) return it;
      }
      return null;
    },
    find(id) { return items.find(it => it.id === id) ?? null; },
    firstFocusable() { return items.find(it => it.focusable && it.enabled) ?? items.find(it => it.focusable) ?? null; },
    neighbour(fromId, dir) {
      const from = items.find(it => it.id === fromId);
      const cand = items.filter(it => it.focusable && it !== from);
      if (!from) return cand[0] ?? null;
      const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null, bestScore = Infinity;
      for (const it of cand) {
        const dx = it.x + it.w / 2 - fx, dy = it.y + it.h / 2 - fy;
        const along = dx * v[0] + dy * v[1];
        if (along <= 4) continue;
        const across = Math.abs(dx * v[1] - dy * v[0]);
        const score = along + across * 2.2;
        if (score < bestScore) { bestScore = score; best = it; }
      }
      return best;
    },
  };
}

/** Standard pill button; returns the registry item. */
export function button(ctx, reg, id, x, y, w, h, label, { state = {}, primary = false, icon: ic = null, enabled = true, hint = '', u = 1, align = 'center', danger = false, small = false } = {}) {
  const focused = state.focus === id, hovered = state.hover === id, pressed = state.pressed === id;
  const r = h / 2;
  ctx.save();
  if (primary && enabled) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(112,226,244,0.95)');
    g.addColorStop(1, 'rgba(110,150,255,0.92)');
    if ((focused || hovered) && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.8)'; ctx.shadowBlur = 18 * u; }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    if ((focused || hovered) && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.45)'; ctx.shadowBlur = 14 * u; }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = pressed ? 'rgba(40,90,150,0.75)' : focused || hovered ? 'rgba(24,52,104,0.82)' : 'rgba(9,22,56,0.66)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = danger ? 'rgba(255,143,163,0.7)' : focused ? COLORS.cyan : hovered ? 'rgba(112,226,244,0.7)' : COLORS.line;
    ctx.lineWidth = focused ? 1.6 : 1;
    ctx.stroke();
  }
  const color = primary && enabled ? '#061433' : enabled ? (danger ? COLORS.danger : COLORS.text) : COLORS.faint;
  const size = (small ? 12 : 14) * u;
  let tx = align === 'left' ? x + h * 0.55 : x + w / 2;
  // The label is centred in the room beside the icon and fitted to it.
  let room = w - h * 1.0;
  if (ic) {
    const isz = h * 0.46;
    if (align === 'left') { icon(ctx, ic, x + h * 0.55, y + h / 2, isz, primary && enabled ? '#061433' : COLORS.cyan); tx = x + h * 1.05; room = w - h * 1.6; }
    else {
      icon(ctx, ic, x + h * 0.6, y + h / 2, isz, primary && enabled ? '#061433' : COLORS.cyan);
      const natural = measure(ctx, label.toUpperCase(), size, primary ? 600 : 500, 2.2 * u);
      const left = x + h * 1.0, right = x + w - h * 0.45;
      room = right - left;
      if (natural > w - h * 2.2) tx = (left + right) / 2;
    }
  }
  text(ctx, label.toUpperCase(), tx, y + h / 2 + 0.5, { size, weight: primary ? 600 : 500, color, align: align === 'left' ? 'left' : 'center', tracking: 2.2 * u, maxWidth: Math.max(20, room) });
  if (hint) text(ctx, hint, x + w - h * 0.5, y + h / 2, { size: 11 * u, color: primary ? 'rgba(6,20,51,0.75)' : COLORS.faint, align: 'right' });
  else if (!primary && align === 'left' && enabled) icon(ctx, 'next', x + w - h * 0.55, y + h / 2, h * 0.36, 'rgba(112,226,244,0.75)');
  ctx.restore();
  return reg.add(id, x, y, w, h, { enabled });
}

/**
 * Volume-style slider (0..1) in a pill; the registry item carries the track's
 * x and width in `data` so a tap or drag can set the value directly.
 * `muted` draws the value struck through (the level is kept for un-muting).
 */
export function slider(ctx, reg, id, x, y, w, h, value, { state = {}, u = 1, enabled = true, muted = false } = {}) {
  const focused = state.focus === id, hovered = state.hover === id;
  ctx.save();
  if ((focused || hovered) && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.45)'; ctx.shadowBlur = 12 * u; }
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = focused || hovered ? 'rgba(24,52,104,0.82)' : 'rgba(9,22,56,0.66)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = focused ? COLORS.cyan : hovered ? 'rgba(112,226,244,0.7)' : COLORS.line;
  ctx.lineWidth = focused ? 1.6 : 1;
  ctx.stroke();
  const label = muted ? 'OFF' : `${Math.round(value * 100)}%`;
  const valueW = 46 * u;
  const tx = x + h * 0.55, tw = Math.max(20, w - h * 0.55 - valueW - 8 * u), ty = y + h / 2;
  roundRect(ctx, tx, ty - 2 * u, tw, 4 * u, 2 * u);
  ctx.fillStyle = 'rgba(120,150,200,0.28)';
  ctx.fill();
  const v = Math.max(0, Math.min(1, value));
  if (v > 0) {
    roundRect(ctx, tx, ty - 2 * u, tw * v, 4 * u, 2 * u);
    ctx.fillStyle = muted ? 'rgba(160,180,210,0.45)' : COLORS.cyan;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(tx + tw * v, ty, h * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = muted ? '#8fa2bf' : COLORS.text;
  ctx.fill();
  ctx.restore();
  text(ctx, label, x + w - h * 0.45, ty, { size: 12 * u, weight: 500, color: muted ? COLORS.faint : COLORS.text, align: 'right' });
  return reg.add(id, x, y, w, h, { enabled, data: { x: tx, w: tw }, drag: true });
}

/** IMG 07 round icon button with label below (and optional key hint). */
export function roundButton(ctx, reg, id, cx, cy, radius, ic, label, { state = {}, active = false, enabled = true, hint = '', u = 1, hold = false, accent = COLORS.cyan, labelBelow = true } = {}) {
  const focused = state.focus === id, hovered = state.hover === id, pressed = state.pressed === id || active;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? 'rgba(60,140,200,0.55)' : 'rgba(8,22,58,0.55)';
  if ((focused || hovered || pressed) && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.7)'; ctx.shadowBlur = 16 * u; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = !enabled ? 'rgba(140,170,210,0.25)' : pressed || focused ? accent : 'rgba(150,215,250,0.6)';
  ctx.lineWidth = pressed || focused ? 1.8 : 1.2;
  ctx.stroke();
  icon(ctx, ic, cx, cy, radius * 0.95, enabled ? (pressed ? '#ffffff' : COLORS.text) : COLORS.faint, 1.5);
  if (label && labelBelow) {
    text(ctx, label.toUpperCase(), cx, cy + radius + 13 * u, { size: 10.5 * u, weight: 500, color: enabled ? COLORS.text : COLORS.faint, align: 'center', tracking: 2 * u, shadow: true });
    if (hint) text(ctx, hint, cx, cy + radius + 27 * u, { size: 10 * u, color: COLORS.faint, align: 'center', shadow: true });
    else { ctx.beginPath(); ctx.arc(cx, cy + radius + 25 * u, 1.6 * u, 0, 7); ctx.fillStyle = 'rgba(150,215,250,0.6)'; ctx.fill(); }
  }
  ctx.restore();
  return reg.add(id, cx - radius, cy - radius, radius * 2, radius * 2, { enabled, hold });
}

export function vignette(ctx, w, h, strength = 0.55) {
  if (!UI_FX.shadows) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(3,8,26,0)');
  g.addColorStop(1, `rgba(3,8,26,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function title(ctx, x, y, size, { align = 'left', u = 1, glow = true } = {}) {
  // "The-X-plorator" with the X emphasised in ion cyan.
  const parts = [['The-', COLORS.text], ['X', COLORS.cyan], ['-plorator', COLORS.text]];
  const tracking = size * 0.22;
  setFont(ctx, size, 300);
  const widths = parts.map(([s]) => measure(ctx, s, size, 300, tracking) + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  parts.forEach(([s, c], i) => {
    const big = s === 'X';
    if (glow && big && UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.9)'; ctx.shadowBlur = 18 * u; }
    text(ctx, s, cx, y, { size: big ? size * 1.18 : size, weight: big ? 400 : 300, color: c, tracking });
    ctx.shadowBlur = 0;
    cx += widths[i];
  });
  return total;
}
