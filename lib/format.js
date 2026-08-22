function fractionDigits(price) {
  const p = Math.abs(price);
  if (p >= 1000) return 0;
  if (p >= 100) return 1;
  if (p >= 10) return 2;
  if (p >= 1) return 3;
  if (p >= 0.1) return 4;
  return 5;
}

export const SEPARATORS = {
  'comma-dot': { group: ',', decimal: '.', label: '1,234.56' },
  'dot-comma': { group: '.', decimal: ',', label: '1.234,56' },
  'space-dot': { group: ' ', decimal: '.', label: '1 234.56' },
  'space-comma': { group: ' ', decimal: ',', label: '1 234,56' },
  'none-dot': { group: '', decimal: '.', label: '1234.56' },
};

const DEFAULT_SEPARATOR = 'comma-dot';

export function formatPrice(value, { separator = DEFAULT_SEPARATOR, decimals = -1 } = {}) {
  if (typeof value !== 'number' || !isFinite(value)) return '-';
  const sep = SEPARATORS[separator] ?? SEPARATORS[DEFAULT_SEPARATOR];
  const digits = decimals >= 0 ? decimals : fractionDigits(value);

  // Round with toLocaleString like the original code; toFixed rounds differently.
  const base = value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    useGrouping: sep.group !== '',
  });

  // Via a placeholder, so a swap like comma-dot to dot-comma cannot collide.
  return base
    .replace(/,/g, '\u0000')
    .replace(/\./g, sep.decimal)
    .replace(/\u0000/g, sep.group);
}
