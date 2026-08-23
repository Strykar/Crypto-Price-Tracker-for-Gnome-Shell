import { test, assertEqual } from './harness.js';
import { formatPrice } from '../lib/format.js';

test('formatPrice: decimal count follows the magnitude', () => {
  for (const [input, expected] of [
    [77026.65, '77,027'],
    [235.68,   '235.7'],
    [93.38,    '93.38'],
    [1.2345,   '1.235'],
    [0.54321,  '0.5432'],
    [0.012345, '0.01235'],
  ]) assertEqual(formatPrice(input), expected, `formatPrice(${input})`);
});
test('formatPrice: rejects non-finite with a dash', () => {
  assertEqual(formatPrice(NaN), '-');
  assertEqual(formatPrice(undefined), '-');
  assertEqual(formatPrice(null), '-');
});
