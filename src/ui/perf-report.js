import { COLORS, text, panel } from './kit.js';

/**
 * Developer performance report (Settings > Developer > Performance report, or
 * ?perf=1 in the standalone page). Measured numbers only: the CSS view size
 * and pixel ratio the host reports, the 3D render scale actually used (quality
 * x dynamic resolution x software factor), the WebGL renderer string, frame
 * times from the game loop, and three.js draw statistics.
 */
export function createPerfReport(game) {
  const frames = new Float32Array(240);
  let count = 0, cursor = 0;
  let snapshot = null, sinceSnap = 0;

  function summarise() {
    const n = Math.min(count, frames.length);
    if (!n) return null;
    const list = Array.from(frames.subarray(0, n)).sort((a, b) => a - b);
    const avg = list.reduce((a, b) => a + b, 0) / n;
    return { avg, p95: list[Math.min(n - 1, Math.floor(n * 0.95))], worst: list[n - 1], fps: 1000 / Math.max(avg, 1e-3) };
  }

  return {
    get enabled() { return Boolean(game.profile.settings.perfOverlay || game.p0.qa?.perf); },
    /** Frame time in ms (wall clock between frames). */
    sample(ms, dt) {
      frames[cursor] = ms;
      cursor = (cursor + 1) % frames.length;
      count++;
      sinceSnap += dt;
      if (sinceSnap < 0.5 && snapshot) return false;
      sinceSnap = 0;
      const pipe = game.pipeline.debug();
      const info = game.p0.renderer?.info;
      snapshot = {
        frames: summarise(), pipe,
        calls: info?.render?.calls ?? 0, tris: info?.render?.triangles ?? 0,
        geometries: info?.memory?.geometries ?? 0, textures: info?.memory?.textures ?? 0,
      };
      return true; // the report changed: redraw the interface canvas
    },
    draw(ctx, view) {
      if (!snapshot) return;
      const { u } = view;
      const s = snapshot, f = s.frames, p = s.pipe;
      const lines = [
        ['view', `${Math.round(view.w)} × ${Math.round(view.h)} css · dpr ${p.hostPixelRatio.toFixed(2)}`],
        ['3D', `${p.width} × ${p.height} px · scale ${p.effective.toFixed(2)}`],
        ['scale', `quality ${p.renderScale.toFixed(2)} · dyn ${p.dynamicScale.toFixed(2)} · sw ${p.softwareScale.toFixed(2)}`],
        ['quality', `${game.quality}${p.bloom ? ' · bloom' : ''}${p.samples ? ` · msaa ${p.samples}` : ''}`],
        ['frame', f ? `${f.fps.toFixed(1)} fps · avg ${f.avg.toFixed(1)} · p95 ${f.p95.toFixed(1)} · max ${f.worst.toFixed(0)} ms` : '…'],
        ['draw', `${s.calls} calls · ${(s.tris / 1000).toFixed(1)}k tris · ${s.geometries} geo · ${s.textures} tex`],
        ['gpu', game.software.name.replace(/^ANGLE \(/, '').slice(0, 58)],
        ['ui', `${p.overlayWidth} × ${p.overlayHeight} px canvas`],
      ];
      const w = 372 * u, lh = 15 * u, h = lines.length * lh + 30 * u;
      const x = view.w - w - view.pad, y = Math.max(view.p0Top, view.pad) + 56 * u;
      panel(ctx, x, y, w, h, { r: 8 * u, fill: 'rgba(2,8,24,0.86)', stroke: 'rgba(248,189,120,0.6)', highlight: false });
      text(ctx, 'PERFORMANCE (DEV)', x + 10 * u, y + 13 * u, { size: 9.5 * u, weight: 600, color: COLORS.gold, tracking: 1.5 * u });
      lines.forEach(([k, v], i) => {
        const ly = y + 30 * u + i * lh;
        text(ctx, k, x + 10 * u, ly, { size: 10.5 * u, color: COLORS.faint });
        text(ctx, v, x + 62 * u, ly, { size: 10.5 * u, color: COLORS.text, maxWidth: w - 72 * u });
      });
    },
  };
}
