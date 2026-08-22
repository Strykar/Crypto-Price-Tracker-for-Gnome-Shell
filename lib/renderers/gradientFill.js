import cairo from 'gi://cairo';

const FLAT_BAND = 0.0005;   // 0.05%

export function direction(series, ctx) {
  const delta = series[series.length - 1] / series[0] - 1;
  if (!isFinite(delta) || Math.abs(delta) < FLAT_BAND) return ctx.flat;
  return delta > 0 ? ctx.up : ctx.down;
}

export function points(series, w, h, pad = 2) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = (max - min) || 1;
  return series.map((v, i) => [
    i * (w / (series.length - 1)),
    pad + (1 - (v - min) / span) * (h - 2 * pad),
  ]);
}

export function polyline(cr, pts) {
  cr.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) cr.lineTo(pts[i][0], pts[i][1]);
}

export const GradientFill = {
  id: 'gradient-fill',
  label: 'Gradient fill',

  draw(cr, series, w, h, ctx) {
    if (!series || series.length < 2) return;
    const colour = direction(series, ctx);
    const pts = points(series, w, h);

    const gradient = new cairo.LinearGradient(0, 0, 0, h);
    gradient.addColorStopRGBA(0, ...colour, 0.42);
    gradient.addColorStopRGBA(1, ...colour, 0.0);
    polyline(cr, pts);
    cr.lineTo(w, h);
    cr.lineTo(0, h);
    cr.closePath();
    cr.setSource(gradient);
    cr.fill();

    cr.setLineWidth(1.2);
    cr.setLineJoin(cairo.LineJoin.ROUND);
    cr.setLineCap(cairo.LineCap.ROUND);
    cr.setSourceRGBA(...colour, 1);
    polyline(cr, pts);
    cr.stroke();
  },
};
