export const OkxSource = {
  id: 'okx',
  label: 'OKX',
  icon: 'okx',
  assetClass: 'crypto',

  minPollInterval: 5,
  // The all-tickers endpoint is 437KB; per-coin requests win until ~1189 coins.
  supportsBatch: false,

  parseSymbol(coin) {
    const [base, quote] = coin.symbol.split('/');
    return { base, quote };
  },

  buildUrl(coins) {
    const { base, quote } = this.parseSymbol(coins[0]);
    const instId = `${base}-${quote}`.toUpperCase();
    return `https://www.okx.com/api/v5/market/ticker?instId=${instId}`;
  },

  parsePrices(body, coins) {
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new Error(`okx: response was not JSON: ${e.message}`);
    }
    if (json.code !== undefined && json.code !== '0')
      throw new Error(`okx: ${json.msg || `error ${json.code}`}`);

    const last = Number(json?.data?.[0]?.last);
    const out = new Map();
    if (isFinite(last) && coins.length) out.set(coins[0].id, last);
    if (coins.length && out.size === 0)
      throw new Error('okx: no prices resolved from response');
    return out;
  },

  chartUrl(coin) {
    const pair = coin.symbol.replace('/', '-').toLowerCase();
    return `https://www.okx.com/markets/spot-info/${pair}`;
  },

  sample: {
    coins: [{ id: 'c1', symbol: 'BTC/USDT' }],
    response: '{"code":"0","msg":"","data":[{"instType":"SPOT","instId":"BTC-USDT","last":"77339.4","lastSz":"0.00001297","askPx":"77338.6","askSz":"1.34386794","bidPx":"77338.5","bidSz":"0.602345","open24h":"77132.9","high24h":"79515.7","low24h":"76222.2","volCcy24h":"1199882828.298494603","vol24h":"15456.91602854","ts":"1787386839660","sodUtc0":"78338.1","sodUtc8":"77228.9"}]}',
    // captured live: instId=FAKE-FAKE
    error: `{"code":"51001","msg":"Instrument ID, Instrument ID code, or Spread ID doesn't exist.","data":[]}`,
  },
};
