import { test, assertEqual } from './harness.js';
import { moveCoin } from '../lib/reorder.js';

const ids = list => list.map(c => c.id);
const L = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

test('moving down puts the pair after the one it was dropped on', () => {
  assertEqual(ids(moveCoin(L(), 'a', 'c')), ['b', 'c', 'a', 'd']);
});

test('moving up puts the pair before the one it was dropped on', () => {
  assertEqual(ids(moveCoin(L(), 'd', 'b')), ['a', 'd', 'b', 'c']);
});

test('dropping a pair on itself changes nothing', () => {
  assertEqual(ids(moveCoin(L(), 'b', 'b')), ['a', 'b', 'c', 'd']);
});

test('an unknown id changes nothing rather than corrupting the list', () => {
  assertEqual(ids(moveCoin(L(), 'zz', 'b')), ['a', 'b', 'c', 'd']);
  assertEqual(ids(moveCoin(L(), 'a', 'zz')), ['a', 'b', 'c', 'd']);
});

test('the original list is not mutated', () => {
  const original = L();
  moveCoin(original, 'a', 'd');
  assertEqual(ids(original), ['a', 'b', 'c', 'd']);
});

test('moving to either end works', () => {
  assertEqual(ids(moveCoin(L(), 'd', 'a')), ['d', 'a', 'b', 'c']);
  assertEqual(ids(moveCoin(L(), 'a', 'd')), ['b', 'c', 'd', 'a']);
});
