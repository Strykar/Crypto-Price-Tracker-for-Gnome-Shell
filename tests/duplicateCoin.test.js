import { test, assertEqual } from './harness.js';
import { isDuplicateCoin } from '../lib/duplicateCoin.js';

test('isDuplicateCoin: a legacy label matches a stored source id', () => {
  const coins = [{ symbol: 'BTC/USDT', exchange: 'binance' }];
  const coin = { symbol: 'btc/usdt', exchange: 'Binance' };
  assertEqual(isDuplicateCoin(coin, coins), true);
});

test('isDuplicateCoin: same symbol, different exchange is not a duplicate', () => {
  const coins = [{ symbol: 'BTC/USDT', exchange: 'binance' }];
  const coin = { symbol: 'BTC/USDT', exchange: 'okx' };
  assertEqual(isDuplicateCoin(coin, coins), false);
});

test('isDuplicateCoin: different symbol, same exchange is not a duplicate', () => {
  const coins = [{ symbol: 'BTC/USDT', exchange: 'binance' }];
  const coin = { symbol: 'ETH/USDT', exchange: 'Binance' };
  assertEqual(isDuplicateCoin(coin, coins), false);
});

test('isDuplicateCoin: an empty coin list has no duplicates', () => {
  assertEqual(isDuplicateCoin({ symbol: 'BTC/USDT', exchange: 'Binance' }, []), false);
});
