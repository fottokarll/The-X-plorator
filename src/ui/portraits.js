/**
 * Small original portraits drawn with the canvas API (no image files): the
 * radio voice of Haven Control (Mira, a flight controller in a high-collared
 * navy uniform with a headset) and the player's optional pilot portrait
 * (Settings > Pilot portrait: woman, man, or a neutral visor helmet). Flat,
 * understated shapes in the game's palette, readable at 40-60 px.
 */
export const PILOTS = Object.freeze(['visor', 'woman', 'man']);

function disc(ctx, cx, cy, r) {
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, '#1b3a6e');
  g.addColorStop(1, '#0a1634');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
}

function shoulders(ctx, cx, cy, r, suit, trim) {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.95, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.9, cy + r * 0.42, cx - r * 0.32, cy + r * 0.36);
  ctx.lineTo(cx + r * 0.32, cy + r * 0.36);
  ctx.quadraticCurveTo(cx + r * 0.9, cy + r * 0.42, cx + r * 0.95, cy + r);
  ctx.closePath();
  ctx.fillStyle = suit; ctx.fill();
  // High collar with a coloured trim line.
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy + r * 0.36); ctx.lineTo(cx - r * 0.2, cy + r * 0.58); ctx.lineTo(cx + r * 0.2, cy + r * 0.58); ctx.lineTo(cx + r * 0.3, cy + r * 0.36);
  ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
}

function face(ctx, cx, cy, r, skin) {
  ctx.fillStyle = skin;
  ctx.fillRect(cx - r * 0.12, cy + r * 0.1, r * 0.24, r * 0.3); // neck
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.08, r * 0.3, r * 0.37, 0, 0, Math.PI * 2); ctx.fill();
  // Eyes, brows and a calm mouth.
  ctx.fillStyle = '#1d1a1f';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.11, cy - r * 0.08, r * 0.035, r * 0.045, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#2a2024'; ctx.lineWidth = Math.max(1, r * 0.035); ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * r * 0.05, cy - r * 0.19); ctx.lineTo(cx + s * r * 0.17, cy - r * 0.2); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.06, r * 0.08, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
}

// Heads are drawn 16 % larger around this point, so faces read at 40 px.
function headScale(ctx, cx, cy, r) {
  ctx.translate(cx, cy - r * 0.12);
  ctx.scale(1.16, 1.16);
  ctx.translate(-cx, -(cy - r * 0.12));
}

function control(ctx, cx, cy, r) {
  shoulders(ctx, cx, cy, r, '#1d2f5a', '#70E2F4');
  headScale(ctx, cx, cy, r);
  // Hair gathered in a low bun, behind the head.
  ctx.fillStyle = '#2b1d19';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.26, cy + r * 0.02, r * 0.14, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.16, r * 0.35, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  face(ctx, cx, cy, r, '#b67d57');
  // Hair line over the forehead, parted to one side.
  ctx.fillStyle = '#2b1d19';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.31, cy - r * 0.12); ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.48, cx + r * 0.12, cy - r * 0.45);
  ctx.quadraticCurveTo(cx - r * 0.02, cy - r * 0.3, cx - r * 0.31, cy - r * 0.12); ctx.fill();
  // Headset: band, ear cup and microphone.
  ctx.strokeStyle = '#c9d4e3'; ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.12, r * 0.38, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#c9d4e3';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.33, cy - r * 0.06, r * 0.07, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.33, cy); ctx.quadraticCurveTo(cx - r * 0.28, cy + r * 0.12, cx - r * 0.1, cy + r * 0.1); ctx.stroke();
}

function pilot(ctx, cx, cy, r, kind) {
  shoulders(ctx, cx, cy, r, '#e7ebf0', '#f2861f');
  headScale(ctx, cx, cy, r);
  if (kind === 'visor') {
    // Helmet with a dark visor and a cyan reflection: no face, no gender.
    ctx.fillStyle = '#eef0f3';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.08, r * 0.38, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d1424';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.06, r * 0.29, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(112,226,244,0.8)'; ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath(); ctx.arc(cx - r * 0.06, cy - r * 0.1, r * 0.16, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = '#f2861f'; ctx.fillRect(cx - r * 0.05, cy - r * 0.5, r * 0.1, r * 0.12);
    return;
  }
  ctx.fillStyle = kind === 'woman' ? '#3a2416' : '#1f1a18';
  if (kind === 'woman') {
    // Shoulder-length hair.
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.06, r * 0.38, r * 0.44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - r * 0.38, cy - r * 0.06, r * 0.76, r * 0.36);
  } else {
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.2, r * 0.33, r * 0.27, 0, 0, Math.PI * 2); ctx.fill();
  }
  face(ctx, cx, cy, r, kind === 'woman' ? '#e2b58f' : '#8d5b3d');
  ctx.fillStyle = kind === 'woman' ? '#3a2416' : '#1f1a18';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.16); ctx.quadraticCurveTo(cx, cy - r * 0.52, cx + r * 0.3, cy - r * 0.16);
  ctx.quadraticCurveTo(cx, cy - r * 0.34, cx - r * 0.3, cy - r * 0.16); ctx.fill();
  if (kind === 'man') {
    // A short, neat beard.
    ctx.beginPath(); ctx.moveTo(cx - r * 0.27, cy - r * 0.02); ctx.quadraticCurveTo(cx, cy + r * 0.42, cx + r * 0.27, cy - r * 0.02);
    ctx.quadraticCurveTo(cx, cy + r * 0.18, cx - r * 0.27, cy - r * 0.02); ctx.fill();
  }
}

/** Draws a round portrait: 'control' or a pilot kind ('visor', 'woman', 'man'). */
export function portrait(ctx, kind, cx, cy, r, ring = '#70E2F4') {
  ctx.save();
  disc(ctx, cx, cy, r);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (kind === 'control') control(ctx, cx, cy, r); else pilot(ctx, cx, cy, r, PILOTS.includes(kind) ? kind : 'visor');
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1.2, r * 0.06); ctx.stroke();
}
