import * as THREE from 'three';
import { COLORS, text, panel, button, icon, divider, roundRect } from './kit.js';
import { BASE_MODULES, HEX_NEIGHBOURS, canAfford } from '../game/base.js';

/**
 * ORBITAL OUTPOST builder (IMG 04 layout): connected hex platforms in real
 * 3D seen from a high, narrow-angle construction camera (used only while
 * building), a cyan ghost hex that snaps to valid neighbours (red when not),
 * a bottom module tray and costs in game resources (never ATT).
 */
const ICONS = { solar: 'power', storage: 'cargo', refinery: 'reactor', scanner: 'scanner', dock: 'dock' };

export function createBaseScreen(game) {
  let selectedType = 'solar';
  let cursor = { q: 1, r: 0 };
  let message = '';
  let L = null;
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  const costText = cost => Object.entries(cost).map(([k, v]) => `${v} ${k === 'cryon' ? 'Cryon' : 'Ferrite'}`).join(' + ');

  function firstValid() {
    for (const t of game.profile.base) for (const [dq, dr] of HEX_NEIGHBOURS) {
      if (game.placementStatus(t.q + dq, t.r + dr).ok) return { q: t.q + dq, r: t.r + dr };
    }
    return { q: 1, r: 0 };
  }

  function updateGhost() {
    const [x, z] = game.hexToLocal(cursor.q, cursor.r);
    game.world.ghost.set(x, z, game.placementStatus(cursor.q, cursor.r).ok);
  }

  function pointerToHex(px, py) {
    const view = game.ui.view;
    const cam = game.camera;
    raycaster.setFromCamera(new THREE.Vector2((px / view.w) * 2 - 1, -(py / view.h) * 2 + 1), cam);
    const station = game.world.station.group;
    const origin = new THREE.Vector3().setFromMatrixPosition(station.matrixWorld);
    plane.constant = -origin.y;
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    hit.sub(origin);
    return game.localToHex(hit.x, hit.z);
  }

  function place() {
    const def = BASE_MODULES.find(m => m.type === selectedType);
    const r = game.placeModule(selectedType, cursor.q, cursor.r);
    message = r.ok ? `${def.label} placed` : r.reason;
    if (r.ok) { cursor = firstValid(); updateGhost(); }
  }

  const screen = {
    id: 'base',
    menuInput: true,
    defaultFocus: () => `mod-${selectedType}`,
    signature: () => `${selectedType}|${cursor.q},${cursor.r}|${message}|${game.profile.base.length}|${game.profile.bank.cryon}|${game.profile.bank.ferrite}`,
    enter() {
      message = '';
      cursor = firstValid();
      updateGhost();
      game.world.field.group.visible = true;
      game.world.trails.object.visible = false;
    },
    exit() {
      game.pipeline.setBloom(0.85);
      game.camera.clearViewOffset();
      game.world.ghost.hide();
      game.world.trails.object.visible = true;
    },
    onNav(dir) {
      // Arrow keys / d-pad move the build cursor across the hex grid.
      if (game.ui.state.focus?.startsWith('mod-') && (dir === 'left' || dir === 'right')) return false;
      const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      // Screen-up is toward the planet (+z): map to axial steps.
      if (dir === 'up') cursor = { q: cursor.q, r: cursor.r + 1 };
      else if (dir === 'down') cursor = { q: cursor.q, r: cursor.r - 1 };
      else cursor = { q: cursor.q + (step[0] > 0 ? -1 : 1), r: cursor.r };
      updateGhost();
      return true;
    },
    draw(ctx, view, reg, state) {
      const { w, h, u, pad, portrait, phone } = view;
      const top = Math.max(view.p0Top, pad);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(3,9,30,0.55)'); g.addColorStop(0.25, 'rgba(3,9,30,0)'); g.addColorStop(0.75, 'rgba(3,9,30,0)'); g.addColorStop(1, 'rgba(3,9,30,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      text(ctx, 'ORBITAL OUTPOST', w / 2, top + 14 * u, { size: (phone ? 15 : 19) * u, weight: 300, align: 'center', tracking: 6 * u });
      text(ctx, 'HAVEN  ·  OUTER VERGE', w / 2, top + 36 * u, { size: 9.5 * u, color: COLORS.cyanSoft, align: 'center', tracking: 3 * u });
      // Bank (top-left).
      const p = game.profile;
      [['crystal', p.bank.cryon, COLORS.cyan], ['ore', p.bank.ferrite, COLORS.gold]].forEach(([ic, val, col], i) => {
        icon(ctx, ic, pad + (phone ? 50 : 10) * u, top + 14 * u + i * 26 * u, 17 * u, col);
        text(ctx, String(val), pad + (phone ? 66 : 26) * u, top + 15 * u + i * 26 * u, { size: 15 * u });
      });
      // Module tray (bottom).
      const trayH = (phone ? 96 : 128) * u;
      const tray = { x: pad, y: h - pad - trayH, w: w - pad * 2, h: trayH };
      panel(ctx, tray.x, tray.y, tray.w, tray.h, { r: 16 * u });
      const n = BASE_MODULES.length;
      const backW = portrait ? 0 : 130 * u;
      const cw = (tray.w - 24 * u - backW - (n - 1) * 8 * u) / n;
      BASE_MODULES.forEach((m, i) => {
        const x = tray.x + 12 * u + i * (cw + 8 * u), y = tray.y + 12 * u, ch = tray.h - 24 * u;
        const id = `mod-${m.type}`;
        const sel = selectedType === m.type, focus = state.focus === id || state.hover === id;
        const afford = canAfford(p.bank, m.cost);
        roundRect(ctx, x, y, cw, ch, 12 * u);
        ctx.fillStyle = sel ? 'rgba(30,60,110,0.85)' : 'rgba(8,20,52,0.6)';
        ctx.fill();
        ctx.strokeStyle = sel ? COLORS.cyan : focus ? 'rgba(112,226,244,0.7)' : COLORS.line;
        ctx.lineWidth = sel ? 1.6 : 1; ctx.stroke();
        icon(ctx, ICONS[m.type], x + cw / 2, y + ch * 0.3, Math.min(26 * u, ch * 0.32), sel ? COLORS.cyan : COLORS.text);
        text(ctx, m.label.toUpperCase(), x + cw / 2, y + ch * 0.62, { size: (phone ? 8.5 : 10) * u, align: 'center', tracking: 1.2 * u, maxWidth: cw - 6 * u });
        text(ctx, costText(m.cost), x + cw / 2, y + ch * 0.84, { size: (phone ? 8.5 : 10) * u, align: 'center', color: afford ? COLORS.gold : COLORS.faint, maxWidth: cw - 6 * u });
        reg.add(id, x, y, cw, ch, { data: m.type });
      });
      if (!portrait) button(ctx, reg, 'back', tray.x + tray.w - backW - 4 * u, tray.y + tray.h / 2 - 22 * u, backW - 8 * u, 44 * u, 'Back', { state, icon: 'back', u, small: true });
      // Status + place.
      const def = BASE_MODULES.find(m => m.type === selectedType);
      const status = game.placementStatus(cursor.q, cursor.r);
      const afford = canAfford(p.bank, def.cost);
      const sy = tray.y - (phone ? 56 : 66) * u;
      const prompt = !status.ok ? status.reason : !afford ? `Need ${costText(def.cost)} in the station bank` : `Place ${def.label}`;
      const pw = Math.min(w - pad * 2, 420 * u);
      panel(ctx, w / 2 - pw / 2, sy, pw, (phone ? 46 : 54) * u, { r: 14 * u, fill: 'rgba(8,20,52,0.78)', stroke: status.ok && afford ? COLORS.cyan : COLORS.line });
      ctx.save(); ctx.translate(w / 2 - pw / 2 + 22 * u, sy + (phone ? 23 : 27) * u); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = COLORS.gold; ctx.strokeRect(-5 * u, -5 * u, 10 * u, 10 * u); ctx.restore();
      text(ctx, message || prompt, w / 2 - pw / 2 + 40 * u, sy + (phone ? 23 : 27) * u, { size: 12.5 * u, color: '#F9E3C4', maxWidth: pw - 170 * u });
      button(ctx, reg, 'place', w / 2 + pw / 2 - 118 * u, sy + 8 * u, 108 * u, (phone ? 30 : 38) * u, 'Place', { state, u, small: true, primary: status.ok && afford, enabled: status.ok && afford });
      if (portrait) button(ctx, reg, 'back', pad, top + 60 * u, 110 * u, 38 * u, 'Back', { state, icon: 'back', u, small: true });
      if (!phone) text(ctx, `${def.note} · tap a glowing hex or use the arrows`, w / 2, sy - 14 * u, { size: 10.5 * u, color: COLORS.faint, align: 'center' });
      L = { tray };
      void divider;
    },
    update3d() {
      const view = game.ui.view;
      const cam = game.camera;
      cam.fov = view.portrait ? 40 : 30;
      cam.aspect = view.w / view.h;
      cam.updateProjectionMatrix();
      // High construction view of the station from the planet side.
      const target = new THREE.Vector3(0, 2, 6);
      const camWorld = new THREE.Vector3(-84, 118, -104).multiplyScalar(view.portrait ? 1.45 : 1);
      game.pipeline.setBloom(0.4);
      game.setCameraWorld(camWorld);
      cam.position.copy(game.anchor);
      cam.lookAt(game.anchor.clone().add(target.clone().sub(camWorld)));
      // Push the station up a little so the tray does not cover it.
      cam.setViewOffset(view.w, view.h, 0, view.h * 0.08, view.w, view.h);
      cam.updateMatrixWorld();
    },
    pointerDown(contact) {
      if (L && contact.y > L.tray.y) return null;
      const hex = pointerToHex(contact.x, contact.y);
      if (!hex) return null;
      const same = hex[0] === cursor.q && hex[1] === cursor.r;
      cursor = { q: hex[0], r: hex[1] };
      updateGhost();
      message = '';
      // A second tap on the same valid hex places the module.
      if (same && game.placementStatus(cursor.q, cursor.r).ok) place();
      game.ui.invalidate();
      return null;
    },
    pointerHover(event) {
      if (event.touch || (L && event.y > L.tray.y)) return;
      const hex = pointerToHex(event.x, event.y);
      if (hex && (hex[0] !== cursor.q || hex[1] !== cursor.r)) { cursor = { q: hex[0], r: hex[1] }; updateGhost(); game.ui.invalidate(); }
    },
    onAction(id, data) {
      message = '';
      if (id.startsWith('mod-')) { selectedType = data; return; }
      if (id === 'place') { place(); return; }
      if (id === 'back') this.back();
    },
    back() {
      game.camera.clearViewOffset();
      game.closeSubscreen();
    },
  };
  return screen;
}
