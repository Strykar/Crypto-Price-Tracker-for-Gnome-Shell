export const CryptoSource = {
  id: 'crypto',
  label: 'Crypto',
  icon: 'crypto',
  assetClass: 'crypto',

  minPollInterval: 5,
  // "All tickers" is 151KB measured, against 236 bytes per coin.
  supportsBatch: false,

  parseSymbol(coin) {
    const [base, quote] = coin.symbol.split('/');
    return { base, quote };
  },

  buildUrl(coins) {
    const { base, quote } = this.parseSymbol(coins[0]);
    const instrument = `${base}_${quote}`.toUpperCase();
    return `https://api.crypto.com/v2/public/get-ticker?instrument_name=${instrument}`;
  },

  parsePrices(body, coins) {
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error(`crypto: response was not JSON: ${e.message}`);
    }
    if (json.code !== undefined && json.code !== 0)
      throw new Error(`crypto: ${json.message || `error ${json.code}`}`);
    if (!json.result?.data)
      throw new Error('crypto: response missing result.data');

    const last = Number(json.result.data[0]?.a);
    const out = new Map();
    if (isFinite(last) && coins.length) out.set(coins[0].id, last);
    if (coins.length && out.size === 0)
      throw new Error('crypto: no prices resolved from response');
    return out;
  },

  chartUrl(coin) {
    const pair = coin.symbol.replace('/', '_').toUpperCase();
    return `https://crypto.com/exchange/trade/${pair}`;
  },

  sample: {
    coins: [{ id: 'c1', symbol: 'BTC/USDT' }],
    response: '{"id":-1,"method":"public/get-tickers","code":0,"result":{"data":[{"i":"BTC_USDT","h":"79525.99","l":"76238.41","a":"77356.75","v":"4717.7611","vv":"365687241.89","c":"0.0024","b":"77349.58","k":"77349.59","oi":"0","t":1787386837162}]}}',
    // captured live: instrument_name=FAKE_FAKE
    error: '{"id":-1,"code":40004,"message":"Invalid instrument_name"}',
  },
};
