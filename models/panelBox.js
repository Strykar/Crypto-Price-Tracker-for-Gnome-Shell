import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { formatPrice } from '../lib/format.js';

export const PanelBox = GObject.registerClass(
  class PanelBox extends St.BoxLayout {
    constructor() {
      super({ y_align: Clutter.ActorAlign.CENTER, style_class: 'crypto-panel' });
      this._entries = new Map();   // coinId -> {group, ticker, price, name}
      this._fallback = new St.Label({
        text: '₿',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'crypto-panel-fallback',
      });
      this.add_child(this._fallback);
    }

    setCoins(coins) {
      for (const { group } of this._entries.values()) group.destroy();
      this._entries.clear();

      const active = coins.filter(c => c.activeCoin);
      this._fallback.visible = active.length === 0;

      active.forEach((coin, i) => {
        const group = new St.BoxLayout({
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'crypto-panel-coin',
        });

        if (i > 0) {
          group.add_child(new St.Label({
            text: '·',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'crypto-panel-sep',
          }));
        }

        const name = coin.title || coin.symbol;
        const ticker = new St.Label({
          text: name,
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'crypto-panel-ticker',
        });
        const price = new St.Label({
          text: '…',
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'crypto-panel-price',
        });

        group.add_child(ticker);
        group.add_child(price);
        this.add_child(group);
        this._entries.set(coin.id, { group, ticker, price, name });
      });
    }

    update(priceService, fmt) {
      for (const [coinId, entry] of this._entries)
        entry.price.text = formatPrice(priceService.getPrice(coinId), fmt);
    }
  }
);
