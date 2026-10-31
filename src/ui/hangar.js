import * as THREE from 'three';
import { COLORS, text, panel, button, icon, segBar, divider, measure, roundRect, paragraph, title, roundButton } from './kit.js';
import { SPRITE } from './overlay.js';
import { MODULES, SOCKET_INFO, VESSELS, computeStats, displayStats, moduleId } from '../game/ships.js';
import { SOCKETS, orientForShowcase } from '../render/ship-model.js';

/**
 * SHIP HANGAR (IMG 03 layout, IMG 07 colours): the real ship geometry seen
 * from above at the centre, seven socket callouts with leader lines to the
 * projected socket positions, live stats with upgrade previews, selected
 * module detail with equip / craft (game resources only), tabbed inventory.
 */
const ICON = { engine: 'engine', hull: 'hull', reactor: 'reactor', scanner: 'scanner', cargo: 'cargo', shield: 'shield', miner: 'miner' };
const LOCKED_SLOTS = ['Auxiliary', 'Special', 'Drone bay', 'Special', 'Auxiliary'];
const TECH = [
  ['Warp Drive', 'Travel between sectors'], ['Drone Bay', 'Automated mining drones'], ['Colony Pods', 'Settle a starter world'],
  ['Deep Scan Net', 'Reveal hidden signals'], ['Terraform Kit', 'Shape a new home'],
];

