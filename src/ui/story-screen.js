import * as THREE from 'three';
import { COLORS, UI_FX, text, paragraph, button, roundRect, measure, setFont, icon } from './kit.js';
import { SPRITE } from './overlay.js';
import { STORY, PAGE, t, beatText } from '../story/story.js';
import { createStoryState } from '../story/story-state.js';

/**
 * EXODUS PROLOGUE viewer: the seven approved beats with every word drawn as
 * text from the string table. One story, one set of events, three layouts:
 *   page   desktop / wide windows: the approved page, panels clipped to their
 *          angled outlines, revealed one by one (future panels veiled);
 *   single phone portrait: one panel per step in a framed crop, the
 *          narration on a card below;
 *   cinema phone landscape: one wide frame, text beside it.
 * It is shown from the first frames of the real boot; BEGIN appears only
 * when the game is ready and stays until used (story-state.js). Art loads
 * lazily and is drawn into the interface canvas (no WebGL textures).
 */
const PLATE = '#f4e6c3', PLATE_EDGE = '#14161d', INK = '#11131a', PAPER = '#f2efe7', ORANGE = '#f39a3b', LILAC = '#8e9cf0';

// ------------------------------------------------------------- art cache
function createArtCache(p0, onChange) {
  const loader = new THREE.ImageBitmapLoader();
  const entries = new Map();
  const qa = p0.qa ?? {};
  const load = file => {
    const existing = entries.get(file);
    if (existing && existing.state !== 'failed') return existing;
    const e = { file, state: 'loading', bitmap: null, ms: 0, attempts: (existing?.attempts ?? 0) + 1 };
    entries.set(file, e);
    const t0 = performance.now();
    const go = () => loader.load(p0.asset(file), bitmap => {
      e.state = 'ready'; e.bitmap = bitmap; e.ms = performance.now() - t0;
      p0.log?.(`[xplorator] prologue art ${file} ready in ${Math.round(e.ms)} ms (at ${Math.round(performance.now())} ms)`);
      onChange();
    }, undefined, err => {
      e.state = 'failed'; e.error = String(err?.message ?? err ?? 'error'); e.ms = performance.now() - t0;
      p0.log?.(`[xplorator] prologue art failed: ${file} (${e.error})`);
      onChange();
    });
    // Local test switches only (standalone page): ?artdelay=ms, ?artfail=N (first try of panel N fails).
    const failN = Number(qa.artfail);
    if (failN && file.endsWith(`panel_0${failN}.webp`) && e.attempts === 1) {
      setTimeout(() => { e.state = 'failed'; e.error = 'simulated failure'; onChange(); }, 300);
    } else if (Number(qa.artdelay) > 0) setTimeout(go, Number(qa.artdelay));
    else go();
    return e;
  };
  return {
    load,
    get: file => entries.get(file) ?? null,
    stats() { return [...entries.values()].map(e => ({ file: e.file, state: e.state, ms: Math.round(e.ms), attempts: e.attempts })); },
  };
}

// ------------------------------------------------------------- geometry
const polyPath = (ctx, poly, ox, oy, s) => {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * s, oy + y * s) : ctx.moveTo(ox + x * s, oy + y * s)));
  ctx.closePath();
};

/** Vertical span fully inside the polygon over the x range [x0, x1] (local px). */
function innerSpan(poly, x0, x1) {
  let top = -Infinity, bottom = Infinity;
  for (let x = x0; x <= x1; x += Math.max(1, (x1 - x0) / 24)) {
    const ys = [];
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      if ((ax <= x && bx >= x) || (bx <= x && ax >= x)) {
        if (ax === bx) { ys.push(ay, by); continue; }
        ys.push(ay + (by - ay) * (x - ax) / (bx - ax));
      }
    }
    if (ys.length < 2) continue;
    top = Math.max(top, Math.min(...ys));
    bottom = Math.min(bottom, Math.max(...ys));
  }
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom > top ? [top, bottom] : null;
}

