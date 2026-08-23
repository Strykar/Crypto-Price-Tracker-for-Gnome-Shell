import GLib from 'gi://GLib';

import { getSource } from '../api/sources/index.js';
import { fetchPrices, fetchHistory } from '../api/sourceClient.js';
import * as HistoryCache from './historyCache.js';

const HISTORY_CAP = 48;
const HISTORY_INTERVAL = 60;   // seconds, fixed

export function groupBySource(coins) {
  const out = new Map();
  for (const coin of coins) {
    const source = getSource(coin.exchange);
    if (!source) continue;
    if (!out.has(source.id)) out.set(source.id, []);
    out.get(source.id).push(coin);
  }
  return out;
}

// Fetch held coins too, or hiding one from the panel drops it from the total.
export function coinsToFetch(coins) {
  return coins.filter(c => c.active || Number(c.amount) > 0);
}

export function pushHistory(ring, price, cap = HISTORY_CAP) {
  if (typeof price !== 'number' || !isFinite(price)) return ring;
  const next = [...ring, price];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

// Back off a source that answers 429, doubling each time, until a request succeeds.
const BACKOFF_START = 60;
const BACKOFF_MAX = 900;

export function nextBackoff(current) {
  return Math.min(current > 0 ? current * 2 : BACKOFF_START, BACKOFF_MAX);
}

export function dueSources(sourceIds, lastFetched, nowSeconds, backoffUntil = new Map()) {
  return sourceIds.filter(id => {
    const source = getSource(id);
    if (!source) return false;
    if (nowSeconds < (backoffUntil.get(id) ?? 0)) return false;
    const last = lastFetched.get(id);
    if (last === undefined) return true;
    return nowSeconds - last >= source.minPollInterval;
  });
}

export class PriceService {
  constructor(getCoins, getInterval) {
    this._getCoins = getCoins;         // () => Array<Coin>
    this._getInterval = getInterval;   // () => Number, the user's floor
    this._state = new Map();           // coinId -> {price, ring, lastAppend}
    this._lastFetched = new Map();     // sourceId -> seconds
    this._backoffUntil = new Map();    // sourceId -> seconds, set when told 429
    this._backoffFor = new Map();      // sourceId -> current penalty
    this._inFlight = new Set();        // sourceId currently being fetched
    this._listeners = [];
    this._timer = 0;
  }

  connect(fn) {
    this._listeners.push(fn);
  }

  getPrice(coinId) {
    return this._state.get(coinId)?.price;
  }

  getRing(coinId) {
    return this._state.get(coinId)?.ring ?? [];
  }

  getFlow(coinId) {
    return this._state.get(coinId)?.flow ?? null;
  }

  start() {
    this.stop();
    this._seed();
    this._tick();
    // Read once; a new refresh-interval applies on the next enable.
    const period = Math.max(1, this._getInterval());
    this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, period, () => {
      this._tick();
      return GLib.SOURCE_CONTINUE;
    });
  }

  stop() {
    if (this._timer) {
      GLib.source_remove(this._timer);
      this._timer = 0;
    }
  }

  destroy() {
    this.stop();
    this._state.clear();
    this._lastFetched.clear();
    this._backoffUntil.clear();
    this._backoffFor.clear();
    this._inFlight.clear();
    this._listeners = [];
  }

  async _seed() {
    const wanted = coinsToFetch(this._getCoins());

    const cached = HistoryCache.load();
    const stillNeeded = [];
    for (const coin of wanted) {
      const hit = cached.get(HistoryCache.keyFor(coin));
      if (hit?.prices?.length > 1) {
        this._state.set(coin.id, {
          price: this._state.get(coin.id)?.price ?? hit.prices[hit.prices.length - 1],
          ring: hit.prices.slice(-HISTORY_CAP),
          flow: hit.flow?.slice(-HISTORY_CAP) ?? null,
          lastAppend: 0,
        });
      } else {
        stillNeeded.push(coin);
      }
    }
    if (cached.size) for (const fn of this._listeners) fn();
    if (!stillNeeded.length) return;

    const groups = groupBySource(stillNeeded);
    const results = await Promise.allSettled(
      [...groups].map(async ([id, coins]) => [id, await fetchHistory(getSource(id), coins)])
    );
    let any = false;
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const [coinId, series] of r.value[1]) {
        const prev = this._state.get(coinId);
        if (prev?.ring?.length > 1) continue;   // live data already wins
        this._state.set(coinId, {
          price: prev?.price ?? series.prices[series.prices.length - 1],
          ring: series.prices.slice(-HISTORY_CAP),
          flow: series.flow?.slice(-HISTORY_CAP) ?? null,
          lastAppend: prev?.lastAppend ?? 0,
        });
        any = true;
      }
    }
    await this._seedFromBinance();
    this._saveCache();
    if (any) for (const fn of this._listeners) fn();
  }

  async _seedFromBinance() {
    const binance = getSource('binance');
    if (!binance?.parseFlow) return;

    const needs = coinsToFetch(this._getCoins()).filter(c => {
      const state = this._state.get(c.id);
      return !state?.flow || !(state?.ring?.length > 1);
    });
    if (!needs.length) return;

    const proxies = needs.map(c => {
      const src = getSource(c.exchange);
      const base = src?.parseSymbol(c)?.base ?? '';
      // CoinGecko keys on an id like "bitcoin"; Binance wants the ticker.
      const ticker = (c.exchange === 'coingecko' ? c.title || c.symbol.split('/')[0] : base);
      return { id: c.id, symbol: `${ticker}/USDT` };
    });

    const { get } = await import('../api/request.js');
    const results = await Promise.allSettled(proxies.map(async pc => {
      const state = this._state.get(pc.id);
      const grab = async url => url ? (await get(url)).body : null;
      const [hist, flow] = await Promise.allSettled([
        grab(state?.ring?.length > 1 ? null : binance.historyUrl(pc)),
        grab(state?.flow ? null : binance.flowUrl(pc)),
      ]);
      return [
        pc.id,
        hist.status === 'fulfilled' && hist.value ? binance.parseHistory(hist.value, pc) : null,
        flow.status === 'fulfilled' && flow.value ? binance.parseFlow(flow.value, pc) : null,
      ];
    }));

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const [coinId, prices, flow] = r.value;
      const prev = this._state.get(coinId) ?? { ring: [], lastAppend: 0 };
      const next = { ...prev };

      if (flow?.length) next.flow = flow.slice(-HISTORY_CAP);

      // Rescale the borrowed series so it ends at our own price.
      if (!(prev.ring?.length > 1) && prices?.length > 1) {
        const here = prev.price ?? this._state.get(coinId)?.price;
        const scale = isFinite(here) && prices[prices.length - 1] > 0
          ? here / prices[prices.length - 1] : 1;
        next.ring = prices.slice(-HISTORY_CAP).map(v => v * scale);
      }
      this._state.set(coinId, next);
    }
  }

  _saveCache() {
    const out = new Map();
    for (const coin of coinsToFetch(this._getCoins())) {
      const state = this._state.get(coin.id);
      if (!(state?.ring?.length > 1)) continue;
      out.set(HistoryCache.keyFor(coin), { prices: state.ring, flow: state.flow ?? null });
    }
    if (out.size) HistoryCache.save(out);
  }

  async _tick() {
    const now = GLib.get_monotonic_time() / 1e6;

    let coins;
    try {
      coins = this._getCoins();
    } catch (e) {
      console.log(`PriceService: failed to read coins: ${e}`);
      return;
    }

    const groups = groupBySource(coinsToFetch(coins));
    const due = dueSources([...groups.keys()], this._lastFetched, now)
      .filter(id => !this._inFlight.has(id));
    if (!due.length) return;

    for (const id of due) this._inFlight.add(id);

    const results = await Promise.allSettled(
      due.map(async id => {
        try {
          const prices = await fetchPrices(getSource(id), groups.get(id));
          return { id, prices };
        } finally {
          this._inFlight.delete(id);
        }
      })
    );

    let any = false;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== 'fulfilled') {
        if (r.reason?.status === 429) {
          const id = due[i];
          const penalty = nextBackoff(this._backoffFor.get(id) ?? 0);
          this._backoffFor.set(id, penalty);
          this._backoffUntil.set(id, now + penalty);
          console.debug(`crypto-tracker: ${id} rate-limited, backing off ${penalty}s`);
        }
        continue;
      }
      this._backoffFor.delete(r.value.id);
      this._backoffUntil.delete(r.value.id);
      this._lastFetched.set(r.value.id, now);
      for (const [coinId, price] of r.value.prices) {
        const prev = this._state.get(coinId) ?? { ring: [], lastAppend: 0 };
        const appendDue = now - prev.lastAppend >= HISTORY_INTERVAL;
        this._state.set(coinId, {
          price,
          ring: appendDue ? pushHistory(prev.ring, price) : prev.ring,
          flow: prev.flow ?? null,
          lastAppend: appendDue ? now : prev.lastAppend,
        });
        any = true;
      }
    }
    if (any) for (const fn of this._listeners) fn();
  }
}
