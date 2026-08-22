import { test, assertEqual, assertClose } from './harness.js';
import { isFiat, availableCurrencies, heldIn, total, totalSeries } from '../lib/portfolio.js';

const COINS = [
  { id: 'a', symbol: 'BTC/USD', exchange: 'coingecko', amount: 0.12, coingecko_id: 'bitcoin' },
  { id: 'b', symbol: 'ETH/USD', exchange: 'coingecko', amount: 1.5, coingecko_id: 'ethereum' },
  { id: 'c', symbol: 'SOL/CAD', exchange: 'coingecko', amount: 4.75, coingecko_id: 'solana' },
  { id: 'd', symbol: 'XRP/USD', exchange: 'coingecko', amount: 0, coingecko_id: 'ripple' },
  { id: 'e', symbol: 'BTC/USDT', exchange: 'binance', amount: 2 },
];

const FAKE = {
  _p: { a: 77000, b: 2800, c: 130, d: 0.5, e: 77000 },
  _r: { a: [76000, 76500, 77000], b: [2700, 2750, 2800, 2810], c: [128, 130] },
  getPrice(id) { return this._p[id]; },
  getRing(id) { return this._r[id] ?? []; },
};

test('isFiat accepts real currencies and rejects stablecoins', () => {
  assertEqual(isFiat('USD'), true);
  assertEqual(isFiat('inr'), true);
  assertEqual(isFiat('CAD'), true);
  assertEqual(isFiat('USDT'), false, 'a stablecoin is not fiat');
  assertEqual(isFiat('USDC'), false);
  assertEqual(isFiat('BTC'), false);
});

test('availableCurrencies lists only fiat quotes actually present', () => {
  assertEqual(availableCurrencies(COINS).sort(), ['CAD', 'USD']);
});

test('heldIn selects coins with an amount quoted in the currency', () => {
  assertEqual(heldIn(COINS, 'USD').map(c => c.id), ['a', 'b']);
});

test('heldIn excludes a zero amount', () => {
  assertEqual(heldIn(COINS, 'USD').some(c => c.id === 'd'), false);
});

test('heldIn never includes a non-fiat quote', () => {
  assertEqual(heldIn(COINS, 'USDT').length, 0);
});

test('total is the plain sum of amount times price', () => {
  // 0.12*77000 + 1.5*2800 = 9240 + 4200
  assertClose(total(COINS, 'USD', FAKE), 13440, 1e-6);
});

test('total is zero when nothing is held in the currency', () => {
  assertEqual(total(COINS, 'GBP', FAKE), 0);
});

test('totalSeries aligns on the shortest ring, indexed from newest', () => {
  // a: [76000,76500,77000] (len 3), b: [2700,2750,2800,2810] (len 4)
  // n = 3. newest-first: i=0 -> 0.12*77000 + 1.5*2810 = 9240 + 4215 = 13455
  //                      i=1 -> 0.12*76500 + 1.5*2800 = 9180 + 4200 = 13380
  //                      i=2 -> 0.12*76000 + 1.5*2750 = 9120 + 4125 = 13245
  // returned oldest-first for drawing
  const s = totalSeries(COINS, 'USD', FAKE);
  assertEqual(s.length, 3);
  assertClose(s[2], 13455, 1e-6, 'newest');
  assertClose(s[0], 13245, 1e-6, 'oldest');
});

test('totalSeries is empty when nothing is held', () => {
  assertEqual(totalSeries(COINS, 'GBP', FAKE), []);
});
