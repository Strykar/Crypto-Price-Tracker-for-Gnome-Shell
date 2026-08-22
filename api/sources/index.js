import { BinanceSource } from './binance.js';
import { CoingeckoSource } from './coingecko.js';
import { CryptoSource } from './crypto.js';
import { OkxSource } from './okx.js';

export const SOURCES = [
  BinanceSource,
  CoingeckoSource,
  CryptoSource,
  OkxSource,
];

export function getSource(idOrLabel) {
  if (!idOrLabel) return undefined;
  const key = String(idOrLabel).toLowerCase();
  return SOURCES.find(s => s.id === key || s.label.toLowerCase() === key);
}
