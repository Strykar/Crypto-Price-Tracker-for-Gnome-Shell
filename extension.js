/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { Extension as Ex } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Request from './api/request.js';
import * as CryptoUtil from './utils/cryptoUtil.js';

import * as Settings from './settings.js';
import { CoinMenuItem } from './models/coinMenuItem.js';
import { AddCoinMenuItem } from './models/addCoinMenuItem.js';
import { PanelBox } from './models/panelBox.js';
import { PriceService } from './lib/priceService.js';
import { formatPrice } from './lib/format.js';
import { availableCurrencies, total, totalSeries } from './lib/portfolio.js';
import { Sparkline } from './lib/sparkline.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

function buildCurrencyHint() {
  return new St.Label({
    text: 'Set a portfolio currency in preferences, and add a pair quoted ' +
          'in it, for example BTC/USD.',
    style_class: 'crypto-picker-hint',
  });
}

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    constructor(metadata) {
      super(0.0, `${metadata.name} Indicator`, false);
      this.coins = [];
      this.panelBox = new PanelBox();
      this.add_child(this.panelBox);

      this.coinSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this.coinSection);

      this.coinsScrollViewVbox = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: false,
      });
      this.coinsCountChangeToScroll = 0;
      const baseMenuItem = new PopupMenu.PopupBaseMenuItem({
        hover: false,
        can_focus: false,
        activate: false,
        reactive: false,
      });
      this.coinSection.addMenuItem(baseMenuItem);

      this._coinsScrollview = new St.ScrollView({
        enable_mouse_scrolling: true,
      });
      this._coinsScrollview.set_policy(
        St.PolicyType.NEVER,
        St.PolicyType.AUTOMATIC,
      );
      this._coinsScrollview.add_child(this.coinsScrollViewVbox);
      baseMenuItem.add_child(this._coinsScrollview);

      this._portfolioRow = new PopupMenu.PopupBaseMenuItem({
        hover: false,
        can_focus: false,
        activate: false,
        reactive: false,
      });
      this._portfolioRow.visible = false;
      this.coinSection.addMenuItem(this._portfolioRow);
    }

    _buildAddCoinSection(Me) {

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      let addCoinBtnMenu = new PopupMenu.PopupSubMenuMenuItem('Add New Pair');
      addCoinBtnMenu.add_style_class_name('add-coin-btn');
      this.menu.addMenuItem(addCoinBtnMenu);

      let addCoinSubMenu = new AddCoinMenuItem(this, Me);
      addCoinBtnMenu.menu.addMenuItem(addCoinSubMenu);
    }

    updateTotal(on, currency, priceService) {
      this._portfolioRow.remove_all_children();
      this._portfolioRow.visible = on;
      if (!on) return;

      if (!currency || !availableCurrencies(this.coins).includes(currency)) {
        this._portfolioRow.add_child(buildCurrencyHint());
        return;
      }

      const row = new St.BoxLayout({ x_expand: true });

      const sparkline = new Sparkline();
      sparkline.setSeries(totalSeries(this.coins, currency, priceService));
      row.add_child(sparkline);

      const expander = new St.Bin({ x_expand: true });
      row.add_child(expander);

      const totalLbl = new St.Label({
        text: formatPrice(total(this.coins, currency, priceService)),
        style_class: 'itemLabel text-align-right',
        y_align: Clutter.ActorAlign.CENTER,
      });
      row.add_child(totalLbl);

      this._portfolioRow.add_child(row);
    }

    _buildCoinsSection() {
      this._setCoinsFromSettings();

      for (const coin of this.coins) {
        this.coinsScrollViewVbox.add_child(coin);
      }
      this._coinsScrollview.set_height(
        CryptoUtil.getHeight(this.coinsScrollViewVbox.height),
      );
      this.onCoinsChanged?.();
    }

    _setCoinsFromSettings() {
      let current_exchange = Settings.get_exchange();
      let _coins = Settings.getCoins();

      for (const c of this.coins) c.destroy();
      this.coins = [];

      for (const coin of _coins) {
        if (!coin.id) {
          coin.id = CryptoUtil.createUUID();
          Settings.setCoinId(coin);
        }
        if (!coin.exchange) {
          coin.exchange = current_exchange;
          Settings.updateCoin(coin);
        }
        let _coin = new CoinMenuItem(coin, this.coins, this);
        _coin.onChanged = this.onCoinsChanged;
        this.coins.push(_coin);
      }
    }
  },
);

export default class Extension extends Ex {
  constructor(meta) {
    super(meta);
  }

  enable() {
    this._settings = this.getSettings('org.gnome.shell.extensions.crypto-tracker');

    this._priceService = new PriceService(
      () => Settings.getCoins(),
      () => this._settings.get_int('refresh-interval')
    );

    this._indicator = new Indicator(this.metadata);

    const applyPortfolio = () => {
      const on = this._settings.get_string('dropdown-view') === 'portfolio';
      const currency = this._settings.get_string('base-currency');
      for (const coin of this._indicator.coins) coin.setPortfolioView(on, currency);
      this._indicator.updateTotal(on, currency, this._priceService);
    };
    this._applyPortfolio = applyPortfolio;

    const fmtOpts = () => ({
      separator: this._settings.get_string('number-separator'),
      decimals: this._settings.get_int('decimal-places'),
    });

    const refreshPanel = () => {
      this._indicator.panelBox.setCoins(this._indicator.coins);
      this._indicator.panelBox.update(this._priceService, fmtOpts(),
        this._settings.get_string('panel-separator'));
      applyPortfolio();
    };
    this._indicator.onCoinsChanged = refreshPanel;

    this._indicator._buildAddCoinSection(this);
    this._indicator._buildCoinsSection();

    const redraw = () => {
      const style = this._settings.get_string('chart-style');
      const fmt = fmtOpts();
      for (const coin of this._indicator.coins)
        coin.onPricesUpdated(this._priceService, style, fmt);
      this._indicator.panelBox.update(this._priceService, fmt,
        this._settings.get_string('panel-separator'));
      applyPortfolio();
    };
    this._redraw = redraw;
    this._priceService.connect(redraw);
    this._settingsIds = [
      this._settings.connect('changed::dropdown-view', () => this._redraw()),
      this._settings.connect('changed::chart-style', () => this._redraw()),
      this._settings.connect('changed::base-currency', () => this._redraw()),
      this._settings.connect('changed::number-separator', () => this._redraw()),
      this._settings.connect('changed::decimal-places', () => this._redraw()),
      this._settings.connect('changed::panel-separator', () => this._redraw()),
      // PriceService reads the interval once, so restart it.
      this._settings.connect('changed::refresh-interval', () => {
        this._priceService.stop();
        this._priceService.start();
      }),
    ];
    this._priceService.start();

    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._priceService?.destroy();
    this._priceService = null;
    if (this._indicator?.coins?.length)
      for (const c of this._indicator.coins) c.destroy();
    this._indicator?.destroy();
    this._indicator = null;
    for (const id of this._settingsIds ?? []) this._settings.disconnect(id);
    this._settingsIds = null;
    this._redraw = null;
    this._applyPortfolio = null;
    this._settings = null;
    CryptoUtil.destroy();
    Request.destroy();
    Settings.destroy();
  }
}
