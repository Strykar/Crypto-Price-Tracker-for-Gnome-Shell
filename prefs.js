import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { FIAT } from './lib/portfolio.js';
import { RENDERERS } from './lib/renderers/index.js';
import { SEPARATORS } from './lib/format.js';
import { fuzzySearch } from './lib/search.js';

const VIEWS = [['prices', 'Prices'], ['portfolio', 'Portfolio']];

const EXCHANGES = [
  { id: 'coingecko', label: 'CoinGecko (fiat)', quotes: [...FIAT].sort() },
  { id: 'binance', label: 'Binance', quotes: ['USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'EUR', 'TRY'] },
  { id: 'okx', label: 'OKX', quotes: ['USDT', 'USDC', 'BTC', 'ETH'] },
  { id: 'crypto', label: 'Crypto.com', quotes: ['USDT', 'USD', 'BTC', 'ETH'] },
];

const DECIMALS = [
  ['-1', 'Automatic'], ['0', '0'], ['1', '1'], ['2', '2'],
  ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8'],
];

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

    const view = new Adw.PreferencesGroup({
      title: 'Dropdown',
      description: 'What the menu shows when you click the panel',
    });
    view.add(comboRow('View', null, VIEWS, ...str('dropdown-view')));
    view.add(comboRow('Portfolio currency',
                      'Holdings quoted in anything else stay watch-only',
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
    num.add(comboRow('Decimal places',
                     'Automatic varies the count with the size of the number',
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
    window.add(this._pairsPage(s));
  }

  _pairsPage(s) {
    const page = new Adw.PreferencesPage({ title: 'Pairs', icon_name: 'list-add-symbolic' });
    const group = new Adw.PreferencesGroup({
      title: 'Add a pair',
      description: 'Search by ticker or name, choose where to price it, then add',
    });

    const search = new Adw.EntryRow({ title: 'Search' });
    group.add(search);

    const exchange = comboRow('Source', null, EXCHANGES.map(e => [e.id, e.label]),
                              () => s.get_string('exchange-filter'),
                              v => { s.set_string('exchange-filter', v); rebuildQuotes(); });
    group.add(exchange);

    const quote = new Adw.ComboRow({ title: 'Priced in', model: Gtk.StringList.new(['USD']) });
    group.add(quote);

    const results = new Adw.PreferencesGroup({ title: 'Matches' });
    page.add(group);
    page.add(results);

    let coins = [];
    try {
      const [, bytes] = GLib.file_get_contents(`${this.path}/assets/coingecko.json`);
      coins = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      group.set_description(`Could not read the bundled coin list: ${e.message}`);
    }

    const currentExchange = () => EXCHANGES.find(e => e.id === exchange_id()) ?? EXCHANGES[0];
    const exchange_id = () => s.get_string('exchange-filter');

    const rebuildQuotes = () => {
      const q = currentExchange().quotes;
      quote.model = Gtk.StringList.new(q);
      const want = s.get_string('base-currency');
      const at = q.indexOf(want);
      quote.selected = at >= 0 ? at : 0;
    };
    rebuildQuotes();

    let rows = [];
    const render = () => {
      for (const r of rows) results.remove(r);
      rows = [];
      const text = search.text.trim();
      if (!text) { results.set_description('Type to search 10,954 coins'); return; }
      const hits = fuzzySearch(text, coins, 12);
      results.set_description(hits.length ? null : `Nothing matches "${text}"`);
      for (const c of hits) {
        const row = new Adw.ActionRow({ title: c.name, subtitle: c.symbol.toUpperCase() });
        const btn = new Gtk.Button({ icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER,
                                     css_classes: ['flat'], tooltip_text: 'Add this pair' });
        btn.connect('clicked', () => {
          const ex = currentExchange();
          this._addPair(s, c, ex.quotes[quote.selected], ex.id);
          row.subtitle = `${c.symbol.toUpperCase()} — added`;
          btn.sensitive = false;
        });
        row.add_suffix(btn);
        results.add(row);
        rows.push(row);
      }
    };
    search.connect('changed', render);
    render();
    return page;
  }

  _addPair(s, coin, quoteCurrency, exchangeId) {
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
      amount: 0,
    });
    s.set_string('coins', JSON.stringify(blob));
  }
}
