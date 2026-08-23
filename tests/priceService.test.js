import { test, assertEqual } from './harness.js';
import { groupBySource, pushHistory, dueSources, coinsToFetch, nextBackoff } from '../lib/priceService.js';

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
  // binance minPollInterval 5, coingecko 30
  const last = new Map([['binance', 1000], ['coingecko', 1000]]);
  const due = dueSources(['binance', 'coingecko'], last, 1010 /* now, seconds */);
  assertEqual(due, ['binance'], 'coingecko is not due for another 20s');
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

test('nextBackoff doubles from a minute and stops at fifteen', () => {
  assertEqual(nextBackoff(0), 60);
  assertEqual(nextBackoff(60), 120);
  assertEqual(nextBackoff(120), 240);
  assertEqual(nextBackoff(480), 900);
  assertEqual(nextBackoff(900), 900, 'must not grow without limit');
});

test('a source in backoff is not due, however long since its last fetch', () => {
  const last = new Map([['binance', 0]]);
  const backoff = new Map([['binance', 500]]);
  assertEqual(dueSources(['binance'], last, 400, backoff), []);
  assertEqual(dueSources(['binance'], last, 501, backoff), ['binance'],
    'and is due again once the penalty expires');
});

test('backoff only holds back the source that was throttled', () => {
  const last = new Map();
  const backoff = new Map([['coingecko', 500]]);
  assertEqual(dueSources(['binance', 'coingecko'], last, 100, backoff), ['binance']);
});
