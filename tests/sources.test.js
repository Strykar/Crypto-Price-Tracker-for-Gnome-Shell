import { test, assertEqual, assertRejects } from './harness.js';
import { SOURCES, getSource } from '../api/sources/index.js';

for (const src of SOURCES) {
  test(`${src.id}: has the required contract fields`, () => {
    assertEqual(typeof src.id, 'string');
    assertEqual(typeof src.label, 'string');
    assertEqual(typeof src.assetClass, 'string');
    assertEqual(typeof src.minPollInterval, 'number');
    assertEqual(typeof src.supportsBatch, 'boolean');
    assertEqual(typeof src.parseSymbol, 'function');
    assertEqual(typeof src.parsePrices, 'function');
    assertEqual(typeof src.buildUrl, 'function');
    assertEqual(typeof src.chartUrl, 'function');
  });

  test(`${src.id}: parseSymbol splits a pair`, () => {
    const { base, quote } = src.parseSymbol({ symbol: 'BTC/USDT', coingecko_id: 'bitcoin' });
    assertEqual(typeof base, 'string');
    assertEqual(typeof quote, 'string');
  });

  test(`${src.id}: chartUrl returns an https url`, () => {
    const url = src.chartUrl({ symbol: 'BTC/USDT', coingecko_id: 'bitcoin' });
    assertEqual(url.startsWith('https://'), true, `got ${url}`);
  });

  test(`${src.id}: parsePrices rejects a malformed body`, async () => {
    await assertRejects(async () => src.parsePrices('not json at all', []));
  });

  test(`${src.id}: declares a sample for the conformance suite`, () => {
    const hint = `${src.id}: add a sample {coins, response, error} to the source module -- run ./tests/capture-sample.js ${src.id} to generate one`;
    assertEqual(Array.isArray(src.sample?.coins), true, hint);
    assertEqual(typeof src.sample?.response, 'string', hint);
  });

  test(`${src.id}: declares an error sample for the conformance suite`, () => {
    assertEqual(typeof src.sample?.error, 'string',
      `${src.id}: add a sample {coins, response, error} to the source module -- run ./tests/capture-sample.js ${src.id} to generate one`);
  });

  test(`${src.id}: parsePrices maps a real response to finite Numbers`, () => {
    const sample = src.sample;
    if (!sample) return;   // the case above already failed; do not double-report
    const out = src.parsePrices(sample.response, sample.coins);
    assertEqual(out instanceof Map, true, 'must return a Map');
    assertEqual(out.size > 0, true, 'must resolve at least one coin');
    for (const [coinId, value] of out) {
      assertEqual(sample.coins.some(c => c.id === coinId), true,
        `key ${coinId} is not one of the coins passed in`);
      assertEqual(typeof value, 'number', `${coinId} must be a Number, not a string`);
      assertEqual(isFinite(value), true, `${coinId} must be finite`);
    }
  });

  test(`${src.id}: parsePrices throws on a well-formed error envelope`, async () => {
    const sample = src.sample;
    if (!sample?.error) return;   // the case above already failed; do not double-report
    await assertRejects(async () => src.parsePrices(sample.error, sample.coins),
      `${src.id} must throw on an error envelope, not resolve an empty Map`);
  });
}

test('registry: getSource finds by id', () => {
  assertEqual(getSource('binance').id, 'binance');
});

test('registry: getSource finds by legacy label', () => {
  assertEqual(getSource('Binance').id, 'binance');
});

test('binance: parsePrices returns finite Numbers keyed by coin id', () => {
  const { sample } = getSource('binance');
  const out = getSource('binance').parsePrices(sample.response, sample.coins);
  assertEqual(out instanceof Map, true);
  assertEqual(out.size, 2);
  for (const [, v] of out) {
    assertEqual(typeof v, 'number', 'price must be a Number, not a string');
    assertEqual(isFinite(v), true);
  }
});

test('coingecko: parsePrices uses coingecko_id, not the symbol', () => {
  const { sample } = getSource('coingecko');
  const out = getSource('coingecko').parsePrices(sample.response, sample.coins);
  assertEqual(out.size, 2);
  assertEqual(typeof out.get('c1'), 'number');
});

test('coingecko: buildUrl batches all ids into one request', () => {
  const url = getSource('coingecko').buildUrl([
    { id: 'c1', symbol: 'BTC/USD', coingecko_id: 'bitcoin' },
    { id: 'c2', symbol: 'ETH/USD', coingecko_id: 'ethereum' },
  ]);
  assertEqual(url.includes('ids=bitcoin,ethereum'), true, url);
});

test('okx: parsePrices returns a Number', () => {
  const { sample } = getSource('okx');
  const out = getSource('okx').parsePrices(sample.response, sample.coins);
  assertEqual(typeof out.get('c1'), 'number');
});

test('crypto: parsePrices returns a Number', () => {
  const { sample } = getSource('crypto');
  const out = getSource('crypto').parsePrices(sample.response, sample.coins);
  assertEqual(typeof out.get('c1'), 'number');
});

test('okx and crypto do not claim batch support', () => {
  assertEqual(getSource('okx').supportsBatch, false);
  assertEqual(getSource('crypto').supportsBatch, false);
});
