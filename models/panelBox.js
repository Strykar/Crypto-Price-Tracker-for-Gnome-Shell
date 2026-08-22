import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { formatPrice } from '../lib/format.js';

export const PanelBox = GObject.registerClass(
  class PanelBox extends St.BoxLayout {
    constructor() {
      super({ y_align: Clutter.ActorAlign.CENTER });
      this._labels = new Map();   // coinId -> {label, name}
      this._fallback = new St.Label({
        text: '₿',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'menu-item-text',
      });
      this.add_child(this._fallback);
    }

    setCoins(coins) {
      for (const { label } of this._labels.values()) label.destroy();
      this._labels.clear();

      const active = coins.filter(c => c.activeCoin);
      this._fallback.visible = active.length === 0;

      for (const coin of active) {
        const name = coin.title || coin.symbol;
        const label = new St.Label({
          text: `${name} ...`,
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'menu-item-text',
        });
        this.add_child(label);
        this._labels.set(coin.id, { label, name });
      }
    }

    update(priceService, fmt) {
      for (const [coinId, { label, name }] of this._labels) {
        const price = priceService.getPrice(coinId);
        label.text = `${name} ${formatPrice(price, fmt)}`;
      }
    }
  }
);
