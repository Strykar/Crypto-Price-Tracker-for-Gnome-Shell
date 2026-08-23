import { test, assertEqual } from './harness.js';
import { groupBySource, pushHistory, dueSources, coinsToFetch } from '../lib/priceService.js';

test('groupBySource buckets coins by their source id', () => {
  const g = groupBySource([
    { id: 'a', exchange: 'binance' },
    { id: 'b', exchange: 'coingecko' },
    { id: 'c', exchange: 'binance' },
  ]);
  assertEqual([...g.keys()].sort(), ['binance', 'coingecko']);
  assertEqual(g.get('binance').length, 2);
});

test('groupBySource skips coins with an unknown source', () => {
  const g = groupBySource([{ id: 'a', exchange: 'nope' }]);
  assertEqual(g.size, 0);
});

test('pushHistory appends and caps at the limit', () => {
  let ring = [];
  for (let i = 0; i < 5; i++) ring = pushHistory(ring, i, 3);
  assertEqual(ring, [2, 3, 4], 'oldest points drop off the front');
});

test('pushHistory ignores a non-finite price', () => {
  assertEqual(pushHistory([1, 2], NaN, 5), [1, 2]);
  assertEqual(pushHistory([1, 2], undefined, 5), [1, 2]);
});

test('dueSources respects each source minPollInterval', () => {
  // binance minPollInterval 5, coingecko 15
  const last = new Map([['binance', 1000], ['coingecko', 1000]]);
  const due = dueSources(['binance', 'coingecko'], last, 1010 /* now, seconds */);
  assertEqual(due, ['binance'], 'coingecko is not due for another 5s');
});

test('dueSources returns a source never fetched before', () => {
  assertEqual(dueSources(['binance'], new Map(), 0), ['binance']);
});

test('coinsToFetch: an active coin is fetched', () => {
  assertEqual(coinsToFetch([{ id: 'a', active: true }]).map(c => c.id), ['a']);
});

test('coinsToFetch: a HELD but panel-hidden coin is still fetched', () => {
  assertEqual(coinsToFetch([{ id: 'a', active: false, amount: 2 }]).map(c => c.id), ['a']);
});

test('coinsToFetch: a hidden coin with no holding is not fetched', () => {
  assertEqual(coinsToFetch([{ id: 'a', active: false }]), []);
  assertEqual(coinsToFetch([{ id: 'a', active: false, amount: 0 }]), []);
});
