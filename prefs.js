import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { FIAT } from './lib/portfolio.js';
import { RENDERERS } from './lib/renderers/index.js';
import { SEPARATORS, PANEL_SEPARATORS } from './lib/format.js';
import { fuzzySearch, FIELDS } from './lib/search.js';
import { moveCoin } from './lib/reorder.js';
import { getSource } from './api/sources/index.js';

const VIEWS = [['prices', 'Prices'], ['portfolio', 'Portfolio']];

const EXCHANGES = [
  { id: 'coingecko', label: 'CoinGecko (fiat)', quotes: [...FIAT].sort() },
  { id: 'binance', label: 'Binance', quotes: ['USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'EUR', 'TRY'] },
  { id: 'okx', label: 'OKX', quotes: ['USDT', 'USDC', 'BTC', 'ETH'] },
  { id: 'crypto', label: 'Crypto.com', quotes: ['USDT', 'USD', 'BTC', 'ETH'] },
].map(e => ({ ...e, example: getSource(e.id)?.example ?? '' }));

const DECIMALS = [
  ['-1', 'Automatic'], ['0', '0'], ['1', '1'], ['2', '2'],
  ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8'],
];

const SEP = String.fromCharCode(31);   // unit separator, cannot occur in a label

function sourceComboRow(title, options, get, set) {
  const ids = options.map(o => o.id);
  const model = Gtk.StringList.new(options.map(o => o.label + SEP + o.example));

  const factory = () => {
    const f = new Gtk.SignalListItemFactory();
    f.connect('setup', (_, item) => {
      const box = new Gtk.Box({ spacing: 12 });
      box.append(new Gtk.Label({ xalign: 0, hexpand: true }));
      box.append(new Gtk.Label({ xalign: 1, css_classes: ['dim-label', 'monospace'] }));
      item.child = box;
    });
    f.connect('bind', (_, item) => {
      const [name, example] = item.item.string.split(SEP);
      item.child.get_first_child().label = name;
      item.child.get_last_child().label = example;
    });
    return f;
  };

  const row = new Adw.ComboRow({ title, model, factory: factory(), list_factory: factory() });
  const at = ids.indexOf(get());
  row.selected = at >= 0 ? at : 0;
  row.connect('notify::selected', () => set(ids[row.selected]));
  return row;
}

function comboRow(title, subtitle, options, get, set) {
  const ids = options.map(o => o[0]);
  const row = new Adw.ComboRow({
    title, subtitle,
    model: Gtk.StringList.new(options.map(o => o[1])),
  });
  const at = ids.indexOf(get());
  row.selected = at >= 0 ? at : 0;
  row.connect('notify::selected', () => set(ids[row.selected]));
  return row;
}

export default class CryptoPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const s = this.getSettings();
    const page = new Adw.PreferencesPage();
    const str = k => [() => s.get_string(k), v => s.set_string(k, v)];

    const { search: searchGroup, matches, details } = this._addPairGroups(s);
    page.add(searchGroup);
    page.add(matches);
    page.add(details);
    page.add(this._yourPairsGroup(s));

    const view = new Adw.PreferencesGroup({
      title: 'Dropdown',
      description: 'What the menu shows when you click the panel',
    });
    view.add(comboRow('View', null, VIEWS, ...str('dropdown-view')));
    view.add(comboRow('Portfolio currency',
                      'Holdings quoted in anything else stay price-watch only',
                      [['', 'Not set']].concat([...FIAT].sort().map(c => [c, c])),
                      ...str('base-currency')));
    page.add(view);

    const chart = new Adw.PreferencesGroup({
      title: 'Charts',
      description: 'Buy/sell pressure needs order flow, which only Binance reports; ' +
                   'other sources fall back to the price line',
    });
    chart.add(comboRow('Sparkline', null, RENDERERS.map(r => [r.id, r.label]),
                       ...str('chart-style')));
    page.add(chart);

    const num = new Adw.PreferencesGroup({ title: 'Numbers' });
    num.add(comboRow('Separators', null,
                     Object.entries(SEPARATORS).map(([k, v]) => [k, v.label]),
                     ...str('number-separator')));
    num.add(comboRow('Panel separator',
                     'Shown between coins in the top bar',
                     Object.entries(PANEL_SEPARATORS).map(([k, v]) => [k, v.label]),
                     ...str('panel-separator')));
    num.add(comboRow('Decimal places',
                     'Automatic varies the count with the size of the number sent by that API',
                     DECIMALS,
                     () => String(s.get_int('decimal-places')),
                     v => s.set_int('decimal-places', parseInt(v, 10))));
    page.add(num);

    const updates = new Adw.PreferencesGroup({
      title: 'Updates',
      description: 'Each source also applies its own minimum, so a slow API is ' +
                   'never polled faster than it allows',
    });
    const interval = new Adw.SpinRow({
      title: 'Refresh interval',
      subtitle: 'Seconds between price updates',
      adjustment: new Gtk.Adjustment({ lower: 5, upper: 600, step_increment: 5, page_increment: 30 }),
    });
    s.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
    updates.add(interval);
    page.add(updates);

    window.add(page);
  }

  _addPairGroups(s) {
    const group = new Adw.PreferencesGroup({
      title: 'Add a pair',
      description: 'Search by ticker or name, choose where to price it, then add',
    });
    const results = new Adw.PreferencesGroup();
    const details = new Adw.PreferencesGroup({
      title: 'How to add it',
      description: 'Applied to whichever match you add above',
    });

    const search = new Adw.EntryRow({ title: 'Search' });
    group.add(search);

    const exchange = sourceComboRow('Source', EXCHANGES,
                                    () => s.get_string('exchange-filter'),
                                    v => { s.set_string('exchange-filter', v); rebuildQuotes(); });
    details.add(exchange);

    const field = comboRow('Search in', null,
                           Object.entries(FIELDS).map(([k, v]) => [k, v.label]),
                           () => s.get_string('search-field'),
                           v => { s.set_string('search-field', v); render(); });
    details.add(field);

    const quote = new Adw.ComboRow({ title: 'Priced in', model: Gtk.StringList.new(['USD']) });
    details.add(quote);

    const amount = new Adw.EntryRow({ title: 'Amount you hold', text: '' });
    details.add(amount);

    const hint = new Gtk.Label({
      wrap: true, xalign: 0, css_classes: ['dim-label', 'caption'],
      margin_top: 4, margin_bottom: 4,
    });
    details.add(hint);

    let coins = [];
    try {
      const [, bytes] = GLib.file_get_contents(`${this.path}/assets/coingecko.json`);
      coins = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      group.set_description(`Could not read the bundled coin list: ${e.message}`);
    }

    const current = () => EXCHANGES.find(e => e.id === s.get_string('exchange-filter')) ?? EXCHANGES[0];
    const rebuildQuotes = () => {
      const ex = current();
      quote.model = Gtk.StringList.new(ex.quotes);
      const want = s.get_string('base-currency');
      const at = ex.quotes.indexOf(want);
      quote.selected = at >= 0 ? at : 0;
      hint.label = `${ex.label} prices pairs like ${ex.example}. ` +
        'Leave the amount blank to just watch it.';
    };
    rebuildQuotes();

    let rows = [];
    const render = () => {
      for (const r of rows) results.remove(r);
      rows = [];
      const text = search.text.trim();
      if (!text) return;
      for (const c of fuzzySearch(text, coins, 8, s.get_string('search-field'))) {
        const row = new Adw.ActionRow({ title: c.name, subtitle: c.symbol.toUpperCase() });
        const btn = new Gtk.Button({ icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER,
                                     css_classes: ['flat'], tooltip_text: 'Add this pair' });
        btn.connect('clicked', () => {
          const ex = current();
          this._addPair(s, c, ex.quotes[quote.selected], ex.id,
                        amount.text.trim());
          row.subtitle = `${c.symbol.toUpperCase()} — added`;
          btn.sensitive = false;
          amount.text = '';
        });
        row.add_suffix(btn);
        results.add(row);
        rows.push(row);
      }
    };
    search.connect('changed', render);
    return { search: group, matches: results, details };
  }

  _yourPairsGroup(s) {
    const group = new Adw.PreferencesGroup({
      title: 'Your pairs',
      description: 'Drag by the handle to reorder; this is the order they appear in the top bar',
    });
    const rebuild = () => {
      for (const r of group._rows ?? []) group.remove(r);
      group._rows = [];
      const blob = JSON.parse(s.get_string('coins'));
      if (!blob.coins.length) {
        group.set_description('None yet. Add one above.');
        return;
      }
      group.set_description(null);
      blob.coins.forEach(coin => {
        const row = new Adw.ExpanderRow({
          title: coin.symbol,
          subtitle: EXCHANGES.find(e => e.id === coin.exchange)?.label ?? coin.exchange,
        });

        const amount = new Adw.EntryRow({
          title: 'Amount held',
          text: coin.amount ? String(coin.amount) : '',
        });
        const save = (row, key, allowBlank = true) => () => {
          const raw = row.text.trim();
          const blob2 = JSON.parse(s.get_string('coins'));
          const target = blob2.coins.find(c => c.id === coin.id);
          if (!target) return;
          if (raw === '') target[key] = allowBlank ? null : 0;
          else {
            const v = parseFloat(raw);
            if (!isFinite(v) || v < 0) { row.add_css_class('error'); return; }
            target[key] = v;
          }
          row.remove_css_class('error');
          s.set_string('coins', JSON.stringify(blob2));
        };
        amount.connect('apply', save(amount, 'amount'));
        amount.show_apply_button = true;
        row.add_row(amount);

        const quote = (coin.symbol.split('/')[1] ?? '').toUpperCase();
        const currency = s.get_string('base-currency');
        const eligible = !!currency && quote === currency;

        const check = new Gtk.CheckButton({
          valign: Gtk.Align.CENTER,
          active: eligible && coin.inPortfolio !== false,
          sensitive: eligible,
          tooltip_text: eligible
            ? 'Include this pair in the portfolio'
            : (currency
                ? `Priced in ${quote}, and the portfolio totals in ${currency}`
                : 'Set a portfolio currency first'),
        });
        check.connect('toggled', () => {
          const blob2 = JSON.parse(s.get_string('coins'));
          const target = blob2.coins.find(c => c.id === coin.id);
          if (!target) return;
          target.inPortfolio = check.active;
          s.set_string('coins', JSON.stringify(blob2));
        });
        row.add_prefix(check);

        const handle = new Gtk.Image({
          icon_name: 'list-drag-handle-symbolic',
          valign: Gtk.Align.CENTER,
          css_classes: ['dim-label'],
          tooltip_text: 'Drag to reorder',
        });

        const drag = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE });
        drag.connect('prepare', () =>
          Gdk.ContentProvider.new_for_value(coin.id));
        drag.connect('drag-begin', () => {
          const paintable = new Gtk.WidgetPaintable({ widget: row });
          drag.set_icon(paintable, 0, 0);
          row.add_css_class('dim-label');
        });
        drag.connect('drag-end', () => row.remove_css_class('dim-label'));
        handle.add_controller(drag);
        row.add_prefix(handle);

        const drop = new Gtk.DropTarget({
          actions: Gdk.DragAction.MOVE,
          formats: Gdk.ContentFormats.new_for_gtype(GObject.TYPE_STRING),
        });
        drop.connect('drop', (_, value) => {
          const blob2 = JSON.parse(s.get_string('coins'));
          const next = moveCoin(blob2.coins, String(value), coin.id);
          if (next === blob2.coins) return false;
          blob2.coins = next;
          s.set_string('coins', JSON.stringify(blob2));
          rebuild();
          return true;
        });
        row.add_controller(drop);

        const del = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER,
                                     css_classes: ['flat'], tooltip_text: 'Remove this pair' });
        del.connect('clicked', () => {
          const blob2 = JSON.parse(s.get_string('coins'));
          blob2.coins = blob2.coins.filter(c => c.id !== coin.id);
          s.set_string('coins', JSON.stringify(blob2));
          rebuild();
        });
        row.add_suffix(del);

        group.add(row);
        group._rows.push(row);
      });
    };
    rebuild();
    s.connect('changed::coins', rebuild);
    return group;
  }

  _addPair(s, coin, quoteCurrency, exchangeId, amountText = '') {
    const blob = JSON.parse(s.get_string('coins'));
    const symbol = `${coin.symbol.toUpperCase()}/${quoteCurrency}`;
    if (blob.coins.some(c => c.symbol === symbol && c.exchange === exchangeId)) return;
    blob.coins.push({
      id: GLib.uuid_string_random(),
      symbol,
      active: false,
      title: coin.symbol.toUpperCase(),
      exchange: exchangeId,
      coingecko_id: coin.id,
      amount: parseFloat(amountText) > 0 ? parseFloat(amountText) : 0,
    });
    s.set_string('coins', JSON.stringify(blob));
  }
}
