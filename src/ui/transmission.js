import { COLORS, text, paragraph, panel, button, measure, setFont } from './kit.js';
import { portraitCard } from './portraits.js';
import { tutorialText } from '../tutorial/tutorial.js';

/**
 * First-flight briefing (Gate D): Haven Control's opening conversation as a
 * transmission panel at the bottom of the screen. The ship holds position
 * while it is open (game.js); every line waits for the player (Continue:
 * Space / E, controller A, a tap or click on the panel). Haven speaks from
 * the left, the pilot answers from the right. Text types in unless the
 * player chose reduced motion; a press while it types shows the whole line.
 * Skip tutorial is a small link (also in the pause menu).
 */
const TYPE_RATE = 48; // characters per second

export function createTransmission(game) {
  let shown = '';
  let typed = 0;

  const view = () => game.briefingView();
  const full = v => typed >= v.text.length;

  function advance() {
    const v = view();
    if (!v) return;
    if (!full(v)) { typed = v.text.length; return; }
    game.radioNext();
  }

  const screen = {
    id: 'radio',
    menuInput: true,
    dimBelow: false,
    defaultFocus: () => 'radioNext',
    get refreshRate() { const v = view(); return v && !full(v) ? 30 : 0; },
    enter() { shown = ''; typed = 0; },
    tick(dt) {
      const v = view();
      if (!v) return;
      const key = `${v.step}:${v.line}`;
      if (key !== shown) {
        shown = key; typed = 0;
        if (v.speaker === 'control') game.playRadio();
      }
      typed = game.profile.settings.reducedMotion ? v.text.length : Math.min(v.text.length, typed + dt * TYPE_RATE);
    },
    signature() {
      const v = view();
      return v ? `${v.step}~${v.line}~${Math.floor(typed)}~${game.input.device}` : '';
    },
    draw(ctx, viewInfo, reg, state) {
      const v = view();
      if (!v) return;
      const { w, h, u, pad, phone, portrait: tall } = viewInfo;
      const pilot = v.speaker === 'pilot';
      // Legibility: the lower part of the scene darkens behind the panel.
      const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
      g.addColorStop(0, 'rgba(3,8,24,0)');
      g.addColorStop(1, 'rgba(3,8,24,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      const pw = Math.min(w - pad * 2 - viewInfo.safeX * 2, (phone ? 620 : 700) * u);
      const card = (tall ? 82 : phone ? 72 : 118) * u;
      const textSize = (phone ? 15 : 17.5) * u;
      const inner = 16 * u;
      const textW = pw - card - inner * 3;
      // Height: portrait or text block, whichever is taller, plus the controls row.
      setFont(ctx, textSize, 400);
      let lines = 0, line = '';
      for (const word of v.text.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > textW && line) { lines++; line = word; } else line = test;
      }
      lines += 1;
      const textH = 54 * u + lines * textSize * 1.4;
      const bh = Math.max(44, 44 * u);
      const ph = Math.max(card + inner * 2, textH + inner) + bh + 14 * u;
      const px = (w - pw) / 2, py = h - ph - pad - viewInfo.safeBottom;
      panel(ctx, px, py, pw, ph, { r: 14 * u, fill: 'rgba(6,16,42,0.97)', stroke: pilot ? 'rgba(248,189,120,0.6)' : 'rgba(112,226,244,0.6)', glow: 12 * u });
      // The whole panel continues too (a tap anywhere on it).
      reg.add('radioPanel', px, py, pw, ph, { focusable: false });

      const cardX = pilot ? px + pw - inner - card : px + inner;
      portraitCard(ctx, pilot ? game.profile.settings.pilot : 'control', cardX, py + inner, card, card, { border: Math.max(3, 4 * u), accent: pilot ? COLORS.gold : COLORS.cyan });
      const tx = pilot ? px + inner : px + inner * 2 + card;
      // Header: who is talking, and a small Skip link at the end of the row
      // (away from Continue, so it is never hit by accident).
      const accent = pilot ? COLORS.gold : COLORS.cyan;
      const skip = tutorialText('tut.skip');
      const sw = measure(ctx, skip, 11 * u, 500) + 4 * u;
      const hy = py + inner + 7 * u, sx = tx + textW - sw;
      text(ctx, skip, tx + textW, hy, { size: 11 * u, color: COLORS.faint, align: 'right' });
      const touch = v.device === 'touch';
      reg.add('tutSkip', sx - (touch ? 10 : 4), hy - (touch ? 22 : 12), sw + (touch ? 20 : 8), touch ? 44 : 24, { focusable: false });
      ctx.beginPath(); ctx.arc(tx + 4 * u, hy, 3.5 * u, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      text(ctx, tutorialText(pilot ? 'tut.radio.reply' : 'tut.radio.incoming').toUpperCase(), tx + 14 * u, hy, { size: 10 * u, weight: 600, color: accent, tracking: 2.2 * u, maxWidth: textW - sw - 30 * u });
      text(ctx, tutorialText(pilot ? 'tut.name.pilot' : 'tut.name.control'), tx, py + inner + 27 * u, { size: (phone ? 13 : 14) * u, weight: 700, color: COLORS.text, tracking: 1.4 * u, maxWidth: textW });
      // The line, typed in.
      paragraph(ctx, v.text.slice(0, Math.floor(typed)), tx, py + inner + 48 * u, textW, { size: textSize, lineHeight: 1.4, color: COLORS.text });

      // Controls: line dots and Continue (with the key for this device).
      const by = py + ph - inner - bh + 4 * u;
      for (let i = 0; i < v.lines; i++) {
        ctx.beginPath(); ctx.arc(px + inner + 6 * u + i * 16 * u, by + bh / 2, 4 * u, 0, Math.PI * 2);
        ctx.fillStyle = i === v.line ? accent : i < v.line ? 'rgba(214,234,250,0.55)' : 'rgba(214,234,250,0.2)'; ctx.fill();
      }
      const last = v.line === v.lines - 1;
      const label = tutorialText(last ? 'tut.radio.fly' : 'tut.radio.next');
      const key = v.device === 'pad' ? 'A' : touch ? '' : 'Space';
      const nw = Math.min(pw - inner * 2 - v.lines * 16 * u - 16 * u, measure(ctx, label.toUpperCase(), 14 * u, 600, 2.2 * u) + (key ? 130 : 90) * u);
      button(ctx, reg, 'radioNext', px + pw - inner - nw, by, nw, bh, label, { state, primary: true, icon: last ? 'play' : null, hint: key, u });
    },
    onAction(id) {
      if (id === 'tutSkip') game.skipTutorial();
      else if (id === 'radioNext' || id === 'radioPanel') advance();
    },
    back() { game.pause(); },
  };
  return screen;
}
