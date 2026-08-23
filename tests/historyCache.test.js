import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { test, assertEqual } from './harness.js';
import { load, save, keyFor, MAX_AGE_SECONDS } from '../lib/historyCache.js';

const tmp = () => GLib.build_filenamev([GLib.dir_make_tmp('cchXXXXXX'), 'history.json']);

test('keyFor identifies a pair by exchange and symbol, not by id', () => {
  assertEqual(keyFor({ exchange: 'coingecko', symbol: 'BTC/USD', id: 'x' }), 'coingecko:BTC/USD');
});

test('save then load round-trips', () => {
  const p = tmp();
  const data = new Map([['coingecko:BTC/USD', { prices: [1, 2, 3], flow: [50, 60] }]]);
  assertEqual(save(data, p), true);
  const back = load(p);
  assertEqual(back.get('coingecko:BTC/USD').prices, [1, 2, 3]);
  assertEqual(back.get('coingecko:BTC/USD').flow, [50, 60]);
});

test('the limit is five minutes', () => {
  assertEqual(MAX_AGE_SECONDS, 300);
});

test('a cache just inside the limit is used', () => {
  const p = tmp();
  save(new Map([['a', { prices: [1, 2] }]]), p);
  const almost = GLib.DateTime.new_now_utc().to_unix() + MAX_AGE_SECONDS - 5;
  assertEqual(load(p, MAX_AGE_SECONDS, almost).size, 1);
});

test('a cache older than the limit is ignored', () => {
  const p = tmp();
  save(new Map([['a', { prices: [1] }]]), p);
  const future = GLib.DateTime.new_now_utc().to_unix() + MAX_AGE_SECONDS + 60;
  assertEqual(load(p, MAX_AGE_SECONDS, future).size, 0, 'stale cache must not be used');
});

test('a missing cache is empty, not an error', () => {
  assertEqual(load('/nonexistent/nope.json').size, 0);
});

test('a corrupt cache is empty, not an error', () => {
  const p = tmp();
  Gio.File.new_for_path(p).replace_contents(
    new TextEncoder().encode('{ this is not json'), null, false,
    Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  assertEqual(load(p).size, 0, 'a corrupt cache must never stop the extension loading');
});

test('save to an unwritable path reports failure rather than throwing', () => {
  assertEqual(save(new Map([['a', {}]]), '/proc/nope/history.json'), false);
});
