import { getSource } from '../api/sources/index.js';

export function isDuplicateCoin(coin, coins) {
  const exchangeId = getSource(coin.exchange)?.id ?? coin.exchange;
  return coins.some(_coin =>
    coin.symbol.toUpperCase() === _coin.symbol &&
    exchangeId === (getSource(_coin.exchange)?.id ?? _coin.exchange)
  );
}
