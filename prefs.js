import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { FIAT } from './lib/portfolio.js';
import { RENDERERS } from './lib/renderers/index.js';

const VIEWS = [
  ['prices', 'Prices only'],
  ['both', 'Prices and portfolio'],
  ['portfolio', 'Portfolio only'],
];

function comboRow(title, subtitle, options, settings, key) {
  const ids = options.map(o => o[0]);
  const row = new Adw.ComboRow({
    title,
    subtitle,
    model: Gtk.StringList.new(options.map(o => o[1])),
  });
  const current = ids.indexOf(settings.get_string(key));
  row.selected = current >= 0 ? current : 0;
  row.connect('notify::selected', () => settings.set_string(key, ids[row.selected]));
  return row;
}

export default class CryptoPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage();

    const view = new Adw.PreferencesGroup({
      title: 'Dropdown',
      description: 'What the menu shows when you click the panel',
    });
    view.add(comboRow('View', 'Portfolio needs pairs quoted in a real currency, such as BTC/USD',
                      VIEWS, settings, 'dropdown-view'));

    const currencies = [['', 'Not set']].concat([...FIAT].sort().map(c => [c, c]));
    view.add(comboRow('Portfolio currency', 'Holdings quoted in anything else stay watch-only',
                      currencies, settings, 'base-currency'));
    page.add(view);

    const chart = new Adw.PreferencesGroup({ title: 'Charts' });
    chart.add(comboRow('Sparkline style', null,
                       RENDERERS.map(r => [r.id, r.label]), settings, 'chart-style'));
    page.add(chart);

    const updates = new Adw.PreferencesGroup({
      title: 'Updates',
      description: 'Each source also applies its own minimum, so a slow API is not polled faster than it allows',
    });
    const interval = new Adw.SpinRow({
      title: 'Refresh interval',
      subtitle: 'Seconds between price updates',
      adjustment: new Gtk.Adjustment({ lower: 5, upper: 600, step_increment: 5, page_increment: 30 }),
    });
    interval.value = settings.get_int('refresh-interval');
    settings.bind('refresh-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
    updates.add(interval);
    page.add(updates);

    window.add(page);
  }
}
