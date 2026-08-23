import cairo from 'gi://cairo';

export const BuySellSplit = {
  id: 'buy-sell',
  label: 'Buy/sell volume (24h)',
  series: 'flow',

  draw(cr, series, w, h, ctx) {
    const bars = (series ?? []).filter(
      p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));
    if (!bars.length) return;

    // Scale to the ninth decile so one spike does not flatten the rest.
    const sides = bars.flat().sort((a, b) => a - b);
    const peak = sides[Math.min(sides.length - 1, Math.floor(sides.length * 0.9))];
    if (!(peak > 0)) return;

    const mid = Math.round(h / 2) + 0.5;
    const slot = w / bars.length;
    const width = Math.max(1, slot - (slot > 3 ? 1 : 0));

    bars.forEach(([buy, sell], i) => {
      const x = i * slot;
      for (const [volume, colour, up] of [[buy, ctx.up, true], [sell, ctx.down, false]]) {
        const len = Math.min(1, volume / peak) * (mid - 1);
        if (!(len > 0)) continue;
        cr.rectangle(x, up ? mid - len : mid, width, len);
        cr.setSourceRGBA(...colour, 0.85);
        cr.fill();
      }
    });

    cr.setLineWidth(0.7);
    cr.setLineCap(cairo.LineCap.BUTT);
    cr.setSourceRGBA(...ctx.flat, 0.5);
    cr.moveTo(0, mid);
    cr.lineTo(w, mid);
    cr.stroke();
  },
};
