import { test, assertEqual } from './harness.js';
import { migrateCoins } from '../lib/migrate.js';

test('migrate: rewrites a legacy label to a source id', () => {
  const { coins, changed } = migrateCoins([
    { id: 'a', symbol: 'BTC/USDT', exchange: 'Binance', active: true },
  ]);
  assertEqual(coins[0].exchange, 'binance');
  assertEqual(changed, true);
});

test('migrate: leaves an already-migrated coin alone', () => {
  const { coins, changed } = migrateCoins([
    { id: 'a', symbol: 'BTC/USDT', exchange: 'binance', active: true },
  ]);
  assertEqual(coins[0].exchange, 'binance');
  assertEqual(changed, false);
});

test('migrate: keeps a coin whose source is unknown rather than dropping it', () => {
  const { coins } = migrateCoins([
    { id: 'a', symbol: 'X/Y', exchange: 'Nope', active: true },
  ]);
  assertEqual(coins.length, 1, 'a user must never lose a pair');
  assertEqual(coins[0].exchange, 'Nope');
});

test('migrate: preserves every other field', () => {
  const { coins } = migrateCoins([
    { id: 'a', symbol: 'BTC/USD', exchange: 'Coingecko', active: false,
      title: 'Bitcoin', coingecko_id: 'bitcoin' },
  ]);
  assertEqual(coins[0].title, 'Bitcoin');
  assertEqual(coins[0].coingecko_id, 'bitcoin');
  assertEqual(coins[0].active, false);
  assertEqual(coins[0].exchange, 'coingecko');
});
