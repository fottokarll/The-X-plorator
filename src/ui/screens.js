import * as THREE from 'three';
import { COLORS, text, paragraph, panel, button, title, divider, icon, measure, vignette, roundRect } from './kit.js';
import { VESSELS } from '../game/ships.js';
import { GOAL_CRYON } from '../game/mission.js';
import { ACTIONS, prettyKey, rebind, sanitizeBindings, DEFAULT_BINDINGS } from '../input/keyboard.js';
import { orientForShowcase } from '../render/ship-model.js';

/** Main menu, vessel selection, pause, settings, help and dialogs. */
export function registerScreens(ui, game) {
  ui.register('menu', mainMenu(game));
  ui.register('select', vesselSelect(game));
  ui.register('pause', pauseMenu(game));
  ui.register('settings', settingsScreen(game));
  ui.register('help', helpScreen(game));
  ui.register('docked', dockedPanel(game));
  ui.register('complete', completePanel(game));
  ui.register('confirm', confirmDialog(game));
}

function footer(ctx, view) {
  const { w, h, u, pad } = view;
  text(ctx, 'EXPLORE  ·  DISCOVER  ·  BELONG', w / 2, h - pad - 4 * u, { size: 10 * u, color: COLORS.faint, align: 'center', tracking: 3 * u });
}

// ---------------------------------------------------------------- main menu
function mainMenu(game) {
  return {
    id: 'menu',
    menuInput: true,
    defaultFocus: () => (game.hasSave ? 'continue' : 'new'),
    signature: () => `${game.hasSave}`,
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      vignette(ctx, w, h, 0.5);
      // Left-side legibility gradient on wide screens (planet stays clear on the right).
      if (!portrait) {
        const g = ctx.createLinearGradient(0, 0, w * 0.55, 0);
        g.addColorStop(0, 'rgba(4,10,32,0.62)');
        g.addColorStop(1, 'rgba(4,10,32,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w * 0.55, h);
      }
      const p = game.profile;
      const items = [
        ['continue', 'Continue', 'play', game.hasSave],
        ['new', 'New Journey', 'star', true],
        ['map', 'Galaxy Map', 'map', true],
        ['settings', 'Settings', 'settings', true],
      ];
      let x, y, bw, bh, gap, titleSize;
      if (portrait) {
        titleSize = Math.min(30 * u, w / 13);
        bw = Math.min(w - pad * 3, 420 * u); bh = 50 * u; gap = 12 * u;
        x = (w - bw) / 2;
        title(ctx, w / 2, h * 0.16, titleSize, { align: 'center', u });
        text(ctx, 'CALM COSMIC EXPLORATION', w / 2, h * 0.16 + titleSize * 1.15, { size: 10.5 * u, color: COLORS.cyanSoft, align: 'center', tracking: 4.5 * u });
        y = h - pad * 2.4 - items.length * (bh + gap) - 26 * u;
      } else {
        titleSize = phone ? 26 * u : 44 * u;
        bw = phone ? 300 * u : 360 * u; bh = phone ? 42 * u : 54 * u; gap = phone ? 9 * u : 14 * u;
        x = pad * (phone ? 2.4 : 4.5);
        const ty = phone ? pad * 2.6 : h * 0.24;
        title(ctx, x, ty, titleSize, { u });
        text(ctx, 'CALM COSMIC EXPLORATION', x + 2 * u, ty + titleSize * 0.95, { size: (phone ? 9.5 : 12) * u, color: COLORS.cyanSoft, tracking: 5 * u });
        divider(ctx, x, ty + titleSize * 0.95 + 20 * u, bw * 0.7, { diamond: false });
        y = phone ? ty + titleSize * 0.95 + 36 * u : Math.max(h * 0.42, ty + titleSize + 70 * u);
      }
      items.forEach(([id, label, ic, enabled], i) => {
        const by = y + i * (bh + gap);
        button(ctx, reg, id, x, by, bw, bh, label, { state, primary: id === 'continue' ? enabled : (!game.hasSave && id === 'new'), icon: ic, enabled, u, align: 'left' });
      });
      if (game.hasSave) {
        const m = p.mission;
        const detail = m.step === 'free' || m.step === 'complete' ? 'Outer Verge · First Light complete' : `Outer Verge · ${Math.min(p.cargo.cryon + (m.delivered || 0), GOAL_CRYON)}/${GOAL_CRYON} Cryon`;
        text(ctx, detail, x + (portrait ? bw / 2 : 4 * u), y - 14 * u, { size: 11 * u, color: COLORS.dim, align: portrait ? 'center' : 'left', tracking: 1 * u, shadow: true });
      }
      footer(ctx, view);
      if (!phone) text(ctx, 'M1 PROTOTYPE  ·  OUTER VERGE  ·  PROJECT 0 LOT #323', w - pad, h - pad - 4 * u, { size: 9.5 * u, color: COLORS.faint, align: 'right', tracking: 1.6 * u });
    },
    onAction(id) {
      if (id === 'continue') game.continueJourney();
      else if (id === 'new') {
        if (game.hasSave) {
          game.ui.push('confirm', {
            title: 'Start a new journey?',
            body: 'Your current progress in the Outer Verge will be replaced.',
            confirm: 'Start new', danger: true,
            onConfirm: () => game.openSelect(),
          });
        } else game.openSelect();
      } else if (id === 'map') game.openMap('attract');
      else if (id === 'settings') game.ui.push('settings');
    },
    back() {},
  };
}

