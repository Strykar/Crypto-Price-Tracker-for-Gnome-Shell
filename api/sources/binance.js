import { sortedCloses } from '../../lib/history.js';
export const BinanceSource = {
  id: 'binance',
  label: 'Binance',
  icon: 'binance',
  assetClass: 'crypto',

  minPollInterval: 5,
  supportsBatch: true,

  parseSymbol(coin) {
    const [base, quote] = coin.symbol.split('/');
    return { base, quote };
  },

  buildUrl(coins) {
    const pairs = coins.map(c => {
      const { base, quote } = this.parseSymbol(c);
      return `"${base}${quote}"`.toUpperCase();
    });
    return `https://api.binance.com/api/v3/ticker/price?symbols=[${pairs.join(',')}]`;
  },

  parsePrices(body, coins) {
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error(`binance: response was not JSON: ${e.message}`);
    }
    if (!Array.isArray(json))
      throw new Error(`binance: expected an array, got ${typeof json}`);

    const bySymbol = new Map(json.map(e => [e.symbol, Number(e.price)]));
    const out = new Map();
    for (const c of coins) {
      const { base, quote } = this.parseSymbol(c);
      const price = bySymbol.get(`${base}${quote}`.toUpperCase());
      if (typeof price === 'number' && isFinite(price)) out.set(c.id, price);
    }
    if (coins.length && out.size === 0)
      throw new Error('binance: no prices resolved from response');
    return out;
  },

  // Close price is kline field 4.
  historyUrl(coin) {
    const { base, quote } = this.parseSymbol(coin);
    return `https://api.binance.com/api/v3/klines?symbol=${`${base}${quote}`.toUpperCase()}&interval=1m&limit=48`;
  },

  parseHistory(body) {
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) throw new Error('binance: history was not an array');
    return sortedCloses(rows.map(r => [Number(r[0]), Number(r[4])]));
  },

  parseFlow(body) {
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) throw new Error('binance: flow was not an array');
    return sortedCloses(rows.map(r => {
      const vol = Number(r[5]), buy = Number(r[9]);
      return [Number(r[0]), vol > 0 ? (buy / vol) * 100 : 50];
    }));
  },

  chartUrl(coin) {
    const pair = coin.symbol.replace('/', '_').toUpperCase();
    return `https://www.binance.com/en/trade/${pair}`;
  },

  sample: {
    coins: [
      { id: 'c1', symbol: 'BTC/USDT' },
      { id: 'c2', symbol: 'ETH/USDT' },
    ],
    response: '[{"symbol":"BTCUSDT","price":"77405.81000000"},{"symbol":"ETHUSDT","price":"2440.41000000"}]',
    // captured live: symbols=["FAKEFAKE"]
    error: '{"code":-1121,"msg":"Invalid symbol."}',
  },
};
