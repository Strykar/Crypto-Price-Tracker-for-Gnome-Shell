import { test, assertEqual, assertRejects } from './harness.js';
import { getChartUrl, fetchPrices, fetchHistory } from '../api/sourceClient.js';

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

const HIST = { id: 'fake-hist',
  historyUrl: c => `https://example.invalid/h/${c.id}`,
  parseHistory: body => JSON.parse(body),
  flowUrl: c => `https://example.invalid/f/${c.id}`,
  parseFlow: body => JSON.parse(body),
};

test('fetchHistory: flow comes from flowUrl, not from a second read of the klines', async () => {
  const asked = [];
  const fetchFn = async url => {
    asked.push(url);
    return { body: url.includes('/f/') ? '[[7,3]]' : '[1,2,3]' };
  };
  const out = await fetchHistory(HIST, [{ id: 'c1' }], fetchFn);
  assertEqual(asked.sort(), ['https://example.invalid/f/c1', 'https://example.invalid/h/c1']);
  assertEqual(out.get('c1').prices, [1, 2, 3]);
  assertEqual(out.get('c1').flow, [[7, 3]]);
});

test('fetchHistory: a failed flow request still yields the price line', async () => {
  const fetchFn = async url => {
    if (url.includes('/f/')) throw new Error('429');
    return { body: '[1,2,3]' };
  };
  const out = await fetchHistory(HIST, [{ id: 'c1' }], fetchFn);
  assertEqual(out.get('c1').prices, [1, 2, 3]);
  assertEqual(out.get('c1').flow, null);
});

test('fetchHistory: a source with no flow support reports none', async () => {
  const noFlow = { ...HIST, flowUrl: undefined, parseFlow: undefined };
  const out = await fetchHistory(noFlow, [{ id: 'c1' }], async () => ({ body: '[1,2]' }));
  assertEqual(out.get('c1').flow, null);
});