// ------------------------------------------------------------ vessel select
function vesselSelect(game) {
  let selected = 'survivor';
  let cards = [];
  const s = {
    id: 'select',
    menuInput: true,
    defaultFocus: () => 'card-survivor',
    signature: () => selected,
    enter() { selected = 'survivor'; },
    exit() { game.hideShowroom(); },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      vignette(ctx, w, h, 0.55);
      ctx.fillStyle = 'rgba(4,10,32,0.35)';
      ctx.fillRect(0, 0, w, h);
      const top = portrait ? pad * 2.2 : pad * (phone ? 1.4 : 2.4);
      const ts = portrait ? Math.min(24 * u, w / 15) : (phone ? 20 : 30) * u;
      title(ctx, w / 2, top + ts / 2, ts, { align: 'center', u });
      text(ctx, 'BEGIN THE EXODUS', w / 2, top + ts * 1.5, { size: (phone ? 11 : 14) * u, color: COLORS.cyan, align: 'center', tracking: 6 * u });
      let cursor = top + ts * 1.5 + 16 * u;
      if (!phone || portrait) {
        text(ctx, 'A NEW HOME AWAITS', w / 2, cursor + 4 * u, { size: 10 * u, color: COLORS.faint, align: 'center', tracking: 4 * u });
        cursor += 24 * u;
        const story = 'Earth is fading. A small group of survivors launches into the unknown, searching for a new home among the stars. Choose your vessel. Choose your beginning.';
        cursor += paragraph(ctx, story, w / 2, cursor, Math.min(w - pad * 3, 620 * u), { size: (portrait ? 12.5 : 14) * u, align: 'center', color: COLORS.dim }) + 14 * u;
      }
      // Cards.
      const cols = portrait ? 2 : 4;
      const gap = (phone ? 10 : 18) * u;
      const btnH = (phone ? 44 : 52) * u;
      const availH = h - cursor - btnH - pad * 2.6 - (portrait ? btnH + 10 * u : 0);
      const rows = Math.ceil(VESSELS.length / cols);
      const cw = Math.min((w - pad * 2 - gap * (cols - 1)) / cols, 250 * u);
      const ch = Math.min((availH - gap * (rows - 1)) / rows, cw * 1.45);
      const gridW = cw * cols + gap * (cols - 1);
      const x0 = (w - gridW) / 2;
      cards = [];
      VESSELS.forEach((v, i) => {
        const cx = x0 + (i % cols) * (cw + gap), cy = cursor + Math.floor(i / cols) * (ch + gap);
        const id = `card-${v.id}`;
        const isSel = selected === v.id, focused = state.focus === id || state.hover === id;
        panel(ctx, cx, cy, cw, ch, {
          r: 12 * u, fill: isSel ? 'rgba(14,40,86,0.32)' : 'rgba(8,20,52,0.22)',
          stroke: isSel ? (v.available ? COLORS.cyan : COLORS.lilac) : focused ? 'rgba(112,226,244,0.6)' : COLORS.line, glow: isSel ? 16 * u : 0,
        });
        const small = ch < 200 * u;
        text(ctx, v.name.toUpperCase(), cx + cw / 2, cy + 20 * u, { size: (small ? 11 : 13) * u, weight: 500, align: 'center', tracking: 2.5 * u });
        const price = v.att === 0 ? 'FREE' : `${v.att} ATT`;
        text(ctx, price, cx + cw / 2, cy + 38 * u, { size: (small ? 10 : 12) * u, weight: 600, align: 'center', color: v.att === 0 ? COLORS.cyan : COLORS.gold, tracking: 2 * u });
        if (!v.available) {
          icon(ctx, 'lock', cx + cw - 16 * u, cy + 16 * u, 14 * u, COLORS.faint);
          text(ctx, 'DEMO PRICE · LOCKED', cx + cw / 2, cy + 53 * u, { size: 8.5 * u, color: COLORS.faint, align: 'center', tracking: 1.5 * u });
        }
        // The ship itself is a real 3D model placed over this area by update3d().
        const shipArea = { x: cx + cw / 2, y: cy + ch * (small ? 0.5 : 0.47), w: cw * 0.86 };
        cards.push({ id: v.id, area: shipArea, selected: isSel });
        icon(ctx, v.id === 'colony' ? 'cargo' : 'crew', cx + cw / 2, cy + ch - (small ? 44 : 58) * u, (small ? 16 : 20) * u, COLORS.text);
        text(ctx, v.perk.toUpperCase(), cx + cw / 2, cy + ch - (small ? 26 : 36) * u, { size: (small ? 8.5 : 10) * u, align: 'center', tracking: 1.4 * u, maxWidth: cw - 12 * u });
        if (!small) text(ctx, v.blurb, cx + cw / 2, cy + ch - 18 * u, { size: 10.5 * u, align: 'center', color: COLORS.dim, maxWidth: cw - 16 * u });
        reg.add(id, cx, cy, cw, ch, { data: v.id });
      });
      // Buttons.
      const sel = VESSELS.find(v => v.id === selected);
      const by = h - pad * 1.6 - btnH;
      const startLabel = sel.available ? 'Start Journey' : 'Survivor only in M1';
      if (portrait) {
        const bw = Math.min(w - pad * 3, 380 * u);
        button(ctx, reg, 'start', (w - bw) / 2, by - btnH - 10 * u, bw, btnH, startLabel, { state, primary: true, enabled: sel.available, icon: 'next', u });
        button(ctx, reg, 'back', (w - bw) / 2, by, bw, btnH, 'Back', { state, icon: 'back', u });
      } else {
        const bw = (phone ? 220 : 300) * u;
        button(ctx, reg, 'back', w / 2 - bw - 10 * u, by, bw, btnH, 'Back', { state, icon: 'back', u });
        button(ctx, reg, 'start', w / 2 + 10 * u, by, bw, btnH, startLabel, { state, primary: true, enabled: sel.available, icon: 'next', u });
      }
      if (!sel.available) {
        text(ctx, 'ATT prices are design placeholders. No purchases exist in this prototype.', w / 2, by - (portrait ? btnH + 24 * u : 14 * u), { size: 10.5 * u, color: COLORS.gold, align: 'center' });
      }
    },
    update3d(dt) {
      const v = game.ui.view;
      const cam = game.camera;
      const D = 30;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      for (const c of cards) {
        const vessel = VESSELS.find(x => x.id === c.id);
        const entry = game.showroomShip(`select-${c.id}`, vessel.id, undefined);
        const g = entry.ship.group;
        g.visible = true;
        const ndc = new THREE.Vector3((c.area.x / v.w) * 2 - 1, -(c.area.y / v.h) * 2 + 1, 0.5);
        const dir = ndc.unproject(cam).sub(cam.position).normalize();
        g.position.copy(cam.position).addScaledVector(dir, D);
        const worldPerPx = (2 * D * tanHalf) / v.h;
        const targetSize = c.area.w * 0.86 * worldPerPx;
        const scale = targetSize / (entry.ship.radius * 2);
        g.scale.setScalar(scale);
        g.userData.spin = (g.userData.spin ?? Math.random() * 6) + dt * (c.selected ? 0.9 : 0.25);
        // Seen from above and slightly behind, nose toward the top of the card.
        orientForShowcase(g, cam.quaternion, 0.42, Math.sin(g.userData.spin) * 0.5);
        g.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), Math.sin(game.time * 1.6 + c.id.length) * targetSize * 0.04);
      }
    },
    onAction(id, data) {
      if (id.startsWith('card-')) { selected = data; return; }
      if (id === 'start') {
        const v = VESSELS.find(x => x.id === selected);
        if (v.available) game.startNewJourney(v.id);
      }
      if (id === 'back') game.toMenu();
    },
    back() { game.toMenu(); },
  };
  return s;
}

