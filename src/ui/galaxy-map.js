import { COLORS, text, panel, button, icon, divider, paragraph, roundRect } from './kit.js';
import { generatePlanet } from '../planet-generator.js';

/**
 * GALAXY MAP: a procedural chart of sectors (planets from the deterministic
 * planet generator), routes and resources. Free roaming stays primary: the
 * map informs and selects; only the Outer Verge is open in M1. Claim prices
 * are inert design placeholders (no ATT, no purchases).
 */
const SECTORS = [
  { name: 'Outer Verge', seed: 0x7a11, open: true, current: true },
  { name: 'Cyan Reach', seed: 1203 },
  { name: 'Lilac Drift', seed: 88731 },
  { name: 'Pearl Shoals', seed: 4410 },
  { name: 'Haven Gate', seed: 2026 },
  { name: 'Silent Halo', seed: 51515 },
  { name: 'Tidewell', seed: 777 },
  { name: 'Ember Wake', seed: 9001 },
  { name: 'Genesis Rise', seed: 323323, goal: true },
];

function layoutNodes() {
  // A gentle spiral outward from the Outer Verge.
  return SECTORS.map((s, i) => {
    const a = i * 1.15 + 0.4, r = 70 + i * 62;
    const planet = generatePlanet(s.seed >>> 0, { starter: Boolean(s.current) });
    return { ...s, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62, planet, index: i };
  });
}

