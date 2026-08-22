import { getSource } from '../api/sources/index.js';

export function migrateCoins(coins) {
  let changed = false;
  const out = coins.map(coin => {
    const source = getSource(coin.exchange);
    if (!source || coin.exchange === source.id) return coin;
    changed = true;
    return { ...coin, exchange: source.id };
  });
  return { coins: out, changed };
}