// ---------------------------------------------------------------- pause
function pauseMenu(game) {
  return {
    id: 'pause',
    menuInput: true,
    defaultFocus: () => 'resume',
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      const items = [
        ['resume', 'Resume', 'play'], ['hangar', 'Ship Hangar', 'hangar'], ['base', 'Orbital Base', 'base'],
        ['map', 'Galaxy Map', 'map'], ['settings', 'Settings', 'settings'], ['help', 'Controls', 'help'],
        ['restart', 'Return to Station', 'reset'], ['menu', 'Main Menu', 'back'],
      ];
      const bh = (phone ? 40 : 46) * u, gap = (phone ? 7 : 10) * u;
      const twoCols = phone && !portrait;
      const cols = twoCols ? 2 : 1;
      const bw = Math.min(portrait ? w - pad * 3 : 320 * u, 340 * u);
      const rows = Math.ceil(items.length / cols);
      const pw = bw * cols + gap * (cols - 1) + 48 * u, ph = rows * (bh + gap) + 90 * u;
      const px = (w - pw) / 2, py = Math.max(pad, (h - ph) / 2);
      panel(ctx, px, py, pw, ph, { r: 18 * u, fill: COLORS.glassStrong, glow: 20 * u });
      text(ctx, 'PAUSED', w / 2, py + 34 * u, { size: 18 * u, weight: 300, align: 'center', tracking: 8 * u });
      divider(ctx, px + 40 * u, py + 56 * u, pw - 80 * u);
      items.forEach(([id, label, ic], i) => {
        const col = i % cols, row = Math.floor(i / cols);
        button(ctx, reg, id, px + 24 * u + col * (bw + gap), py + 72 * u + row * (bh + gap), bw, bh, label, { state, icon: ic, u, align: 'left', primary: id === 'resume' });
      });
    },
    onAction(id) {
      if (id === 'resume') game.resume();
      else if (id === 'hangar') game.openHangar();
      else if (id === 'base') game.openBase();
      else if (id === 'map') game.openMap();
      else if (id === 'settings') game.ui.push('settings');
      else if (id === 'help') game.ui.push('help');
      else if (id === 'restart') { game.ui.pop(); game.restartSector(); }
      else if (id === 'menu') game.toMenu();
    },
    back() { game.resume(); },
  };
}

