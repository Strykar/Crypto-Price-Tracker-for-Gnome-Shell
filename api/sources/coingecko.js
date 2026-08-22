import { sortedCloses } from '../../lib/history.js';
export const CoingeckoSource = {
  id: 'coingecko',
  label: 'Coingecko',
  icon: 'coingecko',
  assetClass: 'crypto',

  // Free tier allows roughly 10-30 requests a minute.
  example: 'BTC/USD',

  minPollInterval: 15,
  supportsBatch: true,

  parseSymbol(coin) {
    const [, quote] = coin.symbol.split('/');
    return { base: coin.coingecko_id || coin.symbol.split('/')[0], quote };
  },

  buildUrl(coins) {
    const ids = coins.map(c => this.parseSymbol(c).base.toLowerCase());
    const vs = coins.map(c => this.parseSymbol(c).quote.toLowerCase());
    const uniq = a => [...new Set(a)].join(',');
    return `https://api.coingecko.com/api/v3/simple/price?ids=${uniq(ids)}&vs_currencies=${uniq(vs)}`;
  },

  parsePrices(body, coins) {
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error(`coingecko: response was not JSON: ${e.message}`);
    }
    if (typeof json !== 'object' || json === null)
      throw new Error('coingecko: expected an object');
    if (json.status?.error_code)
      throw new Error(`coingecko: ${json.status.error_message || `error ${json.status.error_code}`}`);

    const out = new Map();
    for (const c of coins) {
      const { base, quote } = this.parseSymbol(c);
      const price = Number(json?.[base.toLowerCase()]?.[quote.toLowerCase()]);
      if (isFinite(price)) out.set(c.id, price);
    }
    if (coins.length && out.size === 0)
      throw new Error('coingecko: no prices resolved from response');
    return out;
  },

  historyUrl(coin) {
    const { base, quote } = this.parseSymbol(coin);
    return `https://api.coingecko.com/api/v3/coins/${base.toLowerCase()}` +
           `/market_chart?vs_currency=${quote.toLowerCase()}&days=1`;
  },

  parseHistory(body) {
    const json = JSON.parse(body);
    if (!Array.isArray(json?.prices)) throw new Error('coingecko: history had no prices array');
    return sortedCloses(json.prices.map(r => [Number(r[0]), Number(r[1])]));
  },

  chartUrl(coin) {
    const id = (coin.coingecko_id || coin.symbol.split('/')[0]).toLowerCase();
    return `https://www.coingecko.com/en/coins/${id}`;
  },

  sample: {
    coins: [
      { id: 'c1', symbol: 'BTC/USD', coingecko_id: 'bitcoin' },
      { id: 'c2', symbol: 'ETH/USD', coingecko_id: 'ethereum' },
    ],
    response: '{"bitcoin":{"usd":77338},"ethereum":{"usd":2436.32}}',
    // captured live: the free tier's real rate-limit body
    error: `{"status":{"error_code":429,"error_message":"You've exceeded the Rate Limit. Please visit https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher rate limits."}}`,
  },
};
