// noinspection DuplicatedCode
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as SourceClient from '../api/sourceClient.js';
import * as Settings from '../settings.js';
import { formatPrice } from '../lib/format.js';
import { Sparkline } from '../lib/sparkline.js';
import { quoteOf } from '../lib/portfolio.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export let CoinMenuItem = GObject.registerClass(
  class CoinMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(coin, coins, panelMenu) {
      super({
        reactive: true,
        activate: true,
        hover: true,
        can_focus: true,
      });

      this.id = coin.id;
      this.symbol = coin.symbol;
      this.coingecko_id = coin.coingecko_id;
      this.activeCoin = coin.active;
      this.title = coin.title;
      this.exchange = coin.exchange;
      this.amount = coin.amount ?? 0;
      this.coins = coins;
      this.panelMenu = panelMenu;

      this.add_style_class_name('popup-submenu-menu-item');
      this._switch = new PopupMenu.Switch(this.activeCoin);

      this.accessible_role = Atk.Role.CHECK_MENU_ITEM;
      this.checkAccessibleState();

      let viewIcon = new St.Icon({
        style_class: `popup-menu-icon exchange-icon ${this.exchange.toLowerCase()}`,
      });

      let viewBtn = new St.Button({
        child: viewIcon,
        style_class: 'btn m0',
      });
      viewBtn.connect('clicked', this._openChart.bind(this));
      this.add_child(viewBtn);

      this.nameLbl = new St.Label({
        text: this.title || this.symbol,
        style_class: 'itemLabel',
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this.nameLbl);

      this.amountEntry = new St.Entry({
        style_class: 'crypto-amount',
        can_focus: true,
        visible: false,
      });
      this.amountEntry.clutter_text.connect('activate', () => {
        const value = parseFloat(this.amountEntry.text);
        if (!isFinite(value) || value < 0) {
          this.amountEntry.text = String(this.amount ?? '');
          return;
        }
        this.amount = value;
        Settings.setCoinAmount(this.id, value);
        this.onChanged?.();
      });
      this.add_child(this.amountEntry);

      this.sparkline = new Sparkline();
      this.add_child(this.sparkline);

      let expander = new St.Bin({
        style_class: 'popup-menu-item-expander',
        x_expand: true,
      });
      this.add_child(expander);

      this.priceLbl = new St.Label({
        text: '...',
        style_class: 'itemLabel text-align-right',
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this.priceLbl);

      this._statusBtn = new St.Button({
        x_align: Clutter.ActorAlign.START,
        // x_expand: true,
        child: this._switch,
      });
      this._statusBtn.connect('clicked', this._toggle.bind(this));
      this.add_child(this._statusBtn);

      let icon = new St.Icon({
        icon_name: 'edit-delete-symbolic',
        style_class: 'popup-menu-icon',
      });
      let delBtn = new St.Button({
        child: icon,
        style_class: 'btn m0',
      });
      delBtn.connect('clicked', this._delCoin.bind(this));
      this.add_child(delBtn);

      if (this.activeCoin) this._activeCoin(true);

      this.connect('enter-event', () => {
        viewIcon.icon_name = 'external-link-symbolic';
        viewIcon.style_class = `popup-menu-icon w18`;
      });
      this.connect('leave-event', () => {
        viewIcon.icon_name = '';
        viewIcon.style_class = `popup-menu-icon exchange-icon ${this.exchange.toLowerCase()}`;
      });
    }
    _activeCoin(isInit) {
      this.activeCoin = true;
      if (!isInit) Settings.updateCoin(this._getJSON());
      this.onChanged?.();
    }
    _disableCoin() {
      this.activeCoin = false;
      Settings.updateCoin(this._getJSON());
      this.onChanged?.();
    }
    _getJSON() {
      return {
        id: this.id,
        symbol: this.symbol,
        active: this.activeCoin,
        title: this.title,
        exchange: this.exchange,
        coingecko_id: this.coingecko_id,
        amount: this.amount,
      };
    }
    onPricesUpdated(priceService, chartStyle) {
      if (this._destroyed) return;
      const price = priceService.getPrice(this.id);
      this.nameLbl.text = `${this.title || this.symbol}`;
      this.priceLbl.text = formatPrice(price);
      this.sparkline.setRendererId(chartStyle);
      this.sparkline.setSeries(priceService.getRing(this.id));
    }
    get state() {
      return this._switch.state;
    }
    setToggleState(state) {
      this._switch.state = state;
      this.checkAccessibleState();
    }

    setPortfolioView(on, currency) {
      const eligible = on && quoteOf(this) === currency;
      this.amountEntry.visible = eligible;
      this._statusBtn.visible = !on;
      // Runs every tick, so leave the entry alone while the user is typing.
      const editing = this.amountEntry.clutter_text?.has_key_focus?.();
      if (eligible && !editing) this.amountEntry.text = String(this.amount ?? 0);
    }

    activate(event) {
      if (this._switch.mapped) return;

      // we allow pressing space to toggle the switch
      // without closing the menu
      if (
        event.type() === Clutter.EventType.KEY_PRESS &&
        event.get_key_symbol() === Clutter.KEY_space
      )
        return;

      super.activate(event);
    }

    _toggle() {
      this._switch.toggle();
      this.toggleCoin();
      this.checkAccessibleState();
    }

    checkAccessibleState() {
      switch (this.accessible_role) {
        case Atk.Role.CHECK_MENU_ITEM:
          if (this._switch.state)
            this.add_accessible_state(Atk.StateType.CHECKED);
          else this.remove_accessible_state(Atk.StateType.CHECKED);
          break;
        default:
          this.remove_accessible_state(Atk.StateType.CHECKED);
      }
    }

    toggleCoin() {
      if (this.state) {
        this._activeCoin();
      } else {
        this._disableCoin();
      }
    }

    _delCoin() {
      Settings.delCoin({ id: this.id });

      let index = this.coins.findIndex((coin) => {
        return coin.id === this.id;
      });
      if (index !== -1) this.coins.splice(index, 1);

      this.destroy();
      this.panelMenu._buildCoinsSection();
    }

    _openChart() {
      const chartUrl = SourceClient.getChartUrl(this._getJSON());
      if (!chartUrl) return;
      Gio.AppInfo.launch_default_for_uri(chartUrl, null);
    }

    destroy() {
      this._destroyed = true;
      super.destroy();
    }
  },
);