// ---------------------------------------------------------------- settings
function settingsScreen(game) {
  let capture = null; // action id waiting for a key
  let captureKeys = null;
  let message = '';
  let page = 'main';
  const options = () => {
    const s = game.profile.settings;
    return [
      { id: 'quality', label: 'Graphics quality', value: s.quality, values: ['auto', 'high', 'medium', 'low'], show: v => (v === 'auto' ? `Auto (${game.quality})` : v[0].toUpperCase() + v.slice(1)) },
      { id: 'handling', label: 'Handling', value: s.handling, values: ['tranquil', 'responsive'], show: v => v[0].toUpperCase() + v.slice(1) },
      { id: 'autoCruise', label: 'Auto-cruise', value: s.autoCruise, values: [true, false], show: v => (v ? 'On' : 'Off') },
      { id: 'invertY', label: 'Invert climb / dive', value: s.invertY, values: [false, true], show: v => (v ? 'On' : 'Off') },
      { id: 'sensitivity', label: 'Steering sensitivity', value: s.sensitivity, values: [0.6, 0.8, 1, 1.2, 1.4], show: v => `${Math.round(v * 100)}%` },
      { id: 'cameraZoom', label: 'Camera distance', value: s.cameraZoom, values: [1.2, 1, 0.85], show: v => (v > 1.1 ? 'Wide' : v < 0.95 ? 'Close' : 'Standard') },
      { id: 'reducedMotion', label: 'Reduced motion', value: s.reducedMotion, values: [false, true], show: v => (v ? 'On' : 'Off') },
    ];
  };
  function cycle(opt, dir = 1) {
    const i = opt.values.findIndex(v => v === opt.value);
    const next = opt.values[(i + dir + opt.values.length) % opt.values.length];
    game.setSetting(opt.id, next);
  }
  return {
    id: 'settings',
    menuInput: true,
    hideBelow: false,
    signature: () => `${capture}|${message}|${page}|${JSON.stringify(game.profile.settings)}|${game.quality}`,
    enter() { capture = null; message = ''; page = 'main'; },
    tick() {
      if (!capture) return;
      const keys = game.p0.input?.keys ?? new Set();
      for (const code of keys) {
        if (captureKeys.has(code)) continue;
        const r = rebind(game.profile.settings.bindings, capture, code);
        if (r.ok) { game.setSetting('bindings', r.bindings); message = `${ACTIONS.find(a => a.id === capture).label}: ${prettyKey(code)}`; }
        else message = r.reason;
        capture = null;
        game.input.releaseAll();
        return;
      }
      for (const code of [...captureKeys]) if (!keys.has(code)) captureKeys.delete(code);
    },
    onNav(dir) {
      if (dir !== 'left' && dir !== 'right') return false;
      const opt = options().find(o => o.id === game.ui.state.focus);
      if (!opt) return false;
      cycle(opt, dir === 'left' ? -1 : 1);
      return true;
    },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      ctx.fillStyle = 'rgba(3,9,30,0.6)';
      ctx.fillRect(0, 0, w, h);
      const pw = Math.min(w - pad * 2, phone ? w - pad * 2 : 980 * u), ph = Math.min(h - pad * 2, 640 * u);
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 18 * u, fill: COLORS.glassStrong, glow: 18 * u });
      text(ctx, page === 'keys' ? 'KEYBOARD' : 'SETTINGS', px + 28 * u, py + 32 * u, { size: 17 * u, weight: 300, tracking: 6 * u });
      const rowH = (phone ? 36 : 40) * u;
      const showKeysInline = !phone && !portrait && pw > 860 * u;
      if (page === 'main') {
        const colW = showKeysInline ? pw / 2 - 42 * u : pw - 56 * u;
        options().forEach((o, i) => {
          const y = py + 62 * u + i * (rowH + 6 * u);
          text(ctx, o.label, px + 28 * u, y + rowH / 2, { size: 13 * u, color: COLORS.dim });
          const bw = Math.min(190 * u, colW * 0.48);
          button(ctx, reg, o.id, px + 28 * u + colW - bw, y, bw, rowH, o.show(o.value), { state, u, small: true });
        });
        const after = py + 62 * u + options().length * (rowH + 6 * u) + 6 * u;
        if (!showKeysInline) button(ctx, reg, 'keys', px + 28 * u, after, Math.min(260 * u, colW), rowH, 'Keyboard bindings', { state, icon: 'settings', u, small: true, align: 'left' });
        if (game.software?.software) text(ctx, 'Software renderer detected: the light version is active.', px + 28 * u, after + rowH + 18 * u, { size: 11 * u, color: COLORS.gold });
        if (showKeysInline) drawKeys(ctx, reg, state, view, px + pw / 2 + 14 * u, py + 62 * u, pw / 2 - 42 * u, rowH * 0.78);
      } else drawKeys(ctx, reg, state, view, px + 28 * u, py + 62 * u, pw - 56 * u, rowH * 0.85);
      if (message) text(ctx, message, px + pw / 2, py + ph - 82 * u, { size: 12 * u, color: COLORS.cyan, align: 'center' });
      const bh = (phone ? 40 : 46) * u;
      button(ctx, reg, 'back', px + 28 * u, py + ph - bh - 22 * u, 200 * u, bh, page === 'keys' ? 'Done' : 'Back', { state, icon: 'back', u });
      if (game.hasSave && page === 'main') button(ctx, reg, 'reset', px + pw - 228 * u, py + ph - bh - 22 * u, 200 * u, bh, 'Reset progress', { state, u, danger: true, small: true });
    },
    onAction(id) {
      const opt = options().find(o => o.id === id);
      if (opt) { cycle(opt, 1); return; }
      if (id === 'keys') { page = 'keys'; return; }
      if (id.startsWith('bind-')) {
        capture = id.slice(5);
        captureKeys = new Set(game.p0.input?.keys ?? []);
        message = 'Press a key…';
        return;
      }
      if (id === 'resetkeys') { game.setSetting('bindings', sanitizeBindings(DEFAULT_BINDINGS)); message = 'Keys restored'; return; }
      if (id === 'reset') {
        game.ui.push('confirm', { title: 'Reset all progress?', body: 'Cargo, upgrades, base modules and mission progress will be erased.', confirm: 'Erase', danger: true, onConfirm: () => { game.resetProgress(); game.toMenu(); } });
        return;
      }
      if (id === 'back') this.back();
    },
    back() {
      if (capture) { capture = null; message = ''; return; }
      if (page === 'keys') { page = 'main'; return; }
      game.ui.pop();
    },
  };

  function drawKeys(ctx, reg, state, view, x, y, width, rowH) {
    const { u } = view;
    const b = game.profile.settings.bindings;
    ACTIONS.forEach((a, i) => {
      const yy = y + i * (rowH + 4 * u);
      text(ctx, a.label, x, yy + rowH / 2, { size: 12 * u, color: COLORS.dim });
      const label = capture === a.id ? '…' : (b[a.id] ?? []).map(prettyKey).join(' / ');
      button(ctx, reg, `bind-${a.id}`, x + width - 170 * u, yy, 170 * u, rowH, label, { state, u, small: true });
    });
    button(ctx, reg, 'resetkeys', x, y + ACTIONS.length * (rowH + 4 * u) + 6 * u, 170 * u, rowH, 'Restore keys', { state, u, small: true });
  }
}

