import GObject from 'gi://GObject';
import St from 'gi://St';

import { getRenderer, DEFAULT_RENDERER_ID } from './renderers/index.js';

export const Sparkline = GObject.registerClass(
  class Sparkline extends St.DrawingArea {
    constructor(params = {}) {
      super({ style_class: 'crypto-sparkline', ...params });
      this._series = [];
      this._rendererId = DEFAULT_RENDERER_ID;
    }

    setSeries(series) {
      const next = series ?? [];
      if (next.length === this._series.length &&
          next[next.length - 1] === this._series[this._series.length - 1])
        return;
      this._series = next;
      this.queue_repaint();
    }

    setRendererId(id) {
      if (id === this._rendererId) return;
      this._rendererId = id;
      this.queue_repaint();
    }

    _themeContext() {
      const node = this.get_theme_node();
      const rgb = (name, fallback) => {
        try {
          const [ok, c] = node.lookup_color(name, false);
          if (ok) return [c.red / 255, c.green / 255, c.blue / 255];
        } catch (e) {}
        return fallback;
      };
      return {
        up: rgb('-crypto-up-color', [0.18, 0.76, 0.44]),
        down: rgb('-crypto-down-color', [0.91, 0.30, 0.33]),
        flat: rgb('-crypto-flat-color', [0.58, 0.60, 0.63]),
      };
    }

    vfunc_repaint() {
      const [w, h] = this.get_surface_size();
      if (w <= 0 || h <= 0) return;
      const cr = this.get_context();
      try {
        getRenderer(this._rendererId).draw(cr, this._series, w, h, this._themeContext());
      } finally {
        cr.$dispose();
      }
    }
  }
);