export function createMapScreen(game) {
  const nodes = layoutNodes();
  let selected = 0;
  let pan = { x: 0, y: 0 }, zoom = 1;
  let dragging = null;
  let L = null;

  function toScreen(n, cx, cy, u) { return [cx + (n.x + pan.x) * zoom * u, cy + (n.y + pan.y) * zoom * u]; }

  function drawPlanet(ctx, x, y, r, n) {
    const pal = n.planet.visual.palette;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[2]);
    ctx.save();
    ctx.globalAlpha = n.open ? 1 : 0.62;
    ctx.shadowColor = n.open ? 'rgba(112,226,244,0.8)' : 'rgba(150,140,255,0.35)';
    ctx.shadowBlur = r * 0.9;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(160,230,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    if (n.planet.visual.rings) {
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.stroke();
    }
    ctx.restore();
  }

  const screen = {
    id: 'map',
    menuInput: true,
    defaultFocus: () => 'back',
    signature: () => `${selected}|${Math.round(pan.x)}|${Math.round(pan.y)}|${zoom.toFixed(2)}`,
    enter() { selected = 0; pan = { x: 0, y: 0 }; zoom = 1; },
    wheel(dy) { zoom = Math.max(0.6, Math.min(2.2, zoom * (dy > 0 ? 0.9 : 1.1))); game.ui.invalidate(); },
    onNav(dir) {
      const cur = nodes[selected];
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null, bestScore = Infinity;
      for (const n of nodes) {
        if (n === cur) continue;
        const dx = n.x - cur.x, dy = n.y - cur.y;
        const along = dx * v[0] + dy * v[1];
        if (along <= 0) continue;
        const score = along + Math.abs(dx * v[1] - dy * v[0]) * 1.5;
        if (score < bestScore) { bestScore = score; best = n; }
      }
      if (best) selected = best.index;
      return true;
    },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait } = view;
      ctx.fillStyle = 'rgba(3,9,30,0.84)';
      ctx.fillRect(0, 0, w, h);
      const top = Math.max(view.p0Top, pad);
      text(ctx, 'GALAXY MAP', pad * 1.5, top + 16 * u, { size: (portrait ? 16 : 20) * u, weight: 300, tracking: 7 * u });
      text(ctx, 'SECTORS  ·  ROUTES  ·  RESOURCES', pad * 1.5 + 2 * u, top + 40 * u, { size: 9.5 * u, color: COLORS.cyanSoft, tracking: 3 * u });
      const info = portrait ? { x: pad, y: h - pad - 250 * u, w: w - pad * 2, h: 250 * u } : { x: w - pad * 1.5 - 330 * u, y: top + 64 * u, w: 330 * u, h: h - top - 64 * u - pad };
      const mapRect = portrait ? { x: 0, y: top + 56 * u, w, h: info.y - top - 64 * u } : { x: 0, y: top + 50 * u, w: info.x - 10 * u, h: h - top - 60 * u };
      L = { mapRect };
      const cx = mapRect.x + mapRect.w * 0.45, cy = mapRect.y + mapRect.h * 0.5;
      // Faint orbital guide rings.
      ctx.save();
      ctx.beginPath(); ctx.rect(mapRect.x, mapRect.y, mapRect.w, mapRect.h); ctx.clip();
      for (let i = 1; i <= 6; i++) {
        ctx.beginPath(); ctx.ellipse(cx + pan.x * zoom * u, cy + pan.y * zoom * u, i * 70 * zoom * u, i * 44 * zoom * u, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(112,170,244,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // Routes.
      for (let i = 0; i < nodes.length - 1; i++) {
        const [x1, y1] = toScreen(nodes[i], cx, cy, u), [x2, y2] = toScreen(nodes[i + 1], cx, cy, u);
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
        const charted = i === 0;
        ctx.setLineDash(charted ? [] : [5 * u, 6 * u]);
        ctx.strokeStyle = selected > i ? 'rgba(248,189,120,0.7)' : charted ? 'rgba(112,226,244,0.6)' : 'rgba(150,170,230,0.3)';
        ctx.lineWidth = selected > i ? 1.8 : 1.2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      }
      ctx.setLineDash([]);
      // Nodes.
      for (const n of nodes) {
        const [x, y] = toScreen(n, cx, cy, u);
        const r = (n.planet.size === 'large' ? 17 : n.planet.size === 'medium' ? 13 : 10) * u * Math.sqrt(zoom);
        drawPlanet(ctx, x, y, r, n);
        const sel = selected === n.index;
        if (sel) { ctx.beginPath(); ctx.arc(x, y, r + 9 * u, 0, Math.PI * 2); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.6; ctx.stroke(); }
        if (n.current) text(ctx, 'YOU ARE HERE', x, y - r - 14 * u, { size: 8.5 * u, color: COLORS.cyan, align: 'center', tracking: 1.6 * u });
        text(ctx, n.name.toUpperCase(), x, y + r + 16 * u, { size: 10 * u, align: 'center', color: n.open ? COLORS.text : COLORS.dim, tracking: 1.6 * u });
        if (!n.open) icon(ctx, 'lock', x + r * 0.9, y - r * 0.9, 12 * u, COLORS.faint);
        reg.add(`node-${n.index}`, x - r - 10 * u, y - r - 10 * u, (r + 10 * u) * 2, (r + 10 * u) * 2 + 18 * u, { data: n.index, focusable: false });
      }
      ctx.restore();
      // Info panel.
      const n = nodes[selected];
      panel(ctx, info.x, info.y, info.w, info.h, { r: 16 * u, fill: COLORS.glassStrong });
      text(ctx, n.name.toUpperCase(), info.x + 20 * u, info.y + 28 * u, { size: 15 * u, weight: 400, tracking: 3 * u, color: n.goal ? COLORS.gold : COLORS.text });
      const p = n.planet;
      text(ctx, `${p.classLabel} world · ${p.size}${p.visual.rings ? ' · ringed' : ''}`, info.x + 20 * u, info.y + 50 * u, { size: 11.5 * u, color: COLORS.dim });
      divider(ctx, info.x + 16 * u, info.y + 66 * u, info.w - 32 * u, { diamond: false });
      const rows = [
        ['Habitability', `${p.habitability}%`],
        ['Atmosphere', p.visual.atmosphere],
        ...p.resources.map(r => [r.kind[0].toUpperCase() + r.kind.slice(1), `${r.remaining} units`]),
        ['Status', n.current ? 'Explored · you are here' : n.goal ? 'Endgame: the Genesis Initiative' : 'Route not charted yet'],
      ];
      const rh = portrait ? 18 * u : 22 * u;
      rows.slice(0, portrait ? 6 : 9).forEach(([a, b], i) => {
        text(ctx, a, info.x + 20 * u, info.y + 86 * u + i * rh, { size: 11 * u, color: COLORS.dim });
        text(ctx, b, info.x + info.w - 20 * u, info.y + 86 * u + i * rh, { size: 11 * u, align: 'right', maxWidth: info.w * 0.55 });
      });
      if (!portrait) {
        paragraph(ctx, 'Planet claims are a future design idea. Nothing can be bought here; values shown are mock data.', info.x + 20 * u, info.y + info.h - 120 * u, info.w - 40 * u, { size: 10.5 * u, color: COLORS.faint });
      }
      const bh = 42 * u;
      const bw = (info.w - 50 * u) / 2;
      button(ctx, reg, 'back', info.x + 20 * u, info.y + info.h - bh - 18 * u, bw, bh, 'Back', { state, icon: 'back', u, small: true });
      button(ctx, reg, 'course', info.x + 30 * u + bw, info.y + info.h - bh - 18 * u, bw, bh, n.current ? 'Fly here' : 'Locked', { state, u, small: true, primary: n.current, enabled: Boolean(n.current) });
      void roundRect;
    },
    pointerDown(contact) {
      if (L && contact.y > L.mapRect.y && contact.x < L.mapRect.x + L.mapRect.w) dragging = { id: contact.id, moved: 0 };
      return null;
    },
    pointerMove(contact, event) {
      if (!dragging || dragging.id !== contact.id) return;
      const u = game.ui.view.u;
      pan.x += (event.dx || 0) / (zoom * u);
      pan.y += (event.dy || 0) / (zoom * u);
      pan.x = Math.max(-500, Math.min(500, pan.x)); pan.y = Math.max(-400, Math.min(400, pan.y));
      dragging.moved += Math.abs(event.dx || 0) + Math.abs(event.dy || 0);
    },
    pointerUp(contact) { if (dragging?.id === contact.id) dragging = null; },
    onAction(id, data) {
      if (id.startsWith('node-')) { selected = data; return; }
      if (id === 'course' || id === 'back') game.ui.screen('map').close();
    },
    close() {
      const back = game.returnMode ?? 'flight';
      if (back === 'attract') game.toMenu();
      else game.closeSubscreen();
    },
    back() { this.close(); },
  };
  return screen;
}