// ---------------------------------------------------------------- help
function helpScreen(game) {
  const sections = [
    ['Keyboard & mouse', [
      ['Steer', 'W A S D / arrows'], ['Boost', 'Shift / Space'], ['Brake', 'C'], ['Scan', 'Q'], ['Collect / dock', 'E'],
      ['Map · Hangar · Base', 'M · H · B'], ['Pause', 'P'], ['Look (optional)', 'Right-drag'], ['Zoom', 'Mouse wheel'],
    ]],
    ['Controller', [
      ['Steer', 'Left stick'], ['Boost · Brake', 'RT · LT'], ['Look (optional)', 'Right stick'], ['Collect / dock', 'A'],
      ['Scan', 'X'], ['Galaxy map', 'Y'], ['Pause', 'Start'], ['Hangar · Base', 'D-pad ◀ ▶'], ['Zoom', 'D-pad ▲ ▼'],
    ]],
    ['Touch', [
      ['Steer', 'Left thumb anywhere'], ['Boost · Brake', 'Hold right buttons'], ['Scan · Action', 'Tap'], ['Look', 'Drag on the right'],
      ['Map · Pause', 'Top-right buttons'],
    ]],
  ];
  return {
    id: 'help',
    menuInput: true,
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, phone, portrait } = view;
      ctx.fillStyle = 'rgba(3,9,30,0.6)';
      ctx.fillRect(0, 0, w, h);
      const cols = portrait ? 1 : 3;
      const pw = Math.min(w - pad * 2, 1040 * u), ph = Math.min(h - pad * 2, portrait ? h - pad * 2 : 470 * u);
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 18 * u, fill: COLORS.glassStrong });
      text(ctx, 'CONTROLS', px + 28 * u, py + 30 * u, { size: 17 * u, weight: 300, tracking: 6 * u });
      text(ctx, 'Auto-cruise flies you forward. Only steering is needed.', px + 28 * u, py + 54 * u, { size: 12 * u, color: COLORS.cyan });
      const colW = (pw - 56 * u - (cols - 1) * 24 * u) / cols;
      const rowH = (phone ? 17 : 22) * u;
      let yCursor = py + 82 * u;
      sections.forEach(([name, rows], i) => {
        const cx = px + 28 * u + (cols === 1 ? 0 : i * (colW + 24 * u));
        const cy = cols === 1 ? yCursor : py + 82 * u;
        text(ctx, name.toUpperCase(), cx, cy, { size: 11 * u, weight: 600, color: COLORS.text, tracking: 2 * u });
        rows.forEach(([a, k], j) => {
          text(ctx, a, cx, cy + 22 * u + j * rowH, { size: 11.5 * u, color: COLORS.dim });
          text(ctx, k, cx + colW, cy + 22 * u + j * rowH, { size: 11.5 * u, color: COLORS.text, align: 'right' });
        });
        yCursor = cy + 30 * u + rows.length * rowH;
      });
      const bh = 44 * u;
      button(ctx, reg, 'back', px + pw / 2 - 100 * u, py + ph - bh - 18 * u, 200 * u, bh, 'Back', { state, icon: 'back', u });
    },
    onAction() { game.ui.pop(); },
    back() { game.ui.pop(); },
  };
}

