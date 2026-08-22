import cairo from 'gi://cairo';
import { points, polyline } from './gradientFill.js';

export const SplitAtOpen = {
  id: 'split-at-open',
  label: 'Split at open',

  draw(cr, series, w, h, ctx) {
    if (!series || series.length < 2) return;
    const pts = points(series, w, h);
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = (max - min) || 1;
    const baseline = 2 + (1 - (series[0] - min) / span) * (h - 4);

    for (const [colour, top, bottom] of [
      [ctx.up, 0, baseline],
      [ctx.down, baseline, h],
    ]) {
      cr.save();
      cr.rectangle(0, top, w, bottom - top);
      cr.clip();

      polyline(cr, pts);
      cr.lineTo(w, baseline);
      cr.lineTo(0, baseline);
      cr.closePath();
      cr.setSourceRGBA(...colour, 0.35);
      cr.fill();

      cr.setLineWidth(1.4);
      cr.setLineJoin(cairo.LineJoin.ROUND);
      cr.setSourceRGBA(...colour, 1);
      polyline(cr, pts);
      cr.stroke();
      cr.restore();
    }
  },
};
