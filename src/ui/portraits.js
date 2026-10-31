/**
 * Original character portraits drawn with the canvas API (no image files), in
 * the style of the Exodus prologue: ink outlines, flat colour with one shade,
 * large eyes with highlights, white-and-orange crew uniforms.
 *  - control: Mira, Haven's flight controller. Modelled on the hangar engineer
 *    of prologue panel 4 (hair in a bun, round glasses, white crew jacket with
 *    an orange patch), with a headset.
 *  - the player's optional pilot portrait (Settings > Pilot portrait): a
 *    neutral visor helmet, a woman with long brown hair, a man with short
 *    black hair; all in the white-and-orange flight suit of the fleet.
 * Everything is drawn in a 100 x 100 unit box and scaled.
 */
export const PILOTS = Object.freeze(['visor', 'woman', 'man']);

const INK = '#1b1418';
const SUIT = '#eef1f5', SUIT_SHADE = '#c6cfdb', ORANGE = '#f2861f';
const CAST = {
  control: { skin: '#eab48f', shade: '#d08d69', hair: '#2b1c19', hairHi: '#6b4a3e', iris: ['#2c1a12', '#8a5530'], hairStyle: 'bun', glasses: true, headset: true, mouth: 'smile', bg: 'control' },
  woman: { skin: '#f4c7a4', shade: '#dc9b7a', hair: '#5a3522', hairHi: '#9a6744', iris: ['#3a2114', '#a06638'], hairStyle: 'long', mouth: 'open', bg: 'space' },
  man: { skin: '#dba27b', shade: '#b97a58', hair: '#1d181a', hairHi: '#4f4650', iris: ['#24160f', '#6e4426'], hairStyle: 'messy', mouth: 'smile', brow: 1.7, bg: 'space' },
  visor: { helmet: true, bg: 'space' },
};

function outline(ctx, fill, lw = 1.2) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
}

