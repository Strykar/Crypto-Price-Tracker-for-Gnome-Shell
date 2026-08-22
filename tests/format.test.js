import { test, assertEqual } from './harness.js';
import { formatPrice, panelSeparator } from '../lib/format.js';

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

test('formatPrice: separators are configurable', () => {
  const v = 1234567.891;
  assertEqual(formatPrice(v, { separator: 'comma-dot', decimals: 2 }), '1,234,567.89');
  assertEqual(formatPrice(v, { separator: 'dot-comma', decimals: 2 }), '1.234.567,89');
  assertEqual(formatPrice(v, { separator: 'space-dot', decimals: 2 }), '1 234 567.89');
  assertEqual(formatPrice(v, { separator: 'space-comma', decimals: 2 }), '1 234 567,89');
  assertEqual(formatPrice(v, { separator: 'none-dot', decimals: 2 }), '1234567.89');
});

test('formatPrice: a fixed decimal count overrides the magnitude rule', () => {
  assertEqual(formatPrice(77026.65, { decimals: 2 }), '77,026.65');
  assertEqual(formatPrice(77026.65, { decimals: 0 }), '77,027');
  assertEqual(formatPrice(0.012345, { decimals: 8 }), '0.01234500');
});

test('formatPrice: decimals -1 means the same as not asking', () => {
  for (const v of [77026.65, 93.38, 0.012345])
    assertEqual(formatPrice(v, { decimals: -1 }), formatPrice(v), `formatPrice(${v})`);
});

test('formatPrice: negatives keep their sign and grouping', () => {
  assertEqual(formatPrice(-1234.5, { decimals: 1 }), '-1,234.5');
});

test('formatPrice: an unknown separator falls back rather than throwing', () => {
  assertEqual(formatPrice(1234.5, { separator: 'nonsense', decimals: 1 }), '1,234.5');
});

test('panelSeparator returns the chosen mark', () => {
  assertEqual(panelSeparator('dot'), '·');
  assertEqual(panelSeparator('pipe'), '|');
  assertEqual(panelSeparator('none'), '');
});

test('panelSeparator falls back rather than throwing on an unknown id', () => {
  assertEqual(panelSeparator('nonsense'), '·');
  assertEqual(panelSeparator(undefined), '·');
});
