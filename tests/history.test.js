import { test, assertEqual } from './harness.js';
import { sortedCloses } from '../lib/history.js';
import { getSource, SOURCES } from '../api/sources/index.js';

test('sortedCloses orders by timestamp regardless of input order', () => {
  assertEqual(sortedCloses([[3, 30], [1, 10], [2, 20]]), [10, 20, 30]);
});

test('sortedCloses drops non-finite rows', () => {
  assertEqual(sortedCloses([[1, 10], [2, NaN], [3, 30]]), [10, 30]);
});

test('sortedCloses caps to the most recent points', () => {
  const many = Array.from({ length: 60 }, (_, i) => [i, i]);
  const out = sortedCloses(many, 48);
  assertEqual(out.length, 48);
  assertEqual(out[out.length - 1], 59, 'must keep the newest, not the oldest');
});

test('okx: parseHistory returns oldest-first despite newest-first input', () => {
  const body = JSON.stringify({ code: '0', data: [
    ['3000', '1', '1', '1', '30'], ['2000', '1', '1', '1', '20'], ['1000', '1', '1', '1', '10'],
  ]});
  assertEqual(getSource('okx').parseHistory(body), [10, 20, 30]);
});

test('binance: parseHistory reads the close column', () => {
  const body = JSON.stringify([[1000, '1', '2', '0', '11'], [2000, '1', '2', '0', '22']]);
  assertEqual(getSource('binance').parseHistory(body), [11, 22]);
});

test('coingecko: parseHistory reads the prices array', () => {
  assertEqual(getSource('coingecko').parseHistory('{"prices":[[1000,10],[2000,20]]}'), [10, 20]);
});

test('crypto: parseHistory reads result.data close', () => {
  const body = JSON.stringify({ result: { data: [{ t: 2000, c: '20' }, { t: 1000, c: '10' }] } });
  assertEqual(getSource('crypto').parseHistory(body), [10, 20]);
});

test('every source that offers historyUrl also offers parseHistory', () => {
  for (const s of SOURCES)
    assertEqual(typeof s.historyUrl === 'function' && typeof s.parseHistory === 'function', true, s.id);
});
