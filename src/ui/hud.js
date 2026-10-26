import { COLORS, text, icon, panel, roundButton, divider, measure, vignette, paragraph, setFont, button } from './kit.js';
import { portrait } from './portraits.js';
import { taskText, tutorialText } from '../tutorial/tutorial.js';
import { SPRITE } from './overlay.js';
import { prettyKey } from '../input/keyboard.js';

/**
 * Wide-flight HUD (IMG 07 / IMG 05 layout): sparse resources top-left, sector
 * title top-centre, icon buttons top-right, objective above round action
 * buttons. On touch devices: floating left stick, right-thumb Boost / Brake /
 * Scan / Action cluster, compact counters. Markers are GPU sprites updated
 * every frame; the canvas redraws only when the readable state changes.
 */
const PAD_GLYPH = { boost: 'RT', brake: 'LT', scan: 'X', interact: 'A', map: 'Y', pause: '☰', hangar: '◀', base: '▶' };

export function createHud(game) {
  let layout = null;

  function hint(action, device, bindings) {
    if (device === 'pad') return PAD_GLYPH[action] ?? '';
    if (device === 'touch') return '';
    return prettyKey(bindings[action]?.[0]);
  }

  function touchLayout(view) {
    const { w, h, u, portrait } = view;
    const big = 36 * u, mid = 29 * u;
    const right = w - 22 * u - view.safeX, bottom = h - 26 * u - view.safeBottom;
    if (portrait) {
      return {
        boost: [right - big, bottom - big - 8 * u, big],
        brake: [right - big * 2 - mid - 18 * u, bottom - mid - 2 * u, mid],
        scan: [right - mid - 4 * u, bottom - big * 2 - mid - 40 * u, mid],
        // Action sits above Brake with room for its label.
        interact: [right - big * 2 - mid - 18 * u, bottom - mid - 2 * u - mid * 2 - 36 * u, mid + 3 * u],
        stickHome: [26 * u + 62 * u, bottom - 70 * u],
      };
    }
    return {
      boost: [right - big, bottom - big, big],
      brake: [right - big * 2 - mid - 16 * u, bottom - mid + 4 * u, mid],
      scan: [right - mid - 6 * u, bottom - big * 2 - mid - 26 * u, mid],
      interact: [right - big * 2 - mid - 16 * u, bottom - mid + 4 * u - mid * 2 - 36 * u, mid + 3 * u],
      stickHome: [40 * u + 62 * u + view.safeX, bottom - 62 * u],
    };
  }

  let stackY = 0;
  // Returns the card's bottom edge.
  function drawRadio(ctx, view, reg, state, m, at) {
    const { u } = view;
    const t = m.tutorial;
    const phone = view.phone;
    const r = (phone ? 19 : 24) * u;
    const textSize = (phone ? 12.5 : 13.5) * u;
    const textX = at.x + r * 2 + 22 * u, textW = at.w - (textX - at.x) - 12 * u;
    setFont(ctx, textSize, 400);
    let lines = 0, line = '';
    for (const word of t.text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > textW && line) { lines++; line = word; } else line = test;
    }
    lines = Math.min(view.landscapePhone ? 2 : 3, lines + 1);
    const h = 30 * u + lines * textSize * 1.35 + 26 * u;
    panel(ctx, at.x, at.y, at.w, h, { r: 12 * u, fill: 'rgba(6,16,42,0.82)', stroke: 'rgba(112,226,244,0.42)', highlight: false });
    const who = t.speaker === 'pilot' ? m.pilot : 'control';
    portrait(ctx, who, at.x + 12 * u + r, at.y + 12 * u + r, r, t.speaker === 'pilot' ? COLORS.gold : COLORS.cyan);
    text(ctx, tutorialText(t.speaker === 'pilot' ? 'tut.name.pilot' : 'tut.name.control'), textX, at.y + 17 * u, { size: 9.5 * u, weight: 700, color: t.speaker === 'pilot' ? COLORS.gold : COLORS.cyan, tracking: 1.6 * u, maxWidth: textW - 90 * u });
    paragraph(ctx, t.text, textX, at.y + 28 * u, textW, { size: textSize, lineHeight: 1.35, color: COLORS.text, maxLines: lines });
    // The task, adapted to the device and the player's own keys.
    const ty = at.y + h - 14 * u;
    ctx.save(); ctx.translate(textX + 4 * u, ty); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.3; ctx.strokeRect(-3.5 * u, -3.5 * u, 7 * u, 7 * u); ctx.restore();
    text(ctx, taskText(t.task, m.device, game.input.bindings), textX + 14 * u, ty, { size: 12 * u, weight: 600, color: '#F9E3C4', maxWidth: textW - 14 * u });
    // Skip: small, but a 44 px target on touch.
    const sw = measure(ctx, tutorialText('tut.skip'), 10 * u, 500) + 16 * u;
    const sx = at.x + at.w - sw - 6 * u, sy = at.y + 4 * u;
    text(ctx, tutorialText('tut.skip'), sx + sw / 2, sy + 12 * u, { size: 10 * u, color: COLORS.faint, align: 'center' });
    reg.add('tutSkip', sx - (m.touch ? 8 : 0), sy - (m.touch ? 8 : 0), sw + (m.touch ? 16 : 0), Math.max(m.touch ? 44 : 0, 24 * u), { focusable: false });
    void button; void state;
    return at.y + h;
  }

  const screen = {
    id: 'hud',
    menuInput: false,
    dimBelow: false,
    pressActions: ['scan', 'interact'],
    refreshRate: 0,
    signature() {
      const m = game.hudModel();
      return [m.cargo.cryon, m.cargo.ferrite, m.cargo.capacity, m.bank.cryon, m.bank.ferrite, m.objective.text, m.objective.detail,
        Math.round(m.objective.distance / 10), m.prompt?.text, Math.round(m.speed), m.mode, m.device, m.touch, m.toasts.map(t => t.id).join(','),
        m.scanCard?.id, m.interact, m.canScan, Math.round((m.scan?.progress ?? 0) * 10), Math.round((m.mining?.progress ?? 0) * 10), m.warning,
        game.input.bindings.boost[0], m.docked, m.tutorial?.step, m.tutorial?.line, m.pilot].join('~');
    },
    draw(ctx, view, reg, state) {
      const m = game.hudModel();
      const { w, h, u } = view;
      const touch = m.touch;
      layout = { touch: touch ? touchLayout(view) : null };
      vignette(ctx, w, h, 0.42);
      const pad = view.pad;
      // On phones Project 0's toolbar spans the full width: keep the whole top band clear.
      const top = view.phone ? Math.max(pad, view.p0Top) : pad;

      // Resources (top-left).
      const chips = [
        ['crystal', m.cargo.cryon, COLORS.cyan],
        ['ore', m.cargo.ferrite, COLORS.gold],
        ['cargo', `${m.cargo.used}/${m.cargo.capacity}`, COLORS.text],
      ];
      const leftX = pad + view.safeX;
      if (view.landscapePhone || !view.phone) {
        // Start below the city's fullscreen button in the top-left corner.
        const chipTop = Math.max(top, view.p0Corner);
        chips.forEach(([ic, val, col], i) => {
          const y = chipTop + 12 * u + i * 26 * u;
          icon(ctx, ic, leftX + 10 * u, y, 18 * u, col);
          text(ctx, String(val), leftX + 26 * u, y + 1, { size: 15 * u, weight: 400, color: COLORS.text, shadow: true });
        });
      } else {
        let x = leftX;
        chips.forEach(([ic, val, col]) => {
          icon(ctx, ic, x + 8 * u, top + 12 * u, 16 * u, col);
          x += 20 * u + text(ctx, String(val), x + 19 * u, top + 13 * u, { size: 14 * u, color: COLORS.text, shadow: true }) + 12 * u;
        });
      }

      // Sector title (top-centre).
      // Phone portrait stacks the counters above the title; elsewhere they share the top line.
      const titleY = view.phone && view.portrait ? top + 44 * u : Math.max(top + 12 * u, view.p0Top + 10 * u);
      const tw = measure(ctx, m.sector.toUpperCase(), 17 * u, 300, 5 * u);
      text(ctx, m.sector.toUpperCase(), w / 2, titleY, { size: (view.phone ? 14 : 17) * u, weight: 300, align: 'center', tracking: 5 * u, shadow: true });
      if (!view.phone || view.landscapePhone) {
        divider(ctx, w / 2 - tw / 2 - 80 * u, titleY, 64 * u, { diamond: false });
        divider(ctx, w / 2 + tw / 2 + 16 * u, titleY, 64 * u, { diamond: false });
      }
      text(ctx, m.sub.toUpperCase(), w / 2, titleY + 18 * u, { size: 9.5 * u, color: COLORS.faint, align: 'center', tracking: 4 * u });

      // Top-right buttons.
      // Touch targets of at least 44 CSS px (radius 23).
      const r = Math.max(view.phone ? 23 : 19 * u, (view.phone ? 23 : 19) * u);
      const ids = touch ? [['pause', 'pause'], ['map', 'map']] : [['pause', 'settings'], ['hangar', 'hangar'], ['map', 'map']];
      ids.forEach(([id, ic], i) => {
        roundButton(ctx, reg, id, w - pad - view.safeX - r - i * (r * 2 + 12 * u), top + r - 4 * u, r, ic, '', { u, state, labelBelow: false });
      });

      // Objective.
      const objY = touch ? (view.portrait ? titleY + 52 * u : titleY + 40 * u) : h - pad - 118 * u;
      const obj = m.objective;
      const objText = obj.text;
      const detail = [obj.detail, obj.distance > 0 ? `${Math.round(obj.distance)} m` : ''].filter(Boolean).join('  ·  ');
      const ow = Math.max(measure(ctx, objText, 15 * u, 400, 1 * u), measure(ctx, detail, 11 * u, 400, 1.5 * u)) + 40 * u;
      ctx.save();
      ctx.fillStyle = COLORS.gold;
      ctx.translate(w / 2 - ow / 2 + 6 * u, objY);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.4;
      ctx.strokeRect(-5 * u, -5 * u, 10 * u, 10 * u);
      ctx.fillRect(-2 * u, -2 * u, 4 * u, 4 * u);
      ctx.restore();
      text(ctx, objText, w / 2 + 10 * u, objY, { size: 15 * u, weight: 400, align: 'center', color: '#F9E3C4', tracking: 1 * u, shadow: true });
      if (detail) text(ctx, detail, w / 2 + 10 * u, objY + 19 * u, { size: 11 * u, color: COLORS.dim, align: 'center', tracking: 1.5 * u, shadow: true });
      divider(ctx, w / 2 - ow / 2, objY + 32 * u, ow, { diamond: false });
      const prog = m.scan?.active ? m.scan.progress : m.mining?.active ? m.mining.progress : 0;
      if (prog > 0) {
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(w / 2 - ow * 0.25, objY + 31 * u, ow * 0.5 * prog, 2);
      }

      // First-flight radio card (Gate D): left on desktop, in the stack on phones.
      if (m.tutorial) {
        if (touch) stackY = drawRadio(ctx, view, reg, state, m, { x: view.landscapePhone ? w / 2 - Math.min(460 * u, w - pad * 2 - view.safeX * 2) / 2 : pad, y: objY + 46 * u, w: view.landscapePhone ? Math.min(460 * u, w - pad * 2 - view.safeX * 2) : w - pad * 2 }) + 30 * u;
        else drawRadio(ctx, view, reg, state, m, { x: pad + view.safeX, y: Math.max(view.p0Corner + 100 * u, h * 0.3), w: Math.min(390 * u, w * 0.3) });
      }

      // Messages stack downward from one cursor so they never overlap: on
      // touch layouts below the objective (which sits under the title), on
      // desktop below the title (the objective is at the bottom there).
      if (!touch || !m.tutorial) stackY = touch ? objY + 50 * u : titleY + 40 * u;
      const maxTextW = w - pad * 2 - 30 * u;
      if (m.warning) {
        const ww = Math.min(maxTextW + 30 * u, measure(ctx, m.warning, 13 * u, 500, 2 * u) + 40 * u);
        const y = touch ? stackY + 2 * u : Math.max(stackY, h * 0.3);
        panel(ctx, w / 2 - ww / 2, y - 14 * u, ww, 28 * u, { r: 14 * u, fill: 'rgba(40,14,48,0.7)', stroke: 'rgba(229,161,207,0.7)' });
        text(ctx, m.warning, w / 2, y, { size: 13 * u, weight: 500, align: 'center', color: COLORS.rose, tracking: 2 * u, maxWidth: ww - 24 * u });
        if (touch) stackY = y + 34 * u;
      }
      const toastSize = (view.phone ? 12 : 13) * u;
      // Short landscape phones keep the two newest, above the action prompt.
      (view.landscapePhone ? m.toasts.slice(-2) : m.toasts).forEach(t => {
        // Letter spacing only while the line fits; otherwise plain text, cut with an ellipsis.
        const natural = measure(ctx, t.text, toastSize, 500, 1.2 * u);
        const fits = natural <= maxTextW;
        const tw2 = Math.min(maxTextW + 30 * u, (fits ? natural : measure(ctx, t.text, toastSize, 500)) + 34 * u);
        panel(ctx, w / 2 - tw2 / 2, stackY - 12 * u, tw2, 24 * u, { r: 12 * u, fill: 'rgba(8,20,52,0.78)', stroke: t.color ?? COLORS.line });
        text(ctx, t.text, w / 2, stackY, { size: toastSize, weight: 500, align: 'center', color: t.color ?? COLORS.text, tracking: fits ? 1.2 * u : 0, maxWidth: tw2 - 24 * u });
        stackY += 30 * u;
      });

      // Context prompt.
      if (m.prompt) {
        // On touch layouts the prompt stays below everything stacked above it.
        const py = touch ? Math.min(h - 150 * u, Math.max(h * (view.portrait ? 0.56 : 0.62), stackY + 14 * u)) : h - pad - 160 * u;
        const label = m.prompt.text.toUpperCase();
        const key = touch ? '' : hint(m.prompt.action, m.device, game.input.bindings);
        const pw = measure(ctx, label, 13 * u, 600, 2.4 * u) + (key ? 46 * u : 30 * u);
        panel(ctx, w / 2 - pw / 2, py - 16 * u, pw, 32 * u, { r: 16 * u, fill: 'rgba(10,40,80,0.72)', stroke: COLORS.cyan, glow: 14 * u });
        let x = w / 2 - pw / 2 + 15 * u;
        if (key) {
          panel(ctx, x - 4 * u, py - 10 * u, 22 * u, 20 * u, { r: 5 * u, fill: 'rgba(112,226,244,0.18)', stroke: COLORS.cyan, highlight: false });
          text(ctx, key, x + 7 * u, py, { size: 11 * u, weight: 600, align: 'center', color: COLORS.cyan });
          x += 28 * u;
        }
        text(ctx, label, x, py, { size: 13 * u, weight: 600, color: COLORS.text, tracking: 2.4 * u });
      }

      // Scan card.
      if (m.scanCard) {
        const c = m.scanCard;
        const cw = (view.phone ? 210 : 230) * u, ch = (view.phone ? 92 : 108) * u;
        // Desktop: right side. Phone portrait: centred under the messages.
        // Phone landscape: left column, between the counters and the stick.
        let cx = w - pad - cw, cy = h * 0.36;
        if (touch && view.portrait) { cx = w / 2 - cw / 2; cy = stackY - 4 * u; }
        else if (touch && m.tutorial) { cx = w - pad - view.safeX - cw; cy = Math.max(view.p0Top, pad) + 54 * u; }
        else if (touch) { cx = pad + view.safeX; cy = Math.max(view.p0Corner, view.p0Top) + 88 * u; }
        panel(ctx, cx, cy, cw, ch, { r: 12 * u, glow: 10 * u });
        icon(ctx, c.type === 'crystal' ? 'crystal' : 'ore', cx + 22 * u, cy + 24 * u, 20 * u, c.type === 'crystal' ? COLORS.cyan : COLORS.gold);
        text(ctx, c.title.toUpperCase(), cx + 40 * u, cy + 24 * u, { size: 12 * u, weight: 600, tracking: 2 * u });
        text(ctx, 'SCAN COMPLETE', cx + cw - 14 * u, cy + 24 * u, { size: 9 * u, color: COLORS.ok, align: 'right', tracking: 1.5 * u });
        const lineH = (view.phone ? 15 : 18) * u, firstY = (view.phone ? 44 : 50) * u;
        c.lines.forEach((l, i) => {
          text(ctx, l[0], cx + 16 * u, cy + firstY + i * lineH, { size: 11.5 * u, color: COLORS.dim });
          text(ctx, l[1], cx + cw - 16 * u, cy + firstY + i * lineH, { size: 11.5 * u, color: COLORS.text, align: 'right' });
        });
      }

      // Speed readout (desktop).
      if (!touch) {
        const sy = h - pad - 14 * u;
        icon(ctx, 'speed', pad + 12 * u, sy - 2 * u, 18 * u, COLORS.cyan);
        text(ctx, `${Math.round(m.speed * 10)} m/s`, pad + 28 * u, sy - 2 * u, { size: 14 * u, shadow: true });
        text(ctx, m.boosting ? 'BOOST' : m.braking ? 'BRAKE' : m.cruise ? 'CRUISE' : 'DRIFT', pad + 28 * u, sy + 15 * u - 2 * u, { size: 9.5 * u, color: COLORS.faint, tracking: 2.5 * u });
      }

      // Action buttons.
      if (touch) {
        const L = layout.touch;
        const actLabel = m.interact === 'dock' ? 'Dock' : m.interact === 'collect' ? 'Collect' : m.interact === 'launch' ? 'Launch' : 'Action';
        roundButton(ctx, reg, 'boost', ...L.boost, 'boost', 'Boost', { u, state, hold: true, active: game.ui.holding('boost') });
        roundButton(ctx, reg, 'brake', ...L.brake, 'brake', 'Brake', { u, state, hold: true, active: game.ui.holding('brake') });
        roundButton(ctx, reg, 'scan', ...L.scan, 'scan', 'Scan', { u, state, accent: COLORS.cyan, active: m.scan?.active });
        roundButton(ctx, reg, 'interact', ...L.interact, m.interact === 'dock' ? 'dock' : 'miner', actLabel, { u, state, enabled: Boolean(m.interact), accent: COLORS.gold });
        if (!game.ui.stickState()) {
          const [sx, sy] = L.stickHome;
          text(ctx, 'STEER', sx, sy + 78 * u, { size: 10 * u, color: COLORS.faint, align: 'center', tracking: 3 * u, shadow: true });
        }
      } else {
        const by = h - pad - 52 * u;
        const rr = 25 * u, gap = 92 * u;
        const buttons = [
          ['boost', 'boost', 'Boost'], ['scan', 'scan', 'Scan'],
          ['interact', m.interact === 'dock' ? 'dock' : 'miner', m.interact === 'dock' ? 'Dock' : m.interact === 'launch' ? 'Launch' : 'Collect'],
          ['base', 'base', 'Base'], ['hangar', 'bag', 'Hangar'],
        ];
        const x0 = w / 2 - ((buttons.length - 1) * gap) / 2;
        buttons.forEach(([id, ic, label], i) => {
          const enabled = id !== 'interact' || Boolean(m.interact);
          roundButton(ctx, reg, id, x0 + i * gap, by, rr, ic, label, {
            u, state, enabled, hint: hint(id, m.device, game.input.bindings), active: (id === 'boost' && m.boosting) || (id === 'scan' && m.scan?.active),
            accent: id === 'interact' ? COLORS.gold : COLORS.cyan,
          });
        });
      }
    },
    sprites(overlay, view) {
      const m = game.hudModel();
      const { u } = view;
      const t = game.time;
      for (const mk of m.markers) {
        const col = mk.kind === 'station' ? [0.97, 0.74, 0.47, 0.95] : [0.44, 0.89, 0.96, 0.95];
        if (mk.onScreen) {
          const pulse = 1 + 0.12 * Math.sin(t * 3);
          overlay.sprite(mk.x, mk.y, 22 * u, SPRITE.DIAMOND, col);
          overlay.sprite(mk.x, mk.y, 46 * u * pulse, SPRITE.RING, [col[0], col[1], col[2], 0.5]);
          if (mk.progress > 0) overlay.sprite(mk.x, mk.y, 62 * u, SPRITE.ARC, [0.55, 0.95, 1, 1], { param: mk.progress });
        } else {
          overlay.sprite(mk.x, mk.y, 26 * u, SPRITE.ARROW, col, { rotation: mk.angle });
        }
      }
      if (m.touch) {
        const st = game.ui.stickState();
        const L = touchLayout(view);
        if (st) {
          const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), max = 58;
          const k = d > max ? max / d : 1;
          overlay.sprite(st.ox, st.oy, 136 * u, SPRITE.RING, [0.6, 0.85, 1, 0.55]);
          overlay.sprite(st.ox, st.oy, 140 * u, SPRITE.DOT, [0.2, 0.4, 0.8, 0.25]);
          overlay.sprite(st.ox + dx * k, st.oy + dy * k, 54 * u, SPRITE.DISC, [0.55, 0.88, 1, 0.55]);
        } else {
          const [sx, sy] = L.stickHome;
          overlay.sprite(sx, sy, 124 * u, SPRITE.RING, [0.6, 0.85, 1, 0.28]);
          overlay.sprite(sx, sy, 44 * u, SPRITE.DISC, [0.55, 0.88, 1, 0.22]);
        }
      }
    },
    pointerDown(contact, event) {
      const view = game.ui.view;
      if (event.touch) {
        const stickZone = contact.x < view.w * 0.5 && contact.y > view.h * (view.portrait ? 0.42 : 0.3);
        return stickZone ? 'stick' : 'look';
      }
      // Mouse: right (or middle) drag looks around; left drag also looks when not on a button.
      return 'look';
    },
    onAction(id) {
      if (id === 'tutSkip') { game.skipTutorial(); return; }
      game.hudAction(id);
    },
    onEdge(e) { game.hudAction(e); },
    back() { game.hudAction('pause'); },
  };
  return screen;
}
