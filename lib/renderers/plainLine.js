import cairo from 'gi://cairo';
import { direction, points, polyline } from './gradientFill.js';

export const PlainLine = {
  id: 'plain-line',
  label: 'Plain line',

  draw(cr, series, w, h, ctx) {
    if (!series || series.length < 2) return;
    cr.setLineWidth(1.4);
    cr.setLineJoin(cairo.LineJoin.ROUND);
    cr.setLineCap(cairo.LineCap.ROUND);
    cr.setSourceRGBA(...direction(series, ctx), 1);
    polyline(cr, points(series, w, h));
    cr.stroke();
  },
};