// ---------------------------------------------------------------- docked
function dockedPanel(game) {
  return {
    id: 'docked',
    menuInput: true,
    dimBelow: false,
    defaultFocus: () => 'launch',
    signature: () => `${game.profile.bank.cryon}|${game.profile.bank.ferrite}`,
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      const p = game.profile;
      const items = [['launch', 'Launch', 'boost'], ['hangar', 'Hangar', 'hangar'], ['base', 'Orbital Base', 'base'], ['map', 'Galaxy Map', 'map']];
      const bh = (phone ? 40 : 46) * u, gap = 10 * u;
      const pw = portrait ? w - pad * 2 : Math.min(w - pad * 2, (phone ? 560 : 760) * u);
      const cols = portrait ? 2 : 4;
      const bw = (pw - 40 * u - gap * (cols - 1)) / cols;
      const ph = 70 * u + Math.ceil(items.length / cols) * (bh + gap) + 10 * u;
      const px = (w - pw) / 2, py = h - ph - pad * 1.2;
      panel(ctx, px, py, pw, ph, { r: 16 * u, fill: COLORS.glassStrong, glow: 14 * u });
      text(ctx, 'DOCKED  ·  HAVEN OUTPOST', px + 20 * u, py + 24 * u, { size: 13 * u, weight: 500, tracking: 3 * u });
      const bank = `Station bank:  ${p.bank.cryon} Cryon  ·  ${p.bank.ferrite} Ferrite`;
      text(ctx, bank, px + 20 * u, py + 46 * u, { size: 11.5 * u, color: COLORS.dim });
      items.forEach(([id, label, ic], i) => {
        const col = i % cols, row = Math.floor(i / cols);
        button(ctx, reg, id, px + 20 * u + col * (bw + gap), py + 62 * u + row * (bh + gap), bw, bh, label, { state, icon: ic, u, primary: id === 'launch', small: true });
      });
    },
    onAction(id) {
      if (id === 'launch') game.hudAction('interact');
      else if (id === 'hangar') game.openHangar('docked');
      else if (id === 'base') game.openBase('docked');
      else if (id === 'map') game.openMap('docked');
    },
    back() { game.pause(); },
  };
}

