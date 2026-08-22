import { test, assertEqual, assertRejects } from './harness.js';
import { getChartUrl, fetchPrices } from '../api/sourceClient.js';

test('getChartUrl dispatches through the registry', () => {
  const url = getChartUrl({ symbol: 'BTC/USDT', exchange: 'Binance' });
  assertEqual(url, 'https://www.binance.com/en/trade/BTC_USDT');
});

test('getChartUrl on an unknown source returns null rather than throwing', () => {
  assertEqual(getChartUrl({ symbol: 'X/Y', exchange: 'Nope' }), null);
});

test('fetchPrices: a batch source request rejection propagates', async () => {
  const source = {
    id: 'fake-batch',
    supportsBatch: true,
    buildUrl: () => 'https://example.invalid/batch',
    parsePrices: () => new Map([['c1', 1]]),
  };
  const fetchFn = async () => { throw new Error('network down'); };
  const e = await assertRejects(
    async () => fetchPrices(source, [{ id: 'c1' }], fetchFn),
    'a rejected batch request must not resolve to prices'
  );
  assertEqual(e.message, 'network down');
});

test('fetchPrices: a non-batch source resolves the coins that succeed', async () => {
  const source = {
    id: 'fake-nonbatch',
    supportsBatch: false,
    buildUrl: coins => `https://example.invalid/${coins[0].id}`,
    parsePrices: (body, coins) => new Map([[coins[0].id, Number(body)]]),
  };
  const fetchFn = async url => {
    if (url.endsWith('/bad')) throw new Error('coin fetch failed');
    return { body: '42' };
  };
  const out = await fetchPrices(
    source,
    [{ id: 'good' }, { id: 'bad' }],
    fetchFn
  );
  assertEqual(out.get('good'), 42);
  assertEqual(out.has('bad'), false, 'the failed coin must be absent, not null/undefined');
});

test('fetchPrices: a non-batch source rejects when every coin fails', async () => {
  const source = {
    id: 'fake-nonbatch',
    supportsBatch: false,
    buildUrl: coins => `https://example.invalid/${coins[0].id}`,
    parsePrices: () => new Map(),
  };
  const fetchFn = async () => { throw new Error('coin fetch failed'); };
  await assertRejects(
    async () => fetchPrices(source, [{ id: 'a' }, { id: 'b' }], fetchFn),
    'an all-failed non-batch fetch must reject, not resolve to an empty Map'
  );
});