/** Splits text into lines no wider than `maxWidth` at `size`. */
function wrap(ctx, str, maxWidth, size, weight) {
  setFont(ctx, size, weight);
  const lines = [];
  let line = '';
  for (const word of String(str).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Like wrap(), but with lines of even length (speech balloons read better). */
function wrapBalanced(ctx, str, maxWidth, size, weight) {
  const greedy = wrap(ctx, str, maxWidth, size, weight);
  if (greedy.length < 2) return greedy;
  const words = String(str).split(/\s+/);
  setFont(ctx, size, weight);
  // Narrowest width that still needs no more lines than the greedy wrap.
  let lo = 0, hi = maxWidth;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (wrap(ctx, str, mid, size, weight).length <= greedy.length && words.every(wd => ctx.measureText(wd).width <= mid)) hi = mid; else lo = mid;
  }
  return wrap(ctx, str, hi + 0.5, size, weight);
}

// ------------------------------------------------------------- the screen
export function createStoryScreen({ p0, boot, isReducedMotion = () => false, onBegin, onLeave, onRetry, onPanel = null, deviceHint = () => 'kbm' }) {
  let mode = 'story'; // story | welcome
  let layout = 'page';
  let note = '';
  let swipe = null;
  let art = null;
  let lastHud = '';
  let lastViewKey = '';
  const story = createStoryState({ count: STORY.length, isReady: () => boot.ready, isFailed: () => Boolean(boot.failed) });
  let screenRef = null;
  const invalidate = () => screenRef?.ui?.invalidate();
  art = createArtCache(p0, () => { invalidate(); plan(); });

  const setFor = () => (layout === 'page' ? 'wide' : 'tall');
  // Loading plan: the current beat first, then the next one; the desktop page
  // shows every panel, so it fetches them one after another in story order.
  function plan() {
    const set = setFor();
    const want = mode === 'welcome' ? [STORY.length - 1] : layout === 'page' ? STORY.map((_, i) => i) : [story.index, story.index + 1, story.index - 1];
    for (const i of want) {
      const b = STORY[i];
      if (!b) continue;
      const e = art.get(b.art[set].file);
      if (!e) { art.load(b.art[set].file); return; } // one at a time, in order
      if (e.state === 'loading') return;
    }
  }

  function layoutFor(view) {
    if (mode === 'welcome') return view.portrait ? 'single' : 'cinema';
    if (!view.portrait && !view.phone && view.w >= 900 && view.h >= 520 && view.w / view.h >= 1.3) return 'page';
    if (!view.portrait) return 'cinema';
    return 'single';
  }

  function hudText() {
    const beat = STORY[story.index];
    const hint = deviceHint() === 'touch' ? t('story.ui.hintTouch') : deviceHint() === 'pad' ? t('story.ui.hintPad') : t('story.ui.hintKeys');
    return `${t('story.title')} ${t('story.subtitle')}\n${beatText(beat)}\n${hint}`;
  }
  function syncHud() {
    if (mode !== 'story') return;
    const s = hudText();
    if (s !== lastHud) { lastHud = s; try { p0.hud?.(s.slice(0, 400)); } catch { /* optional */ } }
  }

  function go(action) {
    note = '';
    if (action === 'next') story.next();
    else if (action === 'back') story.back();
    else if (action === 'skip') { if (story.skip() === 'begin') { onBegin?.({ skipped: true }); return; } }
    else if (action === 'begin') return begin();
    else if (action === 'retry') { onRetry?.(); return; }
    plan();
    syncHud();
    onPanel?.(story.index);
  }
  function begin() {
    if (!story.canBegin() && !(mode === 'welcome' && boot.ready)) {
      note = boot.failed ? '' : t('story.ui.preparing');
      return;
    }
    onBegin?.({ replayed: false });
  }

  // ----------------------------------------------------------- drawing parts
  function drawTitle(ctx, x, y, size, align = 'center', u = 1) {
    const parts = [['THE ', COLORS.text], ['X', ORANGE], ['-PLORATOR', COLORS.text], [':  ', COLORS.text], [t('story.subtitle'), LILAC]];
    const tracking = size * 0.16;
    const widths = parts.map(([s2]) => measure(ctx, s2, size, 800, tracking) + tracking);
    const total = widths.reduce((a, b) => a + b, 0) - tracking;
    let cx = align === 'center' ? x - total / 2 : x;
    parts.forEach(([s2, c], i) => { text(ctx, s2, cx, y, { size, weight: 800, color: c, tracking }); cx += widths[i]; });
    void u;
    return total;
  }

  function captionPlate(ctx, str, x, y, { size, minW = 0, minH = 0 }) {
    const label = str.toUpperCase();
    const tw = measure(ctx, label, size, 800, size * 0.12);
    const w = Math.max(minW, tw + size * 1.3), h = Math.max(minH, size * 2.0);
    ctx.save();
    ctx.fillStyle = PLATE;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PLATE_EDGE; ctx.lineWidth = Math.max(1.5, size * 0.14);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    text(ctx, label, x + size * 0.65, y + h / 2 + 0.5, { size, weight: 800, color: INK, tracking: size * 0.12 });
    return { w, h };
  }

  /** Writes the bubble text into the cleared balloon (screen rect), or draws a bigger balloon over it. */
  function balloonText(ctx, str, box, shape, { minSize, maxSize, clip = null }) {
    if (!str) return;
    const pad = 4;
    // Room for words: the drawn balloon's body (an ellipse holds a rectangle
    // of about 72 % x 62 % of its box), centred where the original words were.
    if (shape.w > box.w) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const bw = Math.max(box.w, shape.w * 0.72), bh = Math.max(box.h, shape.h * 0.5);
      box = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
    }
    let size = maxSize, lines = null;
    for (; size >= minSize; size -= 0.5) {
      lines = wrapBalanced(ctx, str, box.w - pad * 2, size, 600);
      const longest = Math.max(...lines.map(l => (setFont(ctx, size, 600), ctx.measureText(l).width)));
      if (lines.length * size * 1.18 <= box.h && longest <= box.w - pad) break;
    }
    if (size < minSize) {
      // Does not fit the drawn balloon: an own balloon over it, sized to the words.
      size = minSize;
      lines = wrapBalanced(ctx, str, Math.max(box.w * 1.6, minSize * 9), size, 600);
      const longest = Math.max(...lines.map(l => (setFont(ctx, size, 600), ctx.measureText(l).width)));
      const bw = Math.max(shape.w, longest + size * 2.2), bh = Math.max(shape.h, lines.length * size * 1.25 + size * 1.4);
      let cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
      if (clip) {
        cx = Math.max(clip.x + bw / 2 + 4, Math.min(clip.x + clip.w - bw / 2 - 4, cx));
        cy = Math.max(clip.y + bh / 2 + 4, Math.min(clip.y + clip.h - bh / 2 - 4, cy));
      }
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      box = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
    }
    setFont(ctx, size, 600);
    ctx.save();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = size * 1.18, y0 = box.y + box.h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, box.x + box.w / 2, y0 + i * lh));
    ctx.restore();
  }

  /** An own speech balloon inside a frame (the drawn one is out of view). */
  function ownBalloon(ctx, str, frame, side, size, below = 0) {
    if (!str) return;
    const lines = wrap(ctx, str, Math.min(frame.w * 0.5, size * 11), size, 600);
    setFont(ctx, size, 600);
    const longest = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bw = longest + size * 2.2, bh = lines.length * size * 1.22 + size * 1.3;
    const cx = side === 'left' ? frame.x + bw / 2 + 10 : frame.x + frame.w - bw / 2 - 10;
    const cy = Math.min(frame.y + frame.h - bh / 2 - 14, frame.y + Math.max(10, below + 8) + bh / 2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    const tx = side === 'left' ? cx - bw * 0.15 : cx + bw * 0.15;
    ctx.moveTo(tx - 6, cy + bh / 2 - 3); ctx.lineTo(tx + (side === 'left' ? -14 : 14), cy + bh / 2 + 12); ctx.lineTo(tx + 6, cy + bh / 2 - 3);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    balloonText(ctx, str, { x: cx - bw / 2 + size * 0.6, y: cy - bh / 2 + 2, w: bw - size * 1.2, h: bh - 4 }, { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }, { minSize: size, maxSize: size });
  }

  function missingArt(ctx, reg, state, beat, rect, entry, u) {
    ctx.save();
    ctx.fillStyle = '#0b1530';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (!entry || entry.state === 'loading') {
      text(ctx, '…', rect.x + rect.w / 2, rect.y + rect.h / 2, { size: 22 * u, color: COLORS.faint, align: 'center' });
      return;
    }
    text(ctx, t('story.ui.imageMissing'), rect.x + rect.w / 2, rect.y + rect.h / 2 - 16 * u, { size: 12 * u, color: COLORS.dim, align: 'center', maxWidth: rect.w - 20 });
    const bw = Math.min(rect.w - 20, 170 * u);
    button(ctx, reg, `img-${beat.n}`, rect.x + rect.w / 2 - bw / 2, rect.y + rect.h / 2 + 2 * u, bw, 44, t('story.ui.imageRetry'), { state, u, small: true });
  }

  // ----------------------------------------------------------- footer (all layouts)
  function statusLine(ctx, view, cx, y, maxW, reg = null, state = null) {
    const { u } = view;
    const failed = boot.failed;
    if (failed) {
      // Reported at once, with its own Retry: reading can go on meanwhile.
      const msg = `${t('story.ui.failed')} (${failed.label}).`;
      const rw = 104 * u;
      const tw = Math.min(maxW - rw - 10 * u, measure(ctx, msg, 12.5 * u, 400));
      text(ctx, msg, cx - (rw + 10 * u) / 2, y, { size: 12.5 * u, color: COLORS.rose, align: 'center', maxWidth: tw });
      if (reg && !(story.atEnd || mode === 'welcome')) button(ctx, reg, 'retry', cx + tw / 2 - rw / 2 + 5 * u, y - 22, rw, 44, t('story.ui.retry'), { state, u, small: true, icon: 'reset' });
      return 'failed';
    }
    if (boot.ready) return 'ready';
    if (!story.atEnd && mode !== 'welcome') return 'reading';
    const stalled = boot.idleSeconds() > 25;
    const label = stalled ? t('story.ui.still') : `${t('story.ui.preparing').toUpperCase()}  ·  ${boot.current?.label ?? ''}`;
    text(ctx, label, cx, y, { size: 12 * u, color: COLORS.cyan, align: 'center', tracking: stalled ? 0 : 1.6 * u, maxWidth: maxW });
    // Real progress of the required boot tasks (no timer, never a fake 100 %).
    const bw = Math.min(maxW * 0.6, 260 * u);
    roundRect(ctx, cx - bw / 2, y + 12 * u, bw, 3 * u, 1.5 * u); ctx.fillStyle = 'rgba(112,226,244,0.18)'; ctx.fill();
    roundRect(ctx, cx - bw / 2, y + 12 * u, bw * boot.fraction, 3 * u, 1.5 * u); ctx.fillStyle = COLORS.cyan; ctx.fill();
    spinnerAt = { x: cx - measure(ctx, label, 12 * u, 400, 1.6 * u) / 2 - 16 * u, y, r: 7 * u };
    return 'waiting';
  }
  let spinnerAt = null;

  function primaryLabel() {
    const p = mode === 'welcome' ? (boot.failed ? 'retry' : boot.ready ? 'begin' : 'wait') : story.primary();
    return { p, label: p === 'next' ? t('story.ui.next') : p === 'begin' ? t('story.ui.begin') : p === 'retry' ? t('story.ui.retry') : t('story.ui.preparing') };
  }

  function dots(ctx, cx, y, u) {
    const n = STORY.length, gap = 14 * u;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (n - 1) / 2) * gap, y, i === story.index ? 4 * u : 3 * u, 0, Math.PI * 2);
      ctx.fillStyle = i === story.index ? COLORS.cyan : i <= story.furthest ? 'rgba(214,234,250,0.7)' : 'rgba(214,234,250,0.25)';
      ctx.fill();
    }
  }

  function buttonsRow(ctx, reg, state, view, x, y, w) {
    const { u } = view;
    const bh = Math.max(44, 48 * u);
    const { p, label } = primaryLabel();
    const backW = w < 300 * u ? Math.max(56, w * 0.24) : Math.min(w * 0.36, 210 * u);
    const primW = w - backW - 12 * u;
    if (mode === 'welcome' && p !== 'retry') {
      button(ctx, reg, 'primary', x, y, w, bh, label, { state, u, primary: p !== 'wait', enabled: p !== 'wait', icon: 'next' });
      return bh;
    }
    if (p === 'retry') {
      button(ctx, reg, 'leave', x, y, backW, bh, t('story.ui.leave'), { state, u });
      button(ctx, reg, 'primary', x + backW + 12 * u, y, primW, bh, label, { state, u, primary: true, icon: 'reset' });
      return bh;
    }
    // A narrow column keeps only the arrow on Back (its meaning is unchanged).
    button(ctx, reg, 'back', x, y, backW, bh, backW < 120 * u ? '' : t('story.ui.back'), { state, u, icon: 'back', enabled: mode === 'story' && story.index > 0 });
    button(ctx, reg, 'primary', x + backW + 12 * u, y, primW, bh, label, { state, u, primary: p !== 'wait', enabled: p !== 'wait', icon: p === 'begin' ? 'star' : 'next' });
    return bh;
  }

  // ----------------------------------------------------------- layouts
  function drawPage(ctx, view, reg, state) {
    const { w, h, u, pad } = view;
    const top = Math.max(view.p0Top, pad) + 4 * u;
    const titleSize = Math.min(30 * u, w / 34);
    drawTitle(ctx, w / 2, top + titleSize * 0.6, titleSize, 'center', u);
    const sk = measure(ctx, t('story.ui.skip').toUpperCase(), 12 * u, 500, 2 * u) + 44 * u;
    button(ctx, reg, 'skip', w - pad * 2 - sk, top, sk, 44, t('story.ui.skip'), { state, u, small: true });
    const tw = measure(ctx, t('story.ui.transcript').toUpperCase(), 12 * u, 500, 2 * u) + 44 * u;
    button(ctx, reg, 'transcript', pad * 2, top, tw, 44, t('story.ui.transcript'), { state, u, small: true });

    const bandTop = top + 54 * u, bandBottom = 132 * u;
    const availW = w - pad * 4, availH = h - bandTop - bandBottom - pad;
    const [PW, PH] = PAGE.wide;
    const s = Math.min(availW / PW, availH / PH);
    const ox = (w - PW * s) / 2, oy = bandTop + (availH - PH * s) / 2;
    // Paper (the white gutters) inside a dark frame.
    ctx.fillStyle = '#020308';
    ctx.fillRect(ox - 8 * u, oy - 8 * u, PW * s + 16 * u, PH * s + 16 * u);
    ctx.fillStyle = PAPER;
    ctx.fillRect(ox, oy, PW * s, PH * s);
    STORY.forEach((beat, i) => {
      const a = beat.art.wide;
      const px = ox + a.at[0] * s, py = oy + a.at[1] * s;
      const entry = art.get(a.file);
      ctx.save();
      polyPath(ctx, a.poly, px, py, s);
      ctx.clip();
      if (entry?.state === 'ready') {
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(entry.bitmap, px, py, a.width * s, a.height * s);
      } else if (i <= story.index) {
        missingArt(ctx, reg, state, beat, { x: px, y: py, w: a.width * s, h: a.height * s }, entry, u);
      } else {
        ctx.fillStyle = '#060a16'; ctx.fillRect(px, py, a.width * s, a.height * s);
      }
      if (i > story.index) {
        // Not read yet: veiled, with its number.
        ctx.fillStyle = 'rgba(3,6,16,0.86)';
        ctx.fillRect(px, py, a.width * s, a.height * s);
        const c = a.poly.reduce((m, q) => [m[0] + q[0] / a.poly.length, m[1] + q[1] / a.poly.length], [0, 0]);
        text(ctx, String(beat.n).padStart(2, '0'), px + c[0] * s, py + c[1] * s, { size: 28 * u, weight: 200, color: 'rgba(214,234,250,0.28)', align: 'center', tracking: 4 * u });
      }
      ctx.restore();
      // Outline: dark ink, the current panel lit.
      ctx.save();
      polyPath(ctx, a.poly, px, py, s);
      ctx.strokeStyle = PLATE_EDGE; ctx.lineWidth = Math.max(2, 3 * s); ctx.stroke();
      if (i === story.index) {
        if (UI_FX.shadows) { ctx.shadowColor = 'rgba(112,226,244,0.9)'; ctx.shadowBlur = 14 * u; }
        ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 2.5 * u; ctx.stroke();
      }
      ctx.restore();
      if (i <= story.index && entry?.state === 'ready') {
        if (a.balloon && t(beat.bubble)) {
          const b = a.balloon;
          balloonText(ctx, t(beat.bubble), { x: px + b.text[0] * s, y: py + b.text[1] * s, w: b.text[2] * s, h: b.text[3] * s },
            { x: px + b.shape[0] * s, y: py + b.shape[1] * s, w: b.shape[2] * s, h: b.shape[3] * s }, { minSize: 12.5 * u, maxSize: 22 * u });
        }
        // The caption plate last: nothing may cover the panel's title.
        const size = Math.max(12 * u, Math.min(20 * u, a.plate[3] * s * 0.5));
        captionPlate(ctx, t(beat.caption), px + Math.max(0, a.plate[0]) * s, py + a.plate[1] * s, { size, minW: (a.plate[0] + a.plate[2]) * s, minH: a.plate[3] * s + 2 });
      }
    });
    // Narration and controls.
    const beat = STORY[mode === 'welcome' ? STORY.length - 1 : story.index];
    const ny = oy + PH * s + 22 * u;
    const line = `${String(beat.n).padStart(2, '0')}   ${t(beat.narration)}`;
    text(ctx, line, w / 2, ny, { size: 16 * u, color: COLORS.text, align: 'center', maxWidth: w - pad * 6 });
    const status = statusLine(ctx, view, w / 2, ny + 30 * u, w * 0.6, reg, state);
    const rowW = Math.min(620 * u, w - pad * 6);
    const by = h - pad - Math.max(44, 48 * u);
    buttonsRow(ctx, reg, state, view, w / 2 - rowW / 2, by, rowW);
    if (status === 'reading' || status === 'ready') dots(ctx, w / 2, by - 14 * u, u);
    return { s };
  }

  /** Frame with a cover crop of a tall-set panel; returns the visible window. */
  function drawFrame(ctx, reg, state, view, beat, frame) {
    const { u } = view;
    const a = beat.art.tall;
    const entry = art.get(a.file);
    // Comic frame: paper border and ink outline, the bottom edge slightly angled.
    const slant = 10 * u;
    const outline = [[frame.x, frame.y], [frame.x + frame.w, frame.y], [frame.x + frame.w, frame.y + frame.h - slant], [frame.x, frame.y + frame.h]];
    ctx.save();
    ctx.beginPath();
    outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.restore();
    const inset = 5 * u;
    const inner = { x: frame.x + inset, y: frame.y + inset, w: frame.w - inset * 2, h: frame.h - inset * 2 - slant / 2 };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y); ctx.lineTo(inner.x + inner.w, inner.y); ctx.lineTo(inner.x + inner.w, inner.y + inner.h - slant); ctx.lineTo(inner.x, inner.y + inner.h);
    ctx.closePath();
    ctx.clip();
    let win = null;
    if (entry?.state === 'ready') {
      // Source window: the panel's full art height (inside its angled edges),
      // as wide as the frame's aspect allows, centred on the beat's focus.
      const span = innerSpan(a.poly, 0, a.width) ?? [0, a.height];
      let srcH = span[1] - span[0];
      let srcW = srcH * inner.w / inner.h;
      if (srcW > a.width) { srcW = a.width; srcH = srcW * inner.h / inner.w; }
      let srcX = beat.focus * a.width - srcW / 2;
      // Slide the window just enough to keep the drawn balloon whole, when it fits.
      if (beat.slide && a.balloon && t(beat.bubble)) {
        const [bx, , bw] = a.balloon.shape, m = 8;
        if (bw + m * 2 <= srcW) srcX = Math.max(bx + bw + m - srcW, Math.min(bx - m, srcX));
      }
      srcX = Math.max(0, Math.min(a.width - srcW, srcX));
      const srcY = span[0] + ((span[1] - span[0]) - srcH) / 2;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(entry.bitmap, srcX, srcY, srcW, srcH, inner.x, inner.y, inner.w, inner.h);
      win = { srcX, srcY, srcW, srcH, sc: inner.w / srcW };
    } else {
      missingArt(ctx, reg, state, beat, inner, entry, u);
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y); ctx.lineTo(inner.x + inner.w, inner.y); ctx.lineTo(inner.x + inner.w, inner.y + inner.h - slant); ctx.lineTo(inner.x, inner.y + inner.h);
    ctx.closePath();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
    if (!win) return inner;
    const toScreen = (x, y) => [inner.x + (x - win.srcX) * win.sc, inner.y + (y - win.srcY) * win.sc];
    // Caption plate in the frame's corner: it also covers the place where the
    // drawn plate was painted out of the art whenever that place is in view.
    // Measured first, drawn last (nothing may cover the title).
    const size = Math.max(13 * u, Math.min(17 * u, inner.h * 0.075));
    const [, plateBottom] = toScreen(0, a.plate[1] + a.plate[3]);
    const [plateRight] = toScreen(a.plate[0] + a.plate[2], 0);
    const plateMinW = Math.min(inner.w - 6, Math.max(0, plateRight - inner.x));
    const plateH = Math.max(size * 2, Math.max(0, plateBottom - inner.y));
    const bubble = t(beat.bubble);
    if (a.balloon && bubble) {
      const b = a.balloon;
      const [sx0, sy0] = toScreen(b.shape[0], b.shape[1]);
      const [sx1, sy1] = toScreen(b.shape[0] + b.shape[2], b.shape[1] + b.shape[3]);
      const visible = sx0 >= inner.x && sx1 <= inner.x + inner.w;
      const partly = sx1 > inner.x && sx0 < inner.x + inner.w;
      if (visible) {
        const [tx0, ty0] = toScreen(b.text[0], b.text[1]);
        balloonText(ctx, bubble, { x: tx0, y: ty0, w: b.text[2] * win.sc, h: b.text[3] * win.sc }, { x: sx0, y: sy0, w: sx1 - sx0, h: sy1 - sy0 },
          { minSize: 13 * u, maxSize: 20 * u, clip: inner });
      } else if (partly) {
        // Cut by the frame edge: a whole balloon of the game's own, kept in the
        // frame and covering the visible part of the drawn one.
        const vx0 = Math.max(sx0, inner.x), vx1 = Math.min(sx1, inner.x + inner.w);
        const cut = { x: vx0, y: sy0, w: vx1 - vx0, h: sy1 - sy0 };
        balloonText(ctx, bubble, { x: cut.x + cut.w / 2, y: cut.y + cut.h / 2, w: 0, h: 0 }, cut, { minSize: 13 * u, maxSize: 13 * u - 0.01, clip: inner });
      } else {
        ownBalloon(ctx, bubble, inner, sx0 < inner.x ? 'left' : 'right', 13 * u, plateH + 3);
      }
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(inner.x, inner.y, inner.w, inner.h); ctx.clip();
    captionPlate(ctx, t(beat.caption), inner.x + 3, inner.y + 3, { size, minW: plateMinW, minH: plateH });
    ctx.restore();
    return inner;
  }

  function drawSingle(ctx, view, reg, state) {
    const { w, h, u, pad } = view;
    const top = Math.max(view.p0Top, pad) + 6 * u;
    const titleSize = Math.min(18 * u, w / 24);
    drawTitle(ctx, w / 2, top + titleSize * 0.7, titleSize, 'center', u);
    const rowY = top + titleSize * 1.6;
    const sk = Math.min(150 * u, w * 0.4);
    if (mode === 'welcome') button(ctx, reg, 'replay', w / 2 - sk * 0.7, rowY, sk * 1.4, 44, t('story.ui.replay'), { state, u, small: true });
    else {
      button(ctx, reg, 'transcript', pad, rowY, sk, 44, t('story.ui.transcript'), { state, u, small: true });
      button(ctx, reg, 'skip', w - pad - sk, rowY, sk, 44, t('story.ui.skip'), { state, u, small: true });
    }
    const beat = STORY[mode === 'welcome' ? STORY.length - 1 : story.index];
    const bh = Math.max(44, 48 * u);
    const footer = bh + pad + view.safeBottom + 30 * u;
    const fw = w - pad * 2;
    const size = Math.min(17 * u, Math.max(14, w / 26));
    const words = mode === 'welcome' ? t('story.ui.welcomeBack') : t(beat.narration);
    setFont(ctx, size, 500);
    const lines = wrap(ctx, words, fw - 32 * u, size, 500);
    const ch = lines.length * size * 1.4 + 26 * u;
    // Frame and card as one block, centred in the room above the controls.
    const roomTop = rowY + 44 + 12 * u, roomBottom = h - footer - 40 * u;
    const fh = Math.max(120, Math.min(fw / 1.3, roomBottom - roomTop - ch - 12 * u));
    const frameTop = roomTop + Math.max(0, (roomBottom - roomTop - (fh + 12 * u + ch)) / 2);
    drawFrame(ctx, reg, state, view, beat, { x: pad, y: frameTop, w: fw, h: fh });
    // Narration card.
    const cy = frameTop + fh + 12 * u;
    ctx.save();
    roundRect(ctx, pad, cy, fw, ch, 6 * u);
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.restore();
    paragraph(ctx, words, pad + 16 * u, cy + 13 * u, fw - 32 * u, { size, lineHeight: 1.4, color: INK, weight: 500 });
    const by = h - pad - view.safeBottom - bh;
    const status = statusLine(ctx, view, w / 2, Math.min(by - 34 * u, cy + ch + 26 * u), w - pad * 2, reg, state);
    buttonsRow(ctx, reg, state, view, pad, by, w - pad * 2);
    if (status === 'reading' || status === 'ready') dots(ctx, w / 2, by - 16 * u, u);
  }

  function drawCinema(ctx, view, reg, state) {
    const { w, h, u, pad } = view;
    const left = pad + view.safeX, right = w - pad - view.safeX;
    const top = Math.max(view.p0Top, pad) + 2 * u;
    const beat = STORY[mode === 'welcome' ? STORY.length - 1 : story.index];
    const fw = (right - left) * 0.64;
    const fh = Math.min(h - top - pad - view.safeBottom, fw / 2.0);
    drawFrame(ctx, reg, state, view, beat, { x: left, y: top, w: fw, h: fh });
    const cx = left + fw + 16 * u, cw = right - cx;
    const titleSize = Math.min(14 * u, cw / 15);
    drawTitle(ctx, cx, top + 8 * u, titleSize, 'left', u);
    const sk = (cw - 8 * u) / 2;
    if (mode === 'welcome') button(ctx, reg, 'replay', cx, top + 22 * u, cw, 44, t('story.ui.replay'), { state, u, small: true });
    else {
      button(ctx, reg, 'transcript', cx, top + 22 * u, sk, 44, t('story.ui.transcript'), { state, u, small: true });
      button(ctx, reg, 'skip', cx + sk + 8 * u, top + 22 * u, sk, 44, t('story.ui.skip'), { state, u, small: true });
    }
    const size = Math.min(15 * u, Math.max(13, cw / 17));
    const ny = top + 22 * u + 44 + 12 * u;
    paragraph(ctx, mode === 'welcome' ? t('story.ui.welcomeBack') : t(beat.narration), cx, ny, cw, { size, lineHeight: 1.35, color: COLORS.text, weight: 500, maxLines: 4 });
    const bh = Math.max(44, 46 * u);
    const by = h - pad - view.safeBottom - bh;
    const status = statusLine(ctx, view, cx + cw / 2, by - 30 * u, cw, reg, state);
    buttonsRow(ctx, reg, state, view, cx, by, cw);
    if (status === 'reading' || status === 'ready') dots(ctx, cx + cw / 2, by - 14 * u, u);
  }

  const screen = {
    id: 'story',
    menuInput: true,
    defaultFocus: () => 'primary',
    get index() { return story.index; },
    get layout() { return layout; },
    get mode() { return mode; },
    debug() { return { index: story.index, mode, layout, primary: primaryLabel().p, ready: boot.ready, art: art.stats() }; },
    enter(params = {}) {
      mode = params.mode === 'welcome' ? 'welcome' : 'story';
      if (params.restart !== false) story.reset();
      if (screen.ui) layout = layoutFor(screen.ui.view);
      note = '';
      lastHud = '';
      screenRef = screen;
      plan();
      syncHud();
    },
    signature() {
      const view = screen.ui?.view;
      const key = view ? `${view.w}x${view.h}` : '';
      if (key !== lastViewKey && view) { lastViewKey = key; layout = layoutFor(view); plan(); }
      const failed = boot.failed;
      // Boot progress is only on screen on the last panel or the welcome
      // card: elsewhere it must not redraw the page (a full-canvas upload,
      // costly on software renderers while the shaders are compiling).
      const progressShown = !boot.ready && (story.atEnd || mode === 'welcome');
      const progress = progressShown ? `${Math.round(boot.fraction * 20)}|${boot.current?.id ?? ''}|${boot.idleSeconds() > 25}` : '';
      return [mode, layout, story.index, story.furthest, boot.ready, failed?.id ?? '', progress,
        note, art.stats().map(e => e.state[0]).join(''), deviceHint()].join('|');
    },
    draw(ctx, view, reg, state) {
      layout = layoutFor(view);
      spinnerAt = null;
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, view.w, view.h);
      if (UI_FX.shadows) {
        const g = ctx.createRadialGradient(view.w * 0.5, view.h * 0.4, 0, view.w * 0.5, view.h * 0.4, Math.max(view.w, view.h) * 0.7);
        g.addColorStop(0, 'rgba(26,44,96,0.55)'); g.addColorStop(1, 'rgba(4,6,13,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
      }
      if (layout === 'page') drawPage(ctx, view, reg, state);
      else if (layout === 'single') drawSingle(ctx, view, reg, state);
      else drawCinema(ctx, view, reg, state);
      if (note) text(ctx, note, view.w / 2, view.h * 0.5, { size: 13 * view.u, color: COLORS.cyan, align: 'center' });
    },
    sprites(overlay, view) {
      if (!spinnerAt || boot.ready || boot.failed) return;
      const spin = isReducedMotion() ? 0 : performance.now() / 420;
      overlay.sprite(spinnerAt.x, spinnerAt.y, spinnerAt.r * 2.6, SPRITE.ARC, [0.44, 0.89, 0.96, 0.95], { rotation: spin, param: 0.3 });
      void view;
    },
    onNav(dir) {
      if (mode !== 'story') return false;
      if (dir === 'right') { go('next'); return true; }
      if (dir === 'left') { go('back'); return true; }
      return false;
    },
    onAction(id) {
      if (id === 'primary') {
        const { p } = primaryLabel();
        if (p === 'wait') return;
        go(p);
      } else if (id === 'back') go('back');
      else if (id === 'skip') go('skip');
      else if (id === 'leave') onLeave?.();
      else if (id === 'retry') onRetry?.();
      else if (id === 'transcript') screen.ui.push('transcript');
      else if (id === 'replay') { screen.enter({ mode: 'story' }); invalidate(); }
      else if (id.startsWith('img-')) {
        const beat = STORY[Number(id.slice(4)) - 1];
        art.load(beat.art[setFor()].file);
      }
    },
    back() { if (mode === 'story' && story.index > 0) go('back'); },
    pointerDown(contact) { swipe = { id: contact.id, x: contact.x, y: contact.y }; return null; },
    pointerUp(contact) {
      if (!swipe || swipe.id !== contact.id) return;
      const dx = contact.x - swipe.x, dy = contact.y - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 'next' : 'back');
    },
    /** Reflects a boot change (ready, failed, progress) on screen. */
    bootChanged() { invalidate(); },
    /**
     * Resolves when the art on screen now is decoded (or failed), or after
     * `ms`: the boot waits this long at most before its heavy, thread-blocking
     * steps, so the first panel is not held back behind them.
     */
    whenFirstArt(ms) {
      const beat = STORY[mode === 'welcome' ? STORY.length - 1 : story.index];
      const file = beat.art[setFor()].file;
      const t0 = performance.now();
      return new Promise(resolve => {
        const check = () => {
          const e = art.get(file);
          if ((e && e.state !== 'loading') || performance.now() - t0 >= ms) resolve(e?.state ?? 'none');
          else setTimeout(check, 16);
        };
        check();
      });
    },
  };
  screenRef = screen;
  return screen;
}