// ---------------------------------------------------------------- mission complete
function completePanel(game) {
  return {
    id: 'complete',
    menuInput: true,
    defaultFocus: () => 'hangar',
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      const pw = Math.min(w - pad * 2, 620 * u), ph = Math.min(h - pad * 2, (phone && !portrait ? 330 : 420) * u);
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 20 * u, fill: COLORS.glassStrong, stroke: 'rgba(248,189,120,0.55)', glow: 24 * u });
      text(ctx, 'MISSION COMPLETE', w / 2, py + 34 * u, { size: 12 * u, color: COLORS.gold, align: 'center', tracking: 5 * u });
      text(ctx, 'FIRST LIGHT', w / 2, py + 70 * u, { size: 30 * u, weight: 300, align: 'center', tracking: 9 * u });
      divider(ctx, px + 60 * u, py + 96 * u, pw - 120 * u);
      let y = py + 112 * u;
      y += paragraph(ctx, `${GOAL_CRYON} Cryon delivered. Haven Outpost's beacon burns again: the first light of a new home.`, w / 2, y, pw - 80 * u, { size: 13.5 * u, align: 'center', color: COLORS.text });
      y += 12 * u;
      const rewards = [['power', 'Station power restored'], ['hangar', 'Hangar upgrades unlocked'], ['base', 'Orbital base expansion available']];
      rewards.forEach(([ic, label], i) => {
        const ry = y + i * 24 * u;
        icon(ctx, ic, w / 2 - 120 * u, ry + 8 * u, 16 * u, COLORS.cyan);
        text(ctx, label, w / 2 - 100 * u, ry + 8 * u, { size: 12.5 * u, color: COLORS.dim });
      });
      const bh = 46 * u, gap = 10 * u;
      const bw = (pw - 48 * u - gap * 2) / 3;
      [['hangar', 'Open Hangar'], ['launch', 'Keep Exploring'], ['base', 'Orbital Base']].forEach(([id, label], i) => {
        button(ctx, reg, id, px + 24 * u + i * (bw + gap), py + ph - bh - 22 * u, bw, bh, label, { state, u, primary: id === 'hangar', small: true });
      });
    },
    onAction(id) {
      if (id === 'hangar') { game.ui.pop(); game.openHangar('docked'); }
      else if (id === 'base') { game.ui.pop(); game.openBase('docked'); }
      else if (id === 'launch') game.hudAction('interact');
    },
    back() { game.ui.pop(); game.ui.push('docked'); },
  };
}

