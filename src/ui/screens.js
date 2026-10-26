import * as THREE from 'three';
import { COLORS, UI_FX, setFont, text, paragraph, panel, button, slider, title, divider, icon, measure, vignette, roundRect } from './kit.js';
import { VESSELS, BASE_CARGO } from '../game/ships.js';
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
  ui.register('choice', choiceDialog(game));
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
        ['prologue', 'Prologue', 'book', true],
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
      else if (id === 'prologue') game.openPrologue();
      else if (id === 'settings') game.ui.push('settings');
    },
    back() {},
  };
}

// ------------------------------------------------------------ vessel select
// Cards are drawn in three bands around a clear "window": the real 3D ship
// shows through that window on its own dark showroom stage (game.js), and no
// interface colour is painted over it (M1 dimmed the ships behind a veil).
function vesselSelect(game) {
  let selected = 'survivor';
  let cards = [];
  let note = '';
  const s = {
    id: 'select',
    menuInput: true,
    defaultFocus: () => `card-${selected}`,
    signature: () => `${selected}|${note}`,
    enter(params) { selected = 'survivor'; note = ''; if (params?.focus) selected = params.focus; },
    exit() { game.hideShowroom(); game.world.glows.object.visible = true; game.world.setShowroomLight(0); game.pipeline.setBloom(0.85); game.pipeline.setExposure(1); },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      const top = Math.max(view.p0Top + 6 * u, portrait ? pad * 2.2 : pad * (phone ? 1.2 : 2.2));
      const ts = portrait ? Math.min(22 * u, w / 16) : (phone ? 18 : 28) * u;
      // Header and footer bands are layout, measured before the cards.
      let cursor = top + ts * 1.5 + 14 * u;
      const intro = 'The Survivor is free and flies the whole journey. The other vessels are previews of ships planned for later: nothing can be bought in this version.';
      const introW = Math.min(w - pad * 3, 700 * u);
      const introSize = (portrait ? 11.5 : phone ? 11 : 13.5) * u;
      const cols = portrait ? 2 : 4;
      const gap = (phone ? 10 : 18) * u;
      const btnH = (phone ? 44 : 52) * u;
      const introH = (!phone || portrait) ? 52 * u : 30 * u;
      const cardsTop = cursor + introH;
      const availH = h - cardsTop - btnH - pad * 2.2 - (portrait ? btnH + 10 * u : 0) - 18 * u;
      const rows = Math.ceil(VESSELS.length / cols);
      const cw = Math.min((w - pad * 2 - gap * (cols - 1)) / cols, 270 * u);
      const ch = Math.min((availH - gap * (rows - 1)) / rows, cw * 1.5);
      const gridW = cw * cols + gap * (cols - 1);
      const x0 = (w - gridW) / 2;
      const compact = cw < 220 * u || ch < 230 * u;
      const headH = (compact ? 48 : 58) * u, footH = (compact ? 60 : 62) * u;
      const windows = VESSELS.map((v, i) => {
        const cx = x0 + (i % cols) * (cw + gap), cy = cardsTop + Math.floor(i / cols) * (ch + gap);
        return { v, cx, cy, wx: cx + 6 * u, wy: cy + headH, ww: cw - 12 * u, wh: ch - headH - footH };
      });

      // Soft dim over the background, with the ship windows left clear.
      vignette(ctx, w, h, 0.55);
      ctx.fillStyle = 'rgba(4,10,32,0.42)';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (const c of windows) { roundRect(ctx, c.wx, c.wy, c.ww, c.wh, 10 * u); ctx.fillStyle = '#000'; ctx.fill(); }
      ctx.restore();

      title(ctx, w / 2, top + ts / 2, ts, { align: 'center', u });
      text(ctx, 'BEGIN THE EXODUS  ·  CHOOSE YOUR VESSEL', w / 2, top + ts * 1.45, { size: (phone ? 10 : 13) * u, color: COLORS.cyan, align: 'center', tracking: (phone ? 3 : 5) * u, maxWidth: w - pad * 2 });
      if (!phone || portrait) paragraph(ctx, intro, w / 2, cursor, introW, { size: introSize, align: 'center', color: COLORS.text, lineHeight: 1.4 });
      else text(ctx, 'Survivor: free, full journey  ·  others: previews, nothing for sale', w / 2, cursor + 8 * u, { size: introSize, align: 'center', color: COLORS.text });

      cards = [];
      for (const c of windows) {
        const { v, cx, cy, wx, wy, ww, wh } = c;
        const id = `card-${v.id}`;
        const isSel = selected === v.id, focused = state.focus === id || state.hover === id;
        const small = compact;
        const edge = isSel ? (v.available ? COLORS.cyan : COLORS.lilac) : focused ? 'rgba(112,226,244,0.75)' : 'rgba(132,214,250,0.42)';
        // Header band.
        ctx.save();
        roundRect(ctx, cx, cy, cw, ch, 12 * u);
        ctx.clip();
        ctx.fillStyle = isSel ? 'rgba(10,30,70,0.92)' : 'rgba(7,16,44,0.88)';
        ctx.fillRect(cx, cy, cw, headH);
        ctx.fillRect(cx, cy + ch - footH, cw, footH);
        ctx.fillRect(cx, cy + headH, 6 * u, wh);
        ctx.fillRect(cx + cw - 6 * u, cy + headH, 6 * u, wh);
        ctx.restore();
        roundRect(ctx, cx, cy, cw, ch, 12 * u);
        if (isSel && UI_FX.shadows) { ctx.save(); ctx.shadowColor = 'rgba(112,226,244,0.6)'; ctx.shadowBlur = 16 * u; }
        ctx.strokeStyle = edge; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
        if (isSel && UI_FX.shadows) ctx.restore();
        roundRect(ctx, wx, wy, ww, wh, 10 * u);
        ctx.strokeStyle = 'rgba(132,214,250,0.22)'; ctx.lineWidth = 1; ctx.stroke();

        text(ctx, v.name.toUpperCase(), cx + cw / 2, cy + (small ? 16 : 20) * u, { size: (small ? 12 : 14) * u, weight: 600, align: 'center', tracking: 2.2 * u, maxWidth: cw - 40 * u });
        if (v.available) {
          text(ctx, 'FREE  ·  AVAILABLE', cx + cw / 2, cy + (small ? 33 : 40) * u, { size: (small ? 10 : 12) * u, weight: 700, align: 'center', color: COLORS.cyan, tracking: 1.6 * u, maxWidth: cw - 14 * u });
        } else {
          icon(ctx, 'lock', cx + cw - 16 * u, cy + 15 * u, 13 * u, COLORS.dim);
          text(ctx, small ? `PREVIEW · ${v.att} ATT PLANNED` : `LOCKED PREVIEW  ·  ${v.att} ATT PLANNED`, cx + cw / 2, cy + (small ? 33 : 40) * u, { size: (small ? 9 : 10) * u, weight: 600, align: 'center', color: COLORS.gold, tracking: 1 * u, maxWidth: cw - 14 * u });
        }
        if (isSel && v.available) {
          // "Selected" badge on the window's top edge.
          const bw = measure(ctx, 'SELECTED', 9.5 * u, 700, 1.6 * u) + 30 * u, bh = 18 * u;
          const bx = cx + cw / 2 - bw / 2, by = wy + 6 * u;
          roundRect(ctx, bx, by, bw, bh, bh / 2);
          ctx.fillStyle = COLORS.cyan; ctx.fill();
          icon(ctx, 'check', bx + 11 * u, by + bh / 2, 11 * u, '#061433', 2);
          text(ctx, 'SELECTED', bx + 20 * u, by + bh / 2 + 0.5, { size: 9.5 * u, weight: 700, color: '#061433', tracking: 1.6 * u });
        }
        // The ship itself is a real 3D model placed in the window by update3d().
        cards.push({ id: v.id, area: { x: wx + ww / 2, y: wy + wh * 0.54, w: ww, h: wh }, window: { x: wx, y: wy, w: ww, h: wh }, selected: isSel });
        // Footer: crew and cargo, then the benefit.
        const cargo = BASE_CARGO + v.cargoBonus;
        const fy = cy + ch - footH;
        if (small) {
          text(ctx, `${v.crew} CREW  ·  ${cargo} CARGO`, cx + cw / 2, fy + 13 * u, { size: 10.5 * u, weight: 700, align: 'center', tracking: 0.8 * u, maxWidth: cw - 12 * u });
          paragraph(ctx, v.benefit, cx + cw / 2, fy + 24 * u, cw - 16 * u, { size: 10 * u, lineHeight: 1.3, align: 'center', color: v.available ? COLORS.text : COLORS.dim, maxLines: 2 });
        } else {
          icon(ctx, 'crew', cx + cw * 0.27 - 22 * u, fy + 18 * u, 14 * u, COLORS.cyan);
          text(ctx, `${v.crew} CREW`, cx + cw * 0.27 - 12 * u, fy + 18 * u, { size: 12 * u, weight: 600, tracking: 1 * u, maxWidth: cw * 0.4 });
          icon(ctx, 'cargo', cx + cw * 0.68 - 22 * u, fy + 18 * u, 14 * u, COLORS.gold);
          text(ctx, `${cargo} CARGO`, cx + cw * 0.68 - 12 * u, fy + 18 * u, { size: 12 * u, weight: 600, tracking: 1 * u, maxWidth: cw * 0.36 });
          text(ctx, v.benefit, cx + cw / 2, fy + 44 * u, { size: 11.5 * u, align: 'center', color: v.available ? COLORS.text : COLORS.dim, maxWidth: cw - 14 * u });
        }
        reg.add(id, cx, cy, cw, ch, { data: v.id });
      }
      // Buttons.
      const sel = VESSELS.find(v => v.id === selected);
      const by = h - pad * 1.4 - btnH;
      const startLabel = sel.available ? 'Start Journey' : 'Choose the Survivor';
      if (portrait) {
        const bw = Math.min(w - pad * 3, 380 * u);
        button(ctx, reg, 'start', (w - bw) / 2, by - btnH - 10 * u, bw, btnH, startLabel, { state, primary: true, icon: 'next', u });
        button(ctx, reg, 'back', (w - bw) / 2, by, bw, btnH, 'Back', { state, icon: 'back', u });
      } else {
        const bw = (phone ? 220 : 300) * u;
        button(ctx, reg, 'back', w / 2 - bw - 10 * u, by, bw, btnH, 'Back', { state, icon: 'back', u });
        button(ctx, reg, 'start', w / 2 + 10 * u, by, bw, btnH, startLabel, { state, primary: true, icon: 'next', u });
      }
      const status = note || (sel.available ? '' : `${sel.name} is a preview of a planned ship. It cannot be bought or flown in this version.`);
      if (status) text(ctx, status, w / 2, by - (portrait ? btnH + 22 * u : 14 * u), { size: 11 * u, color: sel.available ? COLORS.cyan : COLORS.gold, align: 'center', maxWidth: w - pad * 2 });
    },
    update3d(dt) {
      const v = game.ui.view;
      const cam = game.camera;
      const D = 30;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      game.world.glows.object.visible = false;
      game.pipeline.setBloom(0.3);
      game.pipeline.setExposure(0.92);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const centre = cam.position.clone().addScaledVector(forward, D);
      game.world.setShowroomLight(2.2, cam, centre);
      for (const c of cards) {
        const vessel = VESSELS.find(x => x.id === c.id);
        const entry = game.showroomShip(`select-${c.id}`, vessel.id, undefined);
        const g = entry.ship.group;
        g.visible = true;
        const ndc = new THREE.Vector3((c.area.x / v.w) * 2 - 1, -(c.area.y / v.h) * 2 + 1, 0.5);
        const dir = ndc.unproject(cam).sub(cam.position).normalize();
        g.position.copy(cam.position).addScaledVector(dir, D);
        const worldPerPx = (2 * D * tanHalf) / v.h;
        const targetSize = Math.min(c.area.w * 0.8, c.area.h * 1.15) * worldPerPx;
        const scale = targetSize / (entry.ship.radius * 2);
        g.scale.setScalar(scale);
        g.userData.spin = (g.userData.spin ?? 0.6 + c.id.length) + dt * (c.selected ? 0.7 : 0.18);
        // Three-quarter view from above, nose toward the top of the card.
        orientForShowcase(g, cam.quaternion, 0.62, Math.sin(g.userData.spin) * 0.55);
        g.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), Math.sin(game.time * 1.4 + c.id.length) * targetSize * 0.03);
        // Its dark stage fills the card window, behind the ship.
        const stage = game.showroomStage(`select-${c.id}`);
        const DS = D + 14;
        const wc = { x: c.window.x + c.window.w / 2, y: c.window.y + c.window.h / 2 };
        const sdir = new THREE.Vector3((wc.x / v.w) * 2 - 1, -(wc.y / v.h) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
        const along = DS / Math.max(0.2, sdir.dot(forward));
        stage.position.copy(cam.position).addScaledVector(sdir, along);
        stage.quaternion.copy(cam.quaternion);
        const wpp = (2 * DS * tanHalf) / v.h;
        stage.scale.set(c.window.w * wpp, c.window.h * wpp, 1);
        stage.material.uniforms.uAspect.value = c.window.w / Math.max(1, c.window.h);
        stage.material.uniforms.uSelected.value = c.selected ? 1 : 0;
        stage.visible = true;
      }
    },
    onAction(id, data) {
      if (id.startsWith('card-')) {
        const v = VESSELS.find(x => x.id === data);
        // Confirming the vessel that is already selected goes on (Space/E/A twice, or a second tap).
        if (selected === data && v.available) askFree();
        else { selected = data; note = ''; }
        return;
      }
      if (id === 'start') {
        const v = VESSELS.find(x => x.id === selected);
        if (v.available) askFree();
        else { selected = 'survivor'; note = 'The Survivor is selected. It is free and plays the whole journey.'; game.ui.focus('card-survivor'); }
      }
      if (id === 'back') game.toMenu();
    },
    back() { game.toMenu(); },
  };
  // A transparent, pressure-free check: two equal choices, no countdown, no guilt.
  function askFree() {
    game.ui.push('choice', {
      title: 'Fly the Survivor?',
      body: 'Free, with a crew of 3 and room for 12 cargo. Everything in this version can be played with it.',
      choices: [['free', 'Continue free'], ['view', 'View other ships']],
      onChoice: c => {
        if (c === 'free') game.startNewJourney('survivor');
        else { selected = 'pioneer'; note = ''; game.ui.focus('card-pioneer'); }
      },
    });
  }
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
  let page = 'main'; // main | keys | dev
  const options = () => {
    const s = game.profile.settings;
    if (page === 'dev') {
      return [
        { id: 'perfOverlay', label: 'Performance report', value: s.perfOverlay, values: [false, true], show: v => (v ? 'On' : 'Off') },
        { id: 'shipModel', label: 'Ship model (A/B)', value: s.shipModel, values: ['mk2', 'm1'], show: v => (v === 'm1' ? 'M1 (previous)' : 'Explorer Mk2') },
      ];
    }
    return [
      { id: 'quality', label: 'Graphics quality', value: s.quality, values: ['auto', 'high', 'medium', 'low'], show: v => (v === 'auto' ? `Auto (${game.quality})` : v[0].toUpperCase() + v.slice(1)) },
      { id: 'handling', label: 'Handling', value: s.handling, values: ['tranquil', 'responsive'], show: v => v[0].toUpperCase() + v.slice(1) },
      { id: 'autoCruise', label: 'Auto-cruise', value: s.autoCruise, values: [true, false], show: v => (v ? 'On' : 'Off') },
      { id: 'invertY', label: 'Invert climb / dive', value: s.invertY, values: [false, true], show: v => (v ? 'On' : 'Off') },
      { id: 'sensitivity', label: 'Steering sensitivity', value: s.sensitivity, values: [0.6, 0.8, 1, 1.2, 1.4], show: v => `${Math.round(v * 100)}%` },
      { id: 'cameraZoom', label: 'Camera distance', value: s.cameraZoom, values: [1.2, 1, 0.85], show: v => (v > 1.1 ? 'Wide' : v < 0.95 ? 'Close' : 'Standard') },
      { id: 'reducedMotion', label: 'Reduced motion', value: s.reducedMotion, values: [false, true], show: v => (v ? 'On' : 'Off') },
      { id: 'musicVolume', label: 'Music volume', slider: true, value: s.musicVolume, muteKey: 'music', muted: !s.music },
      { id: 'sfxVolume', label: 'Effects volume', slider: true, value: s.sfxVolume, muteKey: 'sound', muted: !s.sound },
    ];
  };
  function cycle(opt, dir = 1) {
    const i = opt.values.findIndex(v => v === opt.value);
    const next = opt.values[(i + dir + opt.values.length) % opt.values.length];
    game.setSetting(opt.id, next);
  }
  // Volume steps of 10 %; moving a muted slider un-mutes it.
  function setVolume(opt, value) {
    const v = Math.round(Math.max(0, Math.min(1, value)) * 20) / 20;
    if (opt.muted && v > 0) game.setSetting(opt.muteKey, true);
    game.setSetting(opt.id, v);
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
      if (opt.slider) setVolume(opt, opt.value + (dir === 'left' ? -0.1 : 0.1));
      else cycle(opt, dir === 'left' ? -1 : 1);
      return true;
    },
    onItemDrag(id, x, data) {
      const opt = options().find(o => o.id === id);
      if (opt?.slider && data?.w) setVolume(opt, (x - data.x) / data.w);
    },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      ctx.fillStyle = 'rgba(3,9,30,0.6)';
      ctx.fillRect(0, 0, w, h);
      const pw = Math.min(w - pad * 2, phone ? w - pad * 2 : 980 * u), ph = Math.min(h - pad * 2, 660 * u);
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 18 * u, fill: COLORS.glassStrong, glow: 18 * u });
      const heading = page === 'keys' ? 'KEYBOARD' : page === 'dev' ? 'DEVELOPER TOOLS' : 'SETTINGS';
      text(ctx, heading, px + 28 * u, py + 32 * u, { size: 17 * u, weight: 300, tracking: 6 * u });
      const rowH = (phone ? (portrait ? 36 : 31) : 40) * u;
      const rowGap = (phone && !portrait ? 5 : 6) * u;
      const showKeysInline = !phone && !portrait && pw > 860 * u;
      if (page === 'main' || page === 'dev') {
        // Short landscape phones use two columns of options.
        const opts = options();
        const cols = phone && !portrait ? 2 : 1;
        const perCol = Math.ceil(opts.length / cols);
        const colW = showKeysInline && page === 'main' ? pw / 2 - 42 * u : (pw - 56 * u - (cols - 1) * 24 * u) / cols;
        opts.forEach((o, i) => {
          const col = Math.floor(i / perCol), row = i % perCol;
          const x = px + 28 * u + col * (colW + 24 * u);
          const y = py + 58 * u + row * (rowH + rowGap);
          text(ctx, o.label, x, y + rowH / 2, { size: 13 * u, color: COLORS.dim, maxWidth: colW * 0.42 });
          if (o.slider) {
            const sw = Math.min(250 * u, colW * 0.56);
            slider(ctx, reg, o.id, x + colW - sw, y, sw, rowH, o.value, { state, u, muted: o.muted });
          } else {
            const bw = Math.min(190 * u, colW * 0.46);
            button(ctx, reg, o.id, x + colW - bw, y, bw, rowH, o.show(o.value), { state, u, small: true });
          }
        });
        const after = py + 58 * u + perCol * (rowH + rowGap) + 4 * u;
        if (page === 'main') {
          const bw2 = Math.min(240 * u, (colW - 12 * u) / 2);
          if (!showKeysInline) button(ctx, reg, 'keys', px + 28 * u, after, bw2, rowH, 'Keyboard', { state, icon: 'settings', u, small: true, align: 'left' });
          button(ctx, reg, 'dev', px + 28 * u + (showKeysInline ? 0 : bw2 + 12 * u), after, bw2, rowH, 'Developer', { state, icon: 'help', u, small: true, align: 'left' });
          const hintY = after + rowH + 16 * u;
          if (hintY < py + ph - 70 * u) text(ctx, 'Music: ←/→ volume · Space mute. Guests keep settings until they leave.', px + 28 * u, hintY, { size: 10.5 * u, color: COLORS.faint, maxWidth: (showKeysInline ? pw / 2 : pw) - 56 * u });
          if (game.software?.software && hintY + 18 * u < py + ph - 70 * u) text(ctx, 'Software renderer detected: the light version is active.', px + 28 * u, hintY + 18 * u, { size: 11 * u, color: COLORS.gold });
          if (showKeysInline) drawKeys(ctx, reg, state, view, px + pw / 2 + 14 * u, py + 58 * u, pw / 2 - 42 * u, rowH * 0.78);
        } else {
          paragraph(ctx, 'For testing only. The performance report shows the view size, pixel ratio, render scale, renderer and frame times over the game. The ship model switch compares the new Explorer Mk2 with the M1 ship (rollback check); saves keep working with either.', px + 28 * u, after + 6 * u, pw - 56 * u, { size: 11.5 * u, color: COLORS.faint });
        }
      } else drawKeys(ctx, reg, state, view, px + 28 * u, py + 58 * u, pw - 56 * u, rowH * 0.85);
      if (message) text(ctx, message, px + pw / 2, py + ph - 82 * u, { size: 12 * u, color: COLORS.cyan, align: 'center' });
      const bh = (phone ? 40 : 46) * u;
      button(ctx, reg, 'back', px + 28 * u, py + ph - bh - 20 * u, 200 * u, bh, page === 'main' ? 'Back' : 'Done', { state, icon: 'back', u });
      if (game.hasSave && page === 'main') button(ctx, reg, 'reset', px + pw - 228 * u, py + ph - bh - 20 * u, 200 * u, bh, 'Reset progress', { state, u, danger: true, small: true });
    },
    onAction(id) {
      const opt = options().find(o => o.id === id);
      if (opt?.slider) { game.setSetting(opt.muteKey, opt.muted); return; } // confirm toggles mute
      if (opt) { cycle(opt, 1); return; }
      if (id === 'keys') { page = 'keys'; return; }
      if (id === 'dev') { page = 'dev'; return; }
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
      if (page !== 'main') { page = 'main'; return; }
      game.ui.pop();
    },
  };

  function drawKeys(ctx, reg, state, view, x, y, width, rowH) {
    const { u } = view;
    const b = game.profile.settings.bindings;
    ACTIONS.forEach((a, i) => {
      const yy = y + i * (rowH + 4 * u);
      text(ctx, a.label, x, yy + rowH / 2, { size: 12 * u, color: COLORS.dim });
      const label = capture === a.id ? '…' : (b[a.id] ?? []).slice(0, 2).map(prettyKey).join(' / ');
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

// ---------------------------------------------------------------- choice
// Two (or more) equally weighted answers: same size, same style, no default
// colour that pushes one of them.
function choiceDialog(game) {
  let params = {};
  return {
    id: 'choice',
    menuInput: true,
    defaultFocus: () => `choice-${params.choices?.[0]?.[0] ?? ''}`,
    enter(p) { params = p ?? {}; },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, phone } = view;
      const choices = params.choices ?? [];
      const pw = Math.min(w - pad * 2, 520 * u);
      ctx.save();
      const bodyH = paragraphHeight(ctx, params.body ?? '', pw - 60 * u, 13 * u);
      ctx.restore();
      const bh = 46 * u, stacked = pw < 420 * u;
      const ph = 74 * u + bodyH + (stacked ? choices.length * (bh + 10 * u) : bh) + 34 * u;
      const px = (w - pw) / 2, py = (h - ph) / 2;
      panel(ctx, px, py, pw, ph, { r: 16 * u, fill: COLORS.glassStrong, glow: 16 * u });
      text(ctx, params.title ?? '', w / 2, py + 34 * u, { size: (phone ? 16 : 18) * u, weight: 400, align: 'center', tracking: 1 * u });
      paragraph(ctx, params.body ?? '', w / 2, py + 58 * u, pw - 60 * u, { size: 13 * u, align: 'center', color: COLORS.text });
      const by = py + 70 * u + bodyH;
      choices.forEach(([id, label], i) => {
        if (stacked) button(ctx, reg, `choice-${id}`, px + 24 * u, by + i * (bh + 10 * u), pw - 48 * u, bh, label, { state, u });
        else {
          const bw = (pw - 48 * u - 12 * u * (choices.length - 1)) / choices.length;
          button(ctx, reg, `choice-${id}`, px + 24 * u + i * (bw + 12 * u), by, bw, bh, label, { state, u });
        }
      });
    },
    onAction(id) {
      game.ui.pop();
      if (id.startsWith('choice-')) params.onChoice?.(id.slice(7));
    },
    back() { game.ui.pop(); },
  };
}

function paragraphHeight(ctx, str, maxWidth, size, lineHeight = 1.45) {
  setFont(ctx, size, 400);
  let lines = 0, line = '';
  for (const word of String(str).split(/\s+/)) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxWidth && line) { lines++; line = word; } else line = t;
  }
  if (line) lines++;
  return lines * size * lineHeight;
}

export { roundRect, measure };
