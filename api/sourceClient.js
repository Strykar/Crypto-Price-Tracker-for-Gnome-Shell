import { get } from './request.js';
import { SOURCES, getSource } from './sources/index.js';

export { SOURCES, getSource };

export const exchanges = Object.fromEntries(SOURCES.map(s => [s.id, s.label]));

export async function fetchPrices(source, coins, fetchFn = get) {
  if (!coins.length) return new Map();

  if (source.supportsBatch) {
    const res = await fetchFn(source.buildUrl(coins));
    return source.parsePrices(res.body, coins);
  }

  const settled = await Promise.allSettled(
    coins.map(async c => {
      const res = await fetchFn(source.buildUrl([c]));
      return source.parsePrices(res.body, [c]);
    })
  );

  const out = new Map();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const [id, price] of r.value) out.set(id, price);
  }
  // If every coin failed, reject so PriceService retries.
  if (coins.length && out.size === 0)
    throw new Error(`${source.id}: all ${coins.length} request(s) failed`);
  return out;
}

async function fetchFlow(source, coin, fetchFn) {
  if (!source.flowUrl || !source.parseFlow) return null;
  try {
    return source.parseFlow((await fetchFn(source.flowUrl(coin))).body, coin);
  } catch (e) {
    return null;
  }
}

export async function fetchHistory(source, coins, fetchFn = get) {
  if (!source.historyUrl || !source.parseHistory) return new Map();
  const settled = await Promise.allSettled(coins.map(async c => {
    const body = await fetchFn(source.historyUrl(c)).then(r => r.body);
    return [c.id, {
      prices: source.parseHistory(body, c),
      flow: await fetchFlow(source, c, fetchFn),
    }];
  }));
  const out = new Map();
  for (const r of settled)
    if (r.status === 'fulfilled' && r.value[1].prices?.length) out.set(r.value[0], r.value[1]);
  return out;
}

export function getChartUrl(coin) {
  const source = getSource(coin.exchange);
  return source ? source.chartUrl(coin) : null;
}