function background(ctx, kind) {
  const g = ctx.createLinearGradient(0, 0, 0, 100);
  if (kind === 'control') {
    g.addColorStop(0, '#2a62a8'); g.addColorStop(1, '#0b1d42');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, 120, 120);
    // Control-room screens behind her.
    ctx.fillStyle = 'rgba(112,226,244,0.16)';
    for (const [x, y, w, h] of [[2, 10, 22, 14], [76, 8, 24, 18], [4, 30, 16, 10], [80, 30, 18, 8]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(112,226,244,0.35)';
    for (const [x, y, w] of [[5, 14, 12], [5, 18, 8], [79, 13, 14], [79, 17, 9], [82, 33, 10]]) ctx.fillRect(x, y, w, 1.2);
  } else {
    g.addColorStop(0, '#2c4486'); g.addColorStop(1, '#0c1532');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, 120, 120);
    ctx.fillStyle = 'rgba(230,240,255,0.7)';
    for (const [x, y, r] of [[8, 12, 0.8], [20, 30, 0.5], [86, 10, 0.9], [92, 34, 0.5], [12, 52, 0.6], [80, 22, 0.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
}

function suit(ctx, crew) {
  // Shoulders and chest.
  ctx.beginPath();
  ctx.moveTo(8, 101); ctx.bezierCurveTo(10, 86, 18, 80, 38, 75);
  ctx.lineTo(62, 75); ctx.bezierCurveTo(82, 80, 90, 86, 92, 101); ctx.closePath();
  outline(ctx, SUIT);
  // Shade on the far shoulder.
  ctx.beginPath(); ctx.moveTo(66, 77); ctx.bezierCurveTo(82, 81, 89, 88, 91, 101); ctx.lineTo(74, 101); ctx.bezierCurveTo(74, 90, 70, 82, 66, 77); ctx.closePath();
  ctx.fillStyle = SUIT_SHADE; ctx.fill();
  // Orange shoulder bands.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(50 + s * 22, 77.5); ctx.lineTo(50 + s * 31, 80.5); ctx.lineTo(50 + s * 35, 88); ctx.lineTo(50 + s * 26, 85); ctx.closePath();
    outline(ctx, ORANGE, 0.9);
  }
  // High collar.
  ctx.beginPath(); ctx.moveTo(38.5, 72); ctx.lineTo(40.5, 81); ctx.quadraticCurveTo(50, 85, 59.5, 81); ctx.lineTo(61.5, 72); ctx.quadraticCurveTo(50, 76, 38.5, 72); ctx.closePath();
  outline(ctx, '#dfe5ec', 1.1);
  // Chest emblem: an orange round patch (crew) or a small flight badge.
  ctx.beginPath(); ctx.arc(crew ? 66 : 35, 92, crew ? 3.6 : 2.8, 0, Math.PI * 2); outline(ctx, ORANGE, 0.9);
  ctx.beginPath(); ctx.arc(crew ? 66 : 35, 92, crew ? 1.4 : 1.1, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
}

function facePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(29, 40);
  ctx.bezierCurveTo(29, 55, 38, 66.5, 50, 69);
  ctx.bezierCurveTo(62, 66.5, 71, 55, 71, 40);
  ctx.bezierCurveTo(71, 24, 61, 17, 50, 17);
  ctx.bezierCurveTo(39, 17, 29, 24, 29, 40);
  ctx.closePath();
}

function eyes(ctx, c) {
  for (const s of [-1, 1]) {
    const ex = 50 + s * 10.5, ey = 48.5;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ex, ey, 6.2, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.clip();
    const g = ctx.createLinearGradient(0, ey - 5, 0, ey + 5);
    g.addColorStop(0, c.iris[0]); g.addColorStop(1, c.iris[1]);
    ctx.beginPath(); ctx.ellipse(ex - s * 0.4, ey + 0.6, 4.3, 5.3, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex - s * 0.4, ey + 0.9, 2, 2.7, 0, 0, Math.PI * 2); ctx.fillStyle = '#120c0c'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ex - 1.9, ey - 1.6, 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 1.6, ey + 2.6, 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Upper lash line (bold, with a flick at the outer corner) and lower lid.
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(ex - 6.6, ey + 0.2); ctx.quadraticCurveTo(ex, ey - 7.6, ex + 6.6, ey + 0.2); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ex + s * 6.4, ey - 0.4); ctx.lineTo(ex + s * 8.2, ey - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,60,50,0.75)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(ex - 3, ey + 5.6); ctx.quadraticCurveTo(ex, ey + 6.4, ex + 3, ey + 5.6); ctx.stroke();
    // Brow.
    ctx.strokeStyle = c.hair; ctx.lineWidth = c.brow ?? 1.1;
    ctx.beginPath(); ctx.moveTo(ex - s * 5, ey - 9.6); ctx.quadraticCurveTo(ex + s * 0.5, ey - 11.4, ex + s * 5.6, ey - 9.8); ctx.stroke();
  }
}

function mouth(ctx, c) {
  ctx.strokeStyle = c.shade; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(50.8, 55.4); ctx.lineTo(49.6, 57.4); ctx.stroke(); // nose
  if (c.mouth === 'open') {
    ctx.beginPath(); ctx.moveTo(46.2, 61); ctx.quadraticCurveTo(50, 66.6, 53.8, 61); ctx.quadraticCurveTo(50, 62.2, 46.2, 61); ctx.closePath();
    ctx.fillStyle = '#9c3a3c'; ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.95;
    ctx.beginPath(); ctx.moveTo(46.4, 61.2); ctx.quadraticCurveTo(50, 64.2, 53.6, 61.2); ctx.stroke();
  }
}

function hairBack(ctx, c) {
  if (c.hairStyle === 'bun') {
    ctx.beginPath(); ctx.arc(50, 14.5, 8.5, 0, Math.PI * 2); outline(ctx, c.hair);
    ctx.strokeStyle = c.hairHi; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(50, 14.5, 5, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  } else if (c.hairStyle === 'long') {
    ctx.beginPath();
    ctx.moveTo(27, 38); ctx.bezierCurveTo(22, 56, 20, 72, 24, 86);
    ctx.quadraticCurveTo(30, 82, 33, 88); ctx.quadraticCurveTo(38, 80, 42, 76);
    ctx.lineTo(58, 76); ctx.quadraticCurveTo(62, 80, 67, 88); ctx.quadraticCurveTo(70, 82, 76, 86);
    ctx.bezierCurveTo(80, 72, 78, 56, 73, 38); ctx.closePath();
    outline(ctx, c.hair);
  }
}

function hairFront(ctx, c) {
  ctx.beginPath();
  if (c.hairStyle === 'messy') {
    // Soft, rounded tufts (like the boarding father of panel 5).
    ctx.moveTo(27.5, 46); ctx.quadraticCurveTo(23, 34, 28, 24); ctx.quadraticCurveTo(26, 15, 35.5, 14);
    ctx.quadraticCurveTo(37, 6.5, 45.5, 10); ctx.quadraticCurveTo(51, 4, 56.5, 10.5); ctx.quadraticCurveTo(65, 7.5, 66, 15);
    ctx.quadraticCurveTo(75, 16, 72, 25); ctx.quadraticCurveTo(77, 33, 72.5, 46);
    ctx.quadraticCurveTo(71, 38, 67.5, 34); ctx.lineTo(64.5, 39); ctx.quadraticCurveTo(62, 30, 57, 30.5);
    ctx.lineTo(55.5, 37); ctx.quadraticCurveTo(51.5, 30, 46, 30.5); ctx.lineTo(43.5, 37.5);
    ctx.quadraticCurveTo(40, 31, 35, 32.5); ctx.lineTo(32, 40); ctx.quadraticCurveTo(29.5, 37, 27.5, 46);
  } else if (c.hairStyle === 'long') {
    ctx.moveTo(27, 50); ctx.bezierCurveTo(24, 34, 28, 18, 42, 13); ctx.bezierCurveTo(56, 9, 72, 15, 74, 32);
    ctx.bezierCurveTo(75, 40, 74, 46, 73, 52);
    ctx.quadraticCurveTo(70, 42, 68, 35); ctx.lineTo(64.5, 39); ctx.quadraticCurveTo(62, 31, 56, 28);
    ctx.quadraticCurveTo(52, 33, 46, 34); ctx.lineTo(47, 29.5); ctx.quadraticCurveTo(41, 33, 37, 38);
    ctx.lineTo(36, 32); ctx.quadraticCurveTo(30, 40, 27, 50);
  } else {
    // Pulled back to a bun; a side-swept fringe and two loose locks.
    ctx.moveTo(28.5, 46); ctx.bezierCurveTo(26, 30, 32, 16, 47, 14.5); ctx.bezierCurveTo(61, 13, 73, 21, 72.5, 37);
    ctx.lineTo(71.5, 46); ctx.quadraticCurveTo(70, 35, 65.5, 30.5); ctx.lineTo(63, 36);
    ctx.quadraticCurveTo(58, 28, 49.5, 28); ctx.lineTo(50, 33.5); ctx.quadraticCurveTo(44, 29, 38, 31.5);
    ctx.lineTo(35, 39); ctx.quadraticCurveTo(32, 34, 30, 37); ctx.quadraticCurveTo(29, 41, 28.5, 46);
  }
  ctx.closePath();
  outline(ctx, c.hair, 1.2);
  if (c.hairStyle === 'bun') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(50 + s * 21, 36); ctx.quadraticCurveTo(50 + s * 25, 50, 50 + s * 22.5, 63);
      ctx.quadraticCurveTo(50 + s * 21, 52, 50 + s * 19, 40); ctx.closePath();
      outline(ctx, c.hair, 0.9);
    }
  }
  // Strands and shine.
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[44, 17, 39, 27], [53, 16, 56, 26], [62, 19, 67, 29], [36, 22, 33, 30]]) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 1.5, (y0 + y1) / 2, x1, y1); ctx.stroke();
  }
  ctx.strokeStyle = c.hairHi; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(37, 20); ctx.quadraticCurveTo(47, 15.5, 58, 18); ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(62, 20); ctx.quadraticCurveTo(66, 22, 68, 26); ctx.stroke();
}

