import { getSource } from '../api/sources/index.js';

// Stablecoins are left out on purpose; USDT is not exactly one dollar.
export const FIAT = new Set([
  'AED', 'ARS', 'AUD', 'BDT', 'BHD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY',
  'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY',
  'KRW', 'KWD', 'LKR', 'MXN', 'MYR', 'NGN', 'NOK', 'NZD', 'PHP', 'PKR',
  'PLN', 'RUB', 'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'UAH', 'USD',
  'VND', 'ZAR',
]);

export function isFiat(code) {
  return FIAT.has(String(code ?? '').toUpperCase());
}

export function quoteOf(coin) {
  const source = getSource(coin.exchange);
  if (!source) return undefined;
  return source.parseSymbol(coin).quote?.toUpperCase();
}

export function availableCurrencies(coins) {
  const out = new Set();
  for (const coin of coins) {
    const quote = quoteOf(coin);
    if (quote && isFiat(quote)) out.add(quote);
  }
  return [...out];
}

export function inPortfolio(coin) {
  return coin.inPortfolio !== false;
}

export function heldIn(coins, currency) {
  const want = String(currency ?? '').toUpperCase();
  if (!isFiat(want)) return [];
  return coins.filter(c => Number(c.amount) > 0 && quoteOf(c) === want && inPortfolio(c));
}

export function total(coins, currency, priceService) {
  let sum = 0;
  for (const coin of heldIn(coins, currency)) {
    const price = priceService.getPrice(coin.id);
    if (typeof price === 'number' && isFinite(price)) sum += Number(coin.amount) * price;
  }
  return sum;
}

export function totalSeries(coins, currency, priceService) {
  const held = heldIn(coins, currency);
  if (!held.length) return [];

  const rings = held.map(c => ({ amount: Number(c.amount), ring: priceService.getRing(c.id) }));
  const n = Math.min(...rings.map(r => r.ring.length));
  if (!isFinite(n) || n === 0) return [];

  const newestFirst = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const { amount, ring } of rings) sum += amount * ring[ring.length - 1 - i];
    newestFirst.push(sum);
  }
  return newestFirst.reverse();   // oldest-first, which is what renderers draw
}
