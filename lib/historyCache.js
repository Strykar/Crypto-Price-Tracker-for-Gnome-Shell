import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

// Cached so a quick restart is not rate-limited into blank charts.
export const MAX_AGE_SECONDS = 300;

function cachePath() {
  return GLib.build_filenamev([GLib.get_user_cache_dir(), 'crypto-tracker', 'history.json']);
}

export function keyFor(coin) {
  return `${coin.exchange}:${coin.symbol}`;
}

export function load(path = cachePath(), maxAge = MAX_AGE_SECONDS, now = null) {
  try {
    const file = Gio.File.new_for_path(path);
    const info = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
    const age = (now ?? GLib.DateTime.new_now_utc().to_unix()) -
                info.get_modification_date_time().to_unix();
    if (age > maxAge) return new Map();

    const [, bytes] = file.load_contents(null);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return new Map(Object.entries(json));
  } catch (e) {
    return new Map();
  }
}

export function save(entries, path = cachePath()) {
  try {
    const dir = Gio.File.new_for_path(path).get_parent();
    if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
    const obj = {};
    for (const [k, v] of entries) obj[k] = v;
    Gio.File.new_for_path(path).replace_contents(
      new TextEncoder().encode(JSON.stringify(obj)),
      null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    return true;
  } catch (e) {
    return false;
  }
}