function head(ctx, c) {
  // Neck with the chin's shadow.
  ctx.beginPath(); ctx.moveTo(43.5, 62); ctx.lineTo(43.5, 77); ctx.lineTo(56.5, 77); ctx.lineTo(56.5, 62); ctx.closePath();
  outline(ctx, c.skin, 1.1);
  ctx.beginPath(); ctx.moveTo(43.5, 64); ctx.quadraticCurveTo(50, 72, 56.5, 64); ctx.lineTo(56.5, 70); ctx.quadraticCurveTo(50, 74, 43.5, 70); ctx.closePath();
  ctx.fillStyle = c.shade; ctx.fill();
  // Ears, then the face over them.
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(50 + s * 21, 48, 3.2, 5, 0, 0, Math.PI * 2); outline(ctx, c.skin, 1.1); }
  facePath(ctx);
  outline(ctx, c.skin, 1.25);
  // Shade under the fringe, and blush.
  ctx.save();
  facePath(ctx); ctx.clip();
  ctx.fillStyle = c.shade; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.ellipse(50, 30, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(236,104,104,0.32)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(50 + s * 12.5, 57, 4.6, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  eyes(ctx, c);
  mouth(ctx, c);
}

function glasses(ctx) {
  ctx.lineWidth = 0.95; ctx.strokeStyle = '#2b2730';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(50 + s * 10.5, 48.5, 7.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170,220,255,0.12)'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(50 + s * 10.5, 48.5, 5.8, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
    ctx.strokeStyle = '#2b2730'; ctx.lineWidth = 0.95;
  }
  ctx.beginPath(); ctx.moveTo(46.6, 47.6); ctx.quadraticCurveTo(50, 46.2, 53.4, 47.6); ctx.stroke();
}

