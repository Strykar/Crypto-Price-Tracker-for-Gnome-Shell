#!/usr/bin/env -S gjs -m
// Usage: ./tests/capture-sample.js <source-id>
import System from 'system';
import { get, destroy } from '../api/request.js';
import { getSource } from '../api/sources/index.js';

function quoteJs(str) {
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function formatCoins(coins) {
  return coins.map(c => {
    const parts = [`id: ${quoteJs(c.id)}`, `symbol: ${quoteJs(c.symbol)}`];
    if (c.coingecko_id) parts.push(`coingecko_id: ${quoteJs(c.coingecko_id)}`);
    return `      { ${parts.join(', ')} },`;
  }).join('\n');
}

const id = ARGV[0];
if (!id) {
  printerr('usage: ./tests/capture-sample.js <source-id>');
  System.exit(1);
}

const source = getSource(id);
if (!source) {
  printerr(`unknown source: ${id}`);
  System.exit(1);
}

const DEFAULT_COINS = source.supportsBatch
  ? [
      { id: 'c1', symbol: 'BTC/USDT', coingecko_id: 'bitcoin' },
      { id: 'c2', symbol: 'ETH/USDT', coingecko_id: 'ethereum' },
    ]
  : [{ id: 'c1', symbol: 'BTC/USDT', coingecko_id: 'bitcoin' }];

const coins = source.sample?.coins ?? DEFAULT_COINS;
const url = source.buildUrl(coins);
printerr(`# fetching ${url}`);

let body;
try {
  const res = await get(url);
  body = res.body;
} catch (e) {
  printerr(`request failed: ${e.message}`);
  System.exit(1);
}

const BOGUS = [{ id: 'c1', symbol: 'ZZZZZZ/USDT', coingecko_id: 'zzzzzz-not-a-coin' }];
let errorBody = null;
try {
  const res = await get(source.buildUrl(BOGUS));
  errorBody = res.body;
} catch (e) {
  errorBody = e.body ?? null;
}
destroy();

print(`  sample: {`);
print(`    coins: [`);
print(formatCoins(coins));
print(`    ],`);
print(`    response: ${quoteJs(body)},`);
if (errorBody !== null) {
  print(`    error: ${quoteJs(errorBody)},`);
} else {
  print(`    // could not capture automatically -- request an invalid symbol`);
  print(`    // through this API by hand and paste its response body here`);
  print(`    error: 'TODO',`);
}
print(`  },`);

System.exit(0);