/** Plain transcript of all seven beats, with the image descriptions (scrolls). */
export function createTranscriptScreen({ onClose }) {
  let offset = 0, maxOffset = 0, drag = null;
  return {
    id: 'transcript',
    menuInput: true,
    defaultFocus: () => 'close',
    signature: () => `${Math.round(offset)}`,
    enter() { offset = 0; },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad } = view;
      ctx.fillStyle = 'rgba(2,5,14,0.94)';
      ctx.fillRect(0, 0, w, h);
      const top = Math.max(view.p0Top, pad) + 8 * u;
      const colW = Math.min(w - pad * 2, 760 * u);
      const x = (w - colW) / 2;
      text(ctx, `${t('story.title')} ${t('story.subtitle')} · ${t('story.ui.transcript').toUpperCase()}`, x, top + 12 * u, { size: 14 * u, weight: 700, tracking: 2 * u, maxWidth: colW - 130 * u });
      button(ctx, reg, 'close', x + colW - 120 * u, top - 4 * u, 120 * u, 44, t('story.ui.close'), { state, u, small: true });
      const bodyTop = top + 52 * u, bodyBottom = h - pad;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, bodyTop, w, bodyBottom - bodyTop); ctx.clip();
      let y = bodyTop - offset;
      for (const beat of STORY) {
        text(ctx, `${String(beat.n).padStart(2, '0')}  ${t(beat.caption).toUpperCase()}`, x, y + 10 * u, { size: 14 * u, weight: 700, color: ORANGE, tracking: 1.2 * u, maxWidth: colW });
        y += 26 * u;
        const bubble = t(beat.bubble);
        if (bubble) { y += paragraph(ctx, `“${bubble}”`, x, y, colW, { size: 15 * u, color: COLORS.text, weight: 600 }); y += 4 * u; }
        y += paragraph(ctx, t(beat.narration), x, y, colW, { size: 15 * u, color: COLORS.text });
        y += 4 * u;
        y += paragraph(ctx, `Illustration: ${t(beat.alt)}`, x, y, colW, { size: 12.5 * u, color: COLORS.faint });
        y += 18 * u;
      }
      ctx.restore();
      maxOffset = Math.max(0, y + offset - bodyBottom + 10 * u);
      offset = Math.min(offset, maxOffset);
    },
    onNav(dir) {
      if (dir === 'down') { offset = Math.min(maxOffset, offset + 80); return true; }
      if (dir === 'up') { offset = Math.max(0, offset - 80); return true; }
      return false;
    },
    pointerDown(contact) { drag = { id: contact.id, y: contact.y, offset }; return null; },
    pointerMove(contact) { if (drag && drag.id === contact.id) { offset = Math.max(0, Math.min(maxOffset, drag.offset - (contact.y - drag.y))); this.ui.invalidate(); } },
    pointerUp() { drag = null; },
    wheel(dy) { offset = Math.max(0, Math.min(maxOffset, offset + dy)); this.ui.invalidate(); },
    onAction() { onClose?.(); },
    back() { onClose?.(); },
  };
}