function headset(ctx) {
  // Band over the hair, ear cup with a cyan light, microphone boom.
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(50, 41, 24.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  ctx.strokeStyle = '#d6dce6'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(50, 41, 24.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(27, 47.5, 4.6, 6.6, 0, 0, Math.PI * 2); outline(ctx, '#39404f', 1.1);
  ctx.beginPath(); ctx.arc(27, 47.5, 1.3, 0, Math.PI * 2); ctx.fillStyle = '#70E2F4'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(27.5, 53); ctx.quadraticCurveTo(29, 62, 39, 63.5); ctx.stroke();
  ctx.strokeStyle = '#39404f'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(27.5, 53); ctx.quadraticCurveTo(29, 62, 39, 63.5); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(40.2, 63.6, 2, 1.6, 0, 0, Math.PI * 2); outline(ctx, '#39404f', 0.9);
}

function helmet(ctx) {
  ctx.beginPath(); ctx.arc(50, 43, 27, 0, Math.PI * 2); outline(ctx, SUIT, 1.3);
  ctx.save();
  ctx.beginPath(); ctx.arc(50, 43, 27, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = SUIT_SHADE; ctx.beginPath(); ctx.ellipse(66, 52, 14, 26, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ORANGE; ctx.fillRect(46, 14, 8, 14);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.strokeRect(46, 16, 8, 11);
  // Visor with a cool reflection.
  ctx.beginPath(); ctx.moveTo(29, 44); ctx.bezierCurveTo(29, 31, 71, 31, 71, 44); ctx.bezierCurveTo(71, 60, 29, 60, 29, 44); ctx.closePath();
  const g = ctx.createLinearGradient(0, 33, 0, 58);
  g.addColorStop(0, '#2c4f8c'); g.addColorStop(0.55, '#0d1730'); g.addColorStop(1, '#16284e');
  outline(ctx, g, 1.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(35, 41); ctx.quadraticCurveTo(39, 36.5, 46, 36); ctx.stroke();
  ctx.strokeStyle = 'rgba(112,226,244,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(56, 53); ctx.quadraticCurveTo(63, 52, 66, 47); ctx.stroke();
}

/** Draws a character in the 100 x 100 unit box (background included). */
function bust(ctx, kind) {
  const c = CAST[kind] ?? CAST.visor;
  background(ctx, c.bg);
  if (c.helmet) { suit(ctx, false); helmet(ctx); return; }
  hairBack(ctx, c);
  suit(ctx, kind === 'control');
  head(ctx, c);
  hairFront(ctx, c);
  if (c.glasses) glasses(ctx);
  if (c.headset) headset(ctx);
}

const known = kind => (kind === 'control' || PILOTS.includes(kind) ? kind : 'visor');

/** A round portrait (HUD radio card): 'control' or a pilot kind. */
export function portrait(ctx, kind, cx, cy, r, ring = '#70E2F4') {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  // Head and shoulders fill the disc: units 8..92 across, hair to chest.
  const k = (2 * r) / 84;
  ctx.translate(cx - 50 * k, cy - 47 * k);
  ctx.scale(k, k);
  bust(ctx, known(kind));
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1.2, r * 0.06); ctx.stroke();
}

/** A comic panel portrait (briefing): paper border, ink frame, the bust inside. */
export function portraitCard(ctx, kind, x, y, w, h, { border = 4, accent = '#70E2F4' } = {}) {
  ctx.save();
  ctx.fillStyle = '#f2efe7';
  ctx.fillRect(x, y, w, h);
  const ix = x + border, iy = y + border, iw = w - border * 2, ih = h - border * 2;
  ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  // The whole bust (the bun included), the shoulders on the bottom edge.
  const k = Math.min(iw / 92, ih / 96);
  ctx.translate(ix + iw / 2 - 50 * k, iy + ih - 100 * k);
  ctx.scale(k, k);
  bust(ctx, known(kind));
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, border * 0.5);
  ctx.strokeRect(x + border, y + border, w - border * 2, h - border * 2);
  ctx.fillStyle = accent; ctx.fillRect(x + border, y + h - border - Math.max(2, border * 0.6), w - border * 2, Math.max(2, border * 0.6));
  ctx.restore();
}
