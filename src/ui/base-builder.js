import { COLORS, text, button, panel } from './kit.js';

// Temporary stub (replaced by the full screen).
export function createBaseScreen(game) {
  return {
    id: 'base',
    menuInput: true,
    draw(ctx, view, reg, state) {
      const { w, h, u } = view;
      panel(ctx, w / 2 - 200 * u, h / 2 - 80 * u, 400 * u, 160 * u, {});
      text(ctx, 'base', w / 2, h / 2 - 30 * u, { size: 18 * u, align: 'center', color: COLORS.text });
      button(ctx, reg, 'back', w / 2 - 90 * u, h / 2 + 10 * u, 180 * u, 44 * u, 'Back', { state, u });
    },
    onAction() { game.closeSubscreen(); },
    back() { game.closeSubscreen(); },
  };
}
