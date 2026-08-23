import GLib from 'gi://GLib';

import { getSource } from '../api/sources/index.js';
import { fetchPrices } from '../api/sourceClient.js';

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

export function dueSources(sourceIds, lastFetched, nowSeconds) {
  return sourceIds.filter(id => {
    const source = getSource(id);
    if (!source) return false;
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

  start() {
    this.stop();
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
    this._inFlight.clear();
    this._listeners = [];
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
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      this._lastFetched.set(r.value.id, now);
      for (const [coinId, price] of r.value.prices) {
        const prev = this._state.get(coinId) ?? { ring: [], lastAppend: 0 };
        const appendDue = now - prev.lastAppend >= HISTORY_INTERVAL;
        this._state.set(coinId, {
          price,
          ring: appendDue ? pushHistory(prev.ring, price) : prev.ring,
          lastAppend: appendDue ? now : prev.lastAppend,
        });
        any = true;
      }
    }
    if (any) for (const fn of this._listeners) fn();
  }
}