// ---------------------------------------------------------------- confirm
function confirmDialog(game) {
  let params = {};
  return {
    id: 'confirm',
    menuInput: true,
    defaultFocus: () => 'cancel',
    enter(p) { params = p ?? {}; },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad } = view;
      const pw = Math.min(w - pad * 2, 480 * u), ph = 200 * u;
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 16 * u, fill: COLORS.glassStrong, glow: 16 * u });
      text(ctx, params.title ?? 'Are you sure?', w / 2, py + 36 * u, { size: 17 * u, weight: 400, align: 'center' });
      paragraph(ctx, params.body ?? '', w / 2, py + 60 * u, pw - 60 * u, { size: 12.5 * u, align: 'center' });
      const bh = 44 * u, bw = (pw - 60 * u) / 2;
      button(ctx, reg, 'cancel', px + 20 * u, py + ph - bh - 20 * u, bw, bh, 'Cancel', { state, u });
      button(ctx, reg, 'ok', px + 40 * u + bw, py + ph - bh - 20 * u, bw, bh, params.confirm ?? 'OK', { state, u, danger: params.danger });
    },
    onAction(id) {
      game.ui.pop();
      if (id === 'ok') params.onConfirm?.();
    },
    back() { game.ui.pop(); },
  };
}

export { roundRect, measure };
