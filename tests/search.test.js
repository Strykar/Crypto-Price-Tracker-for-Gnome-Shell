import { test, assertEqual } from './harness.js';
import { fuzzySearch, fuzzyScore } from '../lib/search.js';

const COINS = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'bitcoin-cash', symbol: 'bch', name: 'Bitcoin Cash' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB' },
  { id: 'solana', symbol: 'sol', name: 'Solana' },
  { id: 'wrapped-bitcoin', symbol: 'wbtc', name: 'Wrapped Bitcoin' },
];

test('exact symbol ranks first', () => {
  assertEqual(fuzzySearch('btc', COINS)[0].id, 'bitcoin');
});

test('matches a name, not just a symbol', () => {
  assertEqual(fuzzySearch('solana', COINS)[0].id, 'solana');
});

test('matches out-of-order gaps, like fzf', () => {
  // b..c..h appears in order inside "Bitcoin Cash"
  assertEqual(fuzzySearch('bch', COINS).map(c => c.id).includes('bitcoin-cash'), true);
});

test('a query that cannot match returns nothing', () => {
  assertEqual(fuzzySearch('zzzz', COINS), []);
});

test('empty query returns nothing rather than everything', () => {
  assertEqual(fuzzySearch('', COINS), []);
});

test('shorter names outrank longer ones for the same match', () => {
  const r = fuzzySearch('bitcoin', COINS).map(c => c.id);
  assertEqual(r.indexOf('bitcoin') < r.indexOf('wrapped-bitcoin'), true);
});

test('fuzzyScore is negative when a character is missing', () => {
  assertEqual(fuzzyScore('btx', 'Bitcoin') < 0, true);
});

test('a penalised match is ranked low, not dropped', () => {
  const r = fuzzySearch('bitcoin', COINS).map(c => c.id);
  assertEqual(r.includes('wrapped-bitcoin'), true, 'a valid match was dropped');
});

test('the canonical coin outranks derivatives', () => {
  const coins = [
    { id: 'bridged-eth', symbol: 'eth', name: 'Bridged Ether (StarkGate)' },
    { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
    { id: 'peg-eth', symbol: 'eth', name: 'Binance-Peg Ethereum' },
  ];
  assertEqual(fuzzySearch('eth', coins)[0].id, 'ethereum');
});

test('a real coin outranks a meme that took its name', () => {
  const coins = [
    { id: 'meme', symbol: 'bitcoin', name: 'HarryPotterObamaSonic10Inu' },
    { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  ];
  assertEqual(fuzzySearch('bitcoin', coins)[0].id, 'bitcoin');
});
