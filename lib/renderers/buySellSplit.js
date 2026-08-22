import cairo from 'gi://cairo';

const SMOOTH = 5;
const BALANCED = 50;

function smooth(series, n = SMOOTH) {
  return series.map((_, i, a) => {
    const w = a.slice(Math.max(0, i - (n - 1)), i + 1);
    return w.reduce((p, c) => p + c, 0) / w.length;
  });
}

export const BuySellSplit = {
  id: 'buy-sell',
  label: 'Buy/sell pressure',
  series: 'flow',

  draw(cr, series, w, h, ctx) {
    if (!series || series.length < 2) return;
    const s = smooth(series);

    const lo = 20, hi = 80;
    const y = v => 2 + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - 4);
    const pts = s.map((v, i) => [i * (w / (s.length - 1)), y(v)]);
    const base = y(BALANCED);
    const poly = () => {
      cr.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) cr.lineTo(pts[i][0], pts[i][1]);
    };

    for (const [colour, top, bottom] of [[ctx.up, 0, base], [ctx.down, base, h]]) {
      cr.save();
      cr.rectangle(0, top, w, bottom - top);
      cr.clip();
      poly();
      cr.lineTo(w, base);
      cr.lineTo(0, base);
      cr.closePath();
      cr.setSourceRGBA(...colour, 0.38);
      cr.fill();
      cr.setLineWidth(1.1);
      cr.setLineJoin(cairo.LineJoin.ROUND);
      cr.setSourceRGBA(...colour, 1);
      poly();
      cr.stroke();
      cr.restore();
    }

    cr.setLineWidth(0.7);
    cr.setSourceRGBA(...ctx.flat, 0.5);
    cr.moveTo(0, base);
    cr.lineTo(w, base);
    cr.stroke();
  },
};