export function createHangarScreen(game) {
  let socket = 'engine';
  let preview = null; // level being compared
  let tab = 'loadout';
  let L = null; // last layout
  let shipYaw = 0, dragging = null, message = '';
  let socketScreen = {};
  let lastSig = '';
  const tmp = new THREE.Vector3();

  const profile = () => game.profile;
  const levelStatus = (s, lvl) => {
    const p = profile();
    const def = MODULES[s][lvl - 1];
    if (p.equipped[s] === lvl) return { id: 'equipped', label: 'Equipped' };
    if (lvl === 1 || p.inventory.includes(moduleId(s, lvl))) return { id: 'owned', label: 'Owned' };
    if (def.cost && game.canAfford(def.cost)) return { id: 'craft', label: 'Craft' };
    return { id: 'locked', label: 'Locked' };
  };
  const costText = cost => Object.entries(cost ?? {}).map(([k, v]) => `${v} ${k === 'cryon' ? 'Cryon' : 'Ferrite'}`).join(' + ');

  function layout(view) {
    const { w, h, u, pad, portrait, phone } = view;
    const top = Math.max(view.p0Top, pad);
    if (portrait) {
      const header = { x: pad, y: top, w: w - pad * 2, h: 56 * u };
      const ship = { x: pad, y: header.y + header.h, w: w - pad * 2, h: Math.min(h * 0.3, 270 * u) };
      const chips = { x: pad, y: ship.y + ship.h + 6 * u, w: w - pad * 2, h: 58 * u };
      const footer = { x: pad, y: h - pad - 50 * u, w: w - pad * 2, h: 50 * u };
      const inv = { x: pad, y: footer.y - 106 * u, w: w - pad * 2, h: 98 * u };
      const detail = { x: pad, y: chips.y + chips.h + 8 * u, w: w - pad * 2, h: inv.y - (chips.y + chips.h + 16 * u) };
      return { mode: 'portrait', header, ship, chips, detail, inv, footer };
    }
    if (phone) {
      const header = { x: pad, y: Math.max(pad, view.p0Top), w: w - pad * 2, h: 40 * u };
      const ship = { x: pad, y: header.y + header.h, w: w * 0.46, h: h - header.y - header.h - 64 * u - pad };
      const chips = { x: pad, y: ship.y + ship.h, w: w * 0.46, h: 60 * u };
      const detail = { x: w * 0.46 + pad * 2, y: header.y + header.h + 4 * u, w: w * 0.54 - pad * 3, h: h - header.y - header.h - pad - 58 * u };
      const footer = { x: detail.x, y: h - pad - 46 * u, w: detail.w, h: 46 * u };
      return { mode: 'landscapePhone', header, ship, chips, detail, footer };
    }
    const header = { x: pad * 1.5, y: top, w: w - pad * 3, h: 54 * u };
    const bottomH = Math.max(150 * u, h * 0.25);
    const inv = { x: pad * 1.5, y: h - pad - bottomH, w: w - pad * 3, h: bottomH };
    const midY = header.y + header.h + 6 * u, midH = inv.y - midY - 12 * u;
    const stats = { x: pad * 1.5, y: midY, w: Math.max(250 * u, w * 0.19), h: midH };
    const detail = { w: Math.max(300 * u, w * 0.25), y: midY, h: midH };
    detail.x = w - pad * 1.5 - detail.w;
    const ship = { x: stats.x + stats.w + 12 * u, y: midY, w: detail.x - stats.x - stats.w - 24 * u, h: midH };
    return { mode: 'desktop', header, stats, ship, detail, inv };
  }

  function compareStats() {
    const p = profile();
    const now = computeStats(p.vessel, p.equipped);
    if (!preview || preview === p.equipped[socket]) return { now, next: null };
    return { now, next: computeStats(p.vessel, { ...p.equipped, [socket]: preview }) };
  }

  // ------------------------------------------------------------- drawing
  function drawHeader(ctx, view) {
    const { u } = view;
    const r = L.header;
    if (L.mode === 'desktop') {
      text(ctx, 'SHIP HANGAR', r.x, r.y + 18 * u, { size: 20 * u, weight: 300, tracking: 7 * u });
      text(ctx, 'UPGRADES  &  LOADOUT', r.x + 2 * u, r.y + 42 * u, { size: 10 * u, color: COLORS.cyanSoft, tracking: 4 * u });
    } else {
      text(ctx, 'SHIP HANGAR', r.x, r.y + 16 * u, { size: 16 * u, weight: 300, tracking: 5 * u });
    }
    const p = profile();
    const items = [['crystal', `${p.bank.cryon}`, COLORS.cyan, 'Cryon'], ['ore', `${p.bank.ferrite}`, COLORS.gold, 'Ferrite']];
    let x = r.x + r.w;
    for (let i = items.length - 1; i >= 0; i--) {
      const [ic, val, col, label] = items[i];
      const wv = measure(ctx, val, 15 * u, 500) + (L.mode === 'desktop' ? measure(ctx, label, 10 * u, 400, 1.5 * u) + 10 * u : 0);
      x -= wv + 30 * u;
      icon(ctx, ic, x + 8 * u, r.y + 18 * u, 17 * u, col);
      text(ctx, val, x + 22 * u, r.y + 18 * u, { size: 15 * u, weight: 500 });
      if (L.mode === 'desktop') text(ctx, label.toUpperCase(), x + 28 * u + measure(ctx, val, 15 * u, 500), r.y + 18 * u, { size: 10 * u, color: COLORS.faint, tracking: 1.5 * u });
    }
    if (L.mode === 'desktop') text(ctx, 'STATION BANK', r.x + r.w, r.y + 40 * u, { size: 9 * u, color: COLORS.faint, align: 'right', tracking: 2 * u });
  }

  function drawStats(ctx, view, rect) {
    const { u } = view;
    const p = profile();
    const vessel = VESSELS.find(v => v.id === p.vessel);
    panel(ctx, rect.x, rect.y, rect.w, rect.h, { r: 14 * u });
    text(ctx, 'SHIP STATS', rect.x + 18 * u, rect.y + 24 * u, { size: 12 * u, weight: 500, tracking: 3 * u });
    text(ctx, `${vessel.name.toUpperCase()} · EXPLORER CLASS`, rect.x + 18 * u, rect.y + 44 * u, { size: 9.5 * u, color: COLORS.cyanSoft, tracking: 1.6 * u });
    divider(ctx, rect.x + 14 * u, rect.y + 58 * u, rect.w - 28 * u, { diamond: false });
    const { now, next } = compareStats();
    const rows = displayStats(now);
    const nextRows = next ? displayStats(next) : null;
    const colors = { speed: '#70E2F4', handling: '#9FB8FF', scan: '#5AA8FF', cargo: '#F8BD78', power: '#FF8FA3', shield: '#B79CFF' };
    const avail = rect.h - 78 * u;
    const rowH = Math.min(52 * u, avail / rows.length);
    rows.forEach((row, i) => {
      const y = rect.y + 74 * u + i * rowH;
      text(ctx, row.label.toUpperCase(), rect.x + 18 * u, y, { size: 10 * u, color: COLORS.dim, tracking: 1.6 * u });
      text(ctx, row.value, rect.x + rect.w - 18 * u, y, { size: 13 * u, weight: 500, align: 'right' });
      const nr = nextRows?.[i];
      const barW = rect.w - 36 * u;
      segBar(ctx, rect.x + 18 * u, y + 11 * u, barW, 5 * u, Math.min(1, Math.max(0, nr ? nr.bar : row.bar)), nr && nr.bar !== row.bar ? (nr.bar > row.bar ? COLORS.ok : COLORS.danger) : colors[row.id]);
      if (nr && nr.value !== row.value) {
        const better = nr.bar > row.bar;
        text(ctx, `${better ? '▲' : '▼'} ${nr.value}`, rect.x + rect.w - 18 * u, y + 25 * u, { size: 9.5 * u, color: better ? COLORS.ok : COLORS.danger, align: 'right' });
      }
    });
  }

  function drawCallouts(ctx, view, reg, state) {
    const { u } = view;
    const s = L.ship;
    const cw = Math.min(124 * u, s.w * 0.2), ch = 74 * u;
    const pos = {
      engine: [s.x + 6 * u, s.y + s.h * 0.08],
      hull: [s.x + 6 * u, s.y + s.h * 0.4],
      cargo: [s.x + 6 * u, s.y + s.h * 0.72],
      reactor: [s.x + s.w / 2 - cw / 2, s.y + 2 * u],
      shield: [s.x + s.w - cw - 6 * u, s.y + s.h * 0.08],
      miner: [s.x + s.w - cw - 6 * u, s.y + s.h * 0.4],
      scanner: [s.x + s.w - cw - 6 * u, s.y + s.h * 0.72],
    };
    for (const k of SOCKETS) {
      const [x, y] = pos[k];
      const sp = socketScreen[k];
      const sel = socket === k;
      if (sp) {
        // Leader line: from the card edge to the socket, with a small elbow.
        const fromX = x + (x < s.x + s.w / 2 ? cw : 0), fromY = y + ch / 2;
        const ax = k === 'reactor' ? x + cw / 2 : fromX, ay = k === 'reactor' ? y + ch : fromY;
        ctx.strokeStyle = sel ? COLORS.gold : 'rgba(112,226,244,0.55)';
        ctx.lineWidth = sel ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        if (k !== 'reactor') ctx.lineTo(ax + (sp.x - ax) * 0.4, ay);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(ax, ay, 2.5 * u, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
      const lvl = profile().equipped[k];
      const focus = state.focus === `slot-${k}` || state.hover === `slot-${k}`;
      panel(ctx, x, y, cw, ch, { r: 10 * u, fill: sel ? 'rgba(30,48,90,0.85)' : 'rgba(8,20,52,0.72)', stroke: sel ? COLORS.gold : focus ? COLORS.cyan : COLORS.line, glow: sel ? 14 * u : 0 });
      text(ctx, SOCKET_INFO[k].label.toUpperCase(), x + cw / 2, y + 14 * u, { size: 9.5 * u, weight: 500, align: 'center', tracking: 1.6 * u });
      icon(ctx, ICON[k], x + cw / 2, y + 36 * u, 22 * u, sel ? COLORS.gold : COLORS.cyan);
      text(ctx, `Lv. ${lvl}`, x + cw / 2, y + 56 * u, { size: 10 * u, align: 'center', color: COLORS.dim });
      for (let d = 0; d < 3; d++) {
        ctx.beginPath(); ctx.arc(x + cw / 2 - 8 * u + d * 8 * u, y + 66 * u, 2.2 * u, 0, 7);
        ctx.fillStyle = d < lvl ? (sel ? COLORS.gold : COLORS.cyan) : 'rgba(150,180,220,0.25)'; ctx.fill();
      }
      reg.add(`slot-${k}`, x, y, cw, ch, { data: k });
    }
  }

  function drawChips(ctx, view, reg, state) {
    const { u } = view;
    const r = L.chips;
    const gap = 5 * u, cw = (r.w - gap * 6) / 7;
    SOCKETS.forEach((k, i) => {
      const x = r.x + i * (cw + gap);
      const sel = socket === k, focus = state.focus === `slot-${k}`;
      panel(ctx, x, r.y, cw, r.h, { r: 9 * u, fill: sel ? 'rgba(30,48,90,0.85)' : 'rgba(8,20,52,0.72)', stroke: sel ? COLORS.gold : focus ? COLORS.cyan : COLORS.line, highlight: false });
      icon(ctx, ICON[k], x + cw / 2, r.y + r.h * 0.38, Math.min(20 * u, cw * 0.5), sel ? COLORS.gold : COLORS.cyan);
      text(ctx, `Lv${profile().equipped[k]}`, x + cw / 2, r.y + r.h * 0.78, { size: 9.5 * u, align: 'center', color: COLORS.dim });
      reg.add(`slot-${k}`, x, r.y, cw, r.h, { data: k });
    });
  }

  function drawDetail(ctx, view, reg, state, rect) {
    const { u } = view;
    const p = profile();
    panel(ctx, rect.x, rect.y, rect.w, rect.h, { r: 14 * u });
    const compact = rect.h < 300 * u;
    const lvl = p.equipped[socket];
    const def = MODULES[socket][lvl - 1];
    text(ctx, SOCKET_INFO[socket].label.toUpperCase(), rect.x + 18 * u, rect.y + 22 * u, { size: 13 * u, weight: 500, tracking: 3 * u, color: COLORS.gold });
    text(ctx, `${def.name} · Lv ${lvl}`, rect.x + 18 * u, rect.y + 42 * u, { size: 11.5 * u, color: COLORS.dim });
    let y = rect.y + (compact ? 54 : 62) * u;
    divider(ctx, rect.x + 14 * u, y, rect.w - 28 * u, { diamond: false });
    y += 8 * u;
    const rowH = (compact ? 34 : 42) * u;
    MODULES[socket].forEach((m, i) => {
      const level = i + 1;
      const st = levelStatus(socket, level);
      const id = `lvl-${level}`;
      const sel = (preview ?? lvl) === level, focus = state.focus === id || state.hover === id;
      roundRect(ctx, rect.x + 12 * u, y, rect.w - 24 * u, rowH - 6 * u, 9 * u);
      ctx.fillStyle = sel ? 'rgba(40,70,130,0.55)' : focus ? 'rgba(24,52,104,0.5)' : 'rgba(10,24,60,0.4)';
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.cyan : COLORS.line; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, `Lv ${level}`, rect.x + 24 * u, y + (rowH - 6 * u) / 2, { size: 10.5 * u, color: COLORS.faint });
      text(ctx, m.name, rect.x + 62 * u, y + (rowH - 6 * u) / 2, { size: 12 * u, color: st.id === 'locked' ? COLORS.faint : COLORS.text, maxWidth: rect.w * 0.45 });
      const pillCol = { equipped: COLORS.gold, owned: COLORS.cyan, craft: COLORS.ok, locked: COLORS.faint }[st.id];
      const label = st.id === 'locked' && m.cost ? costText(m.cost) : st.label;
      text(ctx, label.toUpperCase(), rect.x + rect.w - 24 * u, y + (rowH - 6 * u) / 2, { size: 9 * u, weight: 600, color: pillCol, align: 'right', tracking: 1.2 * u });
      if (st.id === 'locked') icon(ctx, 'lock', rect.x + rect.w - 30 * u - measure(ctx, label.toUpperCase(), 9 * u, 600, 1.2 * u), y + (rowH - 6 * u) / 2, 12 * u, COLORS.faint);
      reg.add(id, rect.x + 12 * u, y, rect.w - 24 * u, rowH - 6 * u, { data: level });
      y += rowH;
    });
    // Compare + action.
    const target = preview ?? (lvl < 3 ? lvl + 1 : lvl);
    const tdef = MODULES[socket][target - 1];
    const st = levelStatus(socket, target);
    y += 4 * u;
    if (!compact && target !== lvl) {
      text(ctx, `PREVIEW · ${tdef.name.toUpperCase()}`, rect.x + 18 * u, y + 8 * u, { size: 9.5 * u, color: COLORS.cyanSoft, tracking: 1.6 * u });
      const stat = Object.entries(tdef.stats)[0];
      const cur = Object.entries(def.stats)[0];
      if (stat && cur) {
        const delta = stat[1] - cur[1];
        const better = stat[0] === 'mineTime' || stat[0] === 'scanTime' ? delta < 0 : delta > 0;
        text(ctx, `${SOCKET_INFO[socket].stat}: ${better ? 'improves' : 'changes'} (${delta > 0 ? '+' : ''}${Math.round(delta * 100) / 100})`, rect.x + 18 * u, y + 26 * u, { size: 11.5 * u, color: better ? COLORS.ok : COLORS.danger });
      }
      y += 40 * u;
    }
    let action = null, actionLabel = 'Equipped', enabled = false;
    if (target === lvl) { actionLabel = lvl === 3 ? 'Maximum level' : 'Equipped'; }
    else if (st.id === 'owned') { action = 'equip'; actionLabel = `Equip ${tdef.name}`; enabled = true; }
    else if (st.id === 'craft') { action = 'craft'; actionLabel = `Craft · ${costText(tdef.cost)}`; enabled = true; }
    else if (st.id === 'locked') { actionLabel = `Need ${costText(tdef.cost)}`; }
    const bh = (compact ? 40 : 46) * u;
    if (L.mode === 'desktop') {
      button(ctx, reg, action ?? 'noop', rect.x + 14 * u, rect.y + rect.h - bh - 34 * u, rect.w - 28 * u, bh, actionLabel, { state, u, primary: enabled, enabled, small: true });
      text(ctx, message || 'Crafting uses resources delivered to Haven Outpost.', rect.x + rect.w / 2, rect.y + rect.h - 16 * u, { size: 9.5 * u, color: message ? COLORS.cyan : COLORS.faint, align: 'center', maxWidth: rect.w - 20 * u });
    } else {
      screen.footerAction = { action, actionLabel, enabled };
      if (message) text(ctx, message, rect.x + rect.w / 2, rect.y + rect.h - 12 * u, { size: 10 * u, color: COLORS.cyan, align: 'center', maxWidth: rect.w - 20 * u });
    }
  }

  function drawInventory(ctx, view, reg, state, rect) {
    const { u } = view;
    panel(ctx, rect.x, rect.y, rect.w, rect.h, { r: 14 * u });
    const tabs = [['loadout', 'Loadout'], ['inventory', 'Inventory'], ['tech', 'Tech'], ['ships', 'Ships']];
    const tabW = Math.min(130 * u, (rect.w - 28 * u) / 4), tabH = 28 * u;
    tabs.forEach(([id, label], i) => {
      const x = rect.x + 14 * u + i * (tabW + 6 * u), y = rect.y + 10 * u;
      const sel = tab === id, focus = state.focus === `tab-${id}` || state.hover === `tab-${id}`;
      roundRect(ctx, x, y, tabW, tabH, tabH / 2);
      ctx.fillStyle = sel ? 'rgba(112,226,244,0.9)' : focus ? 'rgba(24,52,104,0.82)' : 'rgba(9,22,56,0.6)';
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.cyan : COLORS.line; ctx.stroke();
      text(ctx, label.toUpperCase(), x + tabW / 2, y + tabH / 2, { size: 10 * u, weight: 600, align: 'center', color: sel ? '#061433' : COLORS.text, tracking: 1.6 * u });
      reg.add(`tab-${id}`, x, y, tabW, tabH, { data: id });
    });
    const p = profile();
    let tiles = [];
    if (tab === 'loadout') {
      tiles = SOCKETS.map(k => ({ id: `tile-${k}`, icon: ICON[k], label: MODULES[k][p.equipped[k] - 1].name, sub: `Lv ${p.equipped[k]}`, data: k, sel: socket === k }));
      tiles.push(...LOCKED_SLOTS.map((name, i) => ({ id: `locked-${i}`, icon: 'lock', label: name, sub: 'Locked', locked: true })));
    } else if (tab === 'inventory') {
      tiles = [
        { id: 'res-cryon', icon: 'crystal', label: 'Cryon', sub: `${p.bank.cryon} banked · ${p.cargo.cryon} aboard`, color: COLORS.cyan },
        { id: 'res-ferrite', icon: 'ore', label: 'Ferrite', sub: `${p.bank.ferrite} banked · ${p.cargo.ferrite} aboard`, color: COLORS.gold },
      ];
      for (const id of p.inventory) {
        const [k, lvl] = id.split('-');
        const equipped = p.equipped[k] === Number(lvl);
        tiles.push({ id: `inv-${id}`, icon: ICON[k], label: MODULES[k][Number(lvl) - 1].name, sub: equipped ? 'Equipped' : `Lv ${lvl} · spare`, data: k });
      }
    } else if (tab === 'tech') {
      tiles = TECH.map(([name, sub], i) => ({ id: `tech-${i}`, icon: 'lock', label: name, sub, locked: true }));
    } else {
      tiles = VESSELS.map(v => ({ id: `ship-${v.id}`, icon: v.available ? 'hangar' : 'lock', label: v.name, sub: v.id === p.vessel ? 'Active' : 'Demo · locked', locked: !v.available, sel: v.id === p.vessel }));
    }
    const ty = rect.y + tabH + 20 * u, th = rect.h - tabH - 30 * u;
    const tw = Math.min(150 * u, Math.max(96 * u, (rect.w - 28 * u) / Math.max(6, Math.min(12, tiles.length)) - 6 * u));
    const perRow = Math.max(1, Math.floor((rect.w - 22 * u) / (tw + 6 * u)));
    tiles.slice(0, perRow * Math.max(1, Math.floor(th / (70 * u)))).forEach((t, i) => {
      const rows = Math.max(1, Math.floor(th / (70 * u)));
      const row = Math.floor(i / perRow), col = i % perRow;
      const tileH = Math.min(th / rows - 6 * u, 90 * u);
      const x = rect.x + 14 * u + col * (tw + 6 * u), y = ty + row * (tileH + 6 * u);
      const focus = state.focus === t.id || state.hover === t.id;
      ctx.save();
      if (t.locked) ctx.setLineDash([4 * u, 4 * u]);
      roundRect(ctx, x, y, tw, tileH, 10 * u);
      ctx.fillStyle = t.sel ? 'rgba(30,48,90,0.85)' : 'rgba(8,20,52,0.55)';
      ctx.fill();
      ctx.strokeStyle = t.sel ? COLORS.gold : focus ? COLORS.cyan : t.locked ? 'rgba(140,170,210,0.3)' : COLORS.line;
      ctx.stroke();
      ctx.restore();
      icon(ctx, t.icon, x + tw / 2, y + tileH * 0.36, Math.min(22 * u, tileH * 0.36), t.locked ? COLORS.faint : t.color ?? (t.sel ? COLORS.gold : COLORS.cyan));
      text(ctx, t.label, x + tw / 2, y + tileH * 0.68, { size: 10 * u, align: 'center', color: t.locked ? COLORS.faint : COLORS.text, maxWidth: tw - 8 * u });
      text(ctx, t.sub, x + tw / 2, y + tileH * 0.86, { size: 8.5 * u, align: 'center', color: COLORS.faint, maxWidth: tw - 8 * u });
      reg.add(t.id, x, y, tw, tileH, { data: t.data, enabled: !t.locked, focusable: true });
    });
  }

  const screen = {
    id: 'hangar',
    menuInput: true,
    footerAction: null,
    refreshRate: 0,
    defaultFocus: () => `slot-${socket}`,
    signature() {
      const p = profile();
      return `${socket}|${preview}|${tab}|${message}|${JSON.stringify(p.equipped)}|${p.inventory.join(',')}|${p.bank.cryon}|${p.bank.ferrite}|${Math.round(shipYaw * 50)}|${lastSig}`;
    },
    enter() {
      preview = null; message = ''; shipYaw = 0;
      game.world.field.group.visible = false;
      game.world.station.group.visible = false;
      game.world.trails.object.visible = false;
      game.world.glows.object.visible = false;
    },
    exit() {
      game.world.trails.object.visible = true;
      game.world.glows.object.visible = true;
      game.world.setShowroomLight(0);
      game.pipeline.setBloom(0.85);
      game.pipeline.setExposure(1);
      game.hideShowroom();
    },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad } = view;
      L = layout(view);
      // Gentle darkening at the edges keeps panels readable over the planet.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(3,9,30,0.55)'); g.addColorStop(0.3, 'rgba(3,9,30,0.05)'); g.addColorStop(0.7, 'rgba(3,9,30,0.15)'); g.addColorStop(1, 'rgba(3,9,30,0.7)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      drawHeader(ctx, view);
      if (L.mode === 'desktop') {
        drawStats(ctx, view, L.stats);
        drawCallouts(ctx, view, reg, state);
        drawDetail(ctx, view, reg, state, L.detail);
        drawInventory(ctx, view, reg, state, L.inv);
        button(ctx, reg, 'back', L.inv.x + L.inv.w - 150 * u, L.inv.y + 10 * u, 136 * u, 28 * u, 'Back', { state, icon: 'back', u, small: true });
        roundButton(ctx, reg, 'resetview', L.ship.x + L.ship.w / 2, L.ship.y + L.ship.h - 20 * u, 15 * u, 'reset', '', { state, u, labelBelow: false });
      } else {
        drawChips(ctx, view, reg, state);
        drawDetail(ctx, view, reg, state, L.detail);
        if (L.inv) drawInventory(ctx, view, reg, state, L.inv);
        roundButton(ctx, reg, 'resetview', L.ship.x + L.ship.w - 22 * u, L.ship.y + 22 * u, 17 * u, 'reset', '', { state, u, labelBelow: false });
        const f = L.footer;
        const fa = screen.footerAction ?? { action: null, actionLabel: 'Equipped', enabled: false };
        const bw = (f.w - 10 * u) / 2;
        button(ctx, reg, 'back', f.x, f.y, bw * 0.7, f.h, 'Back', { state, icon: 'back', u, small: true });
        button(ctx, reg, fa.action ?? 'noop', f.x + bw * 0.7 + 10 * u, f.y, f.w - bw * 0.7 - 10 * u, f.h, fa.actionLabel, { state, u, primary: fa.enabled, enabled: fa.enabled, small: true });
      }
      void pad;
    },
    sprites(overlay, view) {
      const sp = socketScreen[socket];
      if (!sp) return;
      const pulse = 1 + 0.15 * Math.sin(game.time * 3);
      overlay.sprite(sp.x, sp.y, 30 * view.u * pulse, SPRITE.RING, [0.97, 0.74, 0.47, 0.9]);
      overlay.sprite(sp.x, sp.y, 9 * view.u, SPRITE.DISC, [0.97, 0.74, 0.47, 0.95]);
      for (const k of SOCKETS) {
        if (k === socket || !socketScreen[k]) continue;
        overlay.sprite(socketScreen[k].x, socketScreen[k].y, 7 * view.u, SPRITE.DISC, [0.44, 0.89, 0.96, 0.8]);
      }
    },
    update3d(dt) {
      const view = game.ui.view;
      if (!L) L = layout(view);
      const cam = game.camera;
      cam.fov = view.portrait ? 52 : 40;
      cam.aspect = view.w / view.h;
      cam.updateProjectionMatrix();
      // A fixed vantage near the station, looking past the ship toward the planet.
      const camWorld = new THREE.Vector3(260, 120, -900);
      game.setCameraWorld(camWorld);
      const toPlanet = game.world.planetCenter.clone().sub(camWorld).normalize();
      // Aim above the planet: darker sky behind the ship, the luminous limb low in frame.
      const look = toPlanet.clone().add(new THREE.Vector3(0.25, 0.95, 0)).normalize();
      cam.position.copy(game.anchor);
      cam.lookAt(game.anchor.clone().add(look));
      cam.updateMatrixWorld();
      // Ship at the centre of the ship area, sized to fit it.
      const p = profile();
      const entry = game.showroomShip('hangar', p.vessel, p.equipped);
      const grp = entry.ship.group;
      grp.visible = true;
      if (game.hangarPad.parent !== grp) grp.add(game.hangarPad);
      game.hangarPad.visible = true;
      const s = L.ship;
      const cx = s.x + s.w / 2, cy = s.y + s.h * (L.mode === 'desktop' ? 0.56 : 0.5);
      const ndc = new THREE.Vector3((cx / view.w) * 2 - 1, -(cy / view.h) * 2 + 1, 0.5);
      const dir = ndc.unproject(cam).sub(cam.position).normalize();
      const D = 12;
      grp.position.copy(cam.position).addScaledVector(dir, D);
      const worldPerPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / view.h;
      const fit = Math.min(s.w * (L.mode === 'desktop' ? 0.5 : 0.72), s.h * (L.mode === 'desktop' ? 0.66 : 0.9));
      grp.scale.setScalar((fit * worldPerPx) / (entry.ship.radius * 2));
      if (!dragging) shipYaw += (0 - shipYaw) * Math.min(1, dt * 3);
      orientForShowcase(grp, cam.quaternion, 0.32, shipYaw);
      game.world.setShowroomLight(1.9, cam, grp.position);
      game.pipeline.setBloom(0.3);
      game.pipeline.setExposure(0.9);
      grp.updateMatrixWorld(true);
      // Project sockets for the callouts and sprites.
      const next = {};
      for (const k of SOCKETS) {
        tmp.copy(entry.ship.sockets[k]).applyMatrix4(grp.matrixWorld).project(cam);
        next[k] = { x: (tmp.x * 0.5 + 0.5) * view.w, y: (-tmp.y * 0.5 + 0.5) * view.h };
      }
      socketScreen = next;
      lastSig = SOCKETS.map(k => `${Math.round(next[k].x)},${Math.round(next[k].y)}`).join(';');
    },
    pointerDown(contact) {
      if (!L) return null;
      const s = L.ship;
      if (contact.x > s.x && contact.x < s.x + s.w && contact.y > s.y && contact.y < s.y + s.h) dragging = contact.id;
      return null;
    },
    pointerMove(contact, event) {
      if (dragging === contact.id) shipYaw = Math.max(-2.6, Math.min(2.6, shipYaw + (event.dx || 0) * 0.012));
    },
    pointerUp(contact) { if (dragging === contact.id) dragging = null; },
    onAction(id, data) {
      message = '';
      if (id.startsWith('slot-') || id.startsWith('tile-') || id.startsWith('inv-')) {
        if (data && MODULES[data]) { socket = data; preview = null; }
        if (id.startsWith('inv-')) {
          const lvl = Number(id.split('-').pop());
          if (lvl) preview = lvl;
        }
        return;
      }
      if (id.startsWith('lvl-')) { preview = data; return; }
      if (id.startsWith('tab-')) { tab = data; return; }
      if (id === 'resetview') { shipYaw = 0; return; }
      if (id === 'equip') {
        const lvl = preview ?? profile().equipped[socket] + 1;
        if (game.equip(socket, lvl)) { message = `${MODULES[socket][lvl - 1].name} equipped`; preview = null; }
        return;
      }
      if (id === 'craft') {
        const lvl = preview ?? profile().equipped[socket] + 1;
        if (game.craft(socket, lvl)) { message = `${MODULES[socket][lvl - 1].name} crafted: ready to equip`; preview = lvl; }
        else message = 'Not enough resources in the station bank';
        return;
      }
      if (id === 'back') game.closeSubscreen();
    },
    back() { game.closeSubscreen(); },
  };
  return screen;
}

export { title, paragraph };
