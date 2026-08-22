import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { availableCurrencies } from '../lib/portfolio.js';

export const ToggleRow = GObject.registerClass(
  class ToggleRow extends St.BoxLayout {
    constructor(onToggle, onPickCurrency) {
      super({ style_class: 'crypto-toggle-row', x_expand: true });
      this._onPickCurrency = onPickCurrency;

      this._spacer = new St.Bin({ x_expand: true });
      this.add_child(this._spacer);

      this._portfolioBtn = new St.Button({
        label: 'Portfolio',
        style_class: 'crypto-chip',
        toggle_mode: true,
        y_align: Clutter.ActorAlign.CENTER,
      });
      this._portfolioBtn.connect('clicked', () => onToggle(this._portfolioBtn.checked));
      this.add_child(this._portfolioBtn);
    }

    setPortfolioActive(on) {
      this._portfolioBtn.checked = on;
    }

    buildPicker(coins) {
      const box = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, style_class: 'crypto-picker' });
      const options = availableCurrencies(coins);

      if (!options.length) {
        box.add_child(new St.Label({
          text: 'Add a pair quoted in a real currency first, for example BTC/USD from Coingecko.',
          style_class: 'crypto-picker-hint',
        }));
        return box;
      }

      box.add_child(new St.Label({
        text: 'Portfolio needs a display currency.',
        style_class: 'crypto-picker-hint',
      }));

      const row = new St.BoxLayout({ x_expand: true });
      for (const code of options) {
        const btn = new St.Button({ label: code, style_class: 'crypto-chip' });
        btn.connect('clicked', () => this._onPickCurrency(code));
        row.add_child(btn);
      }
      box.add_child(row);
      return box;
    }
  }
);
