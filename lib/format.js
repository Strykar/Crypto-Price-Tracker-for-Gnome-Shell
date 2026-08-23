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

export const PANEL_SEPARATORS = {
  'dot': { text: '\u00b7', label: '\u00b7  middle dot' },
  'bullet': { text: '\u2022', label: '\u2022  bullet' },
  'pipe': { text: '|', label: '|  pipe' },
  'slash': { text: '/', label: '/  slash' },
  'dash': { text: '\u2013', label: '\u2013  en dash' },
  'comma': { text: ',', label: ',  comma' },
  'none': { text: '', label: 'space only' },
};

const DEFAULT_PANEL_SEPARATOR = 'dot';

export function panelSeparator(id) {
  return (PANEL_SEPARATORS[id] ?? PANEL_SEPARATORS[DEFAULT_PANEL_SEPARATOR]).text;
}

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

const SYMBOLS = {
  USD: '$', EUR: '\u20ac', GBP: '\u00a3', JPY: '\u00a5', CNY: '\u00a5',
  INR: '\u20b9', KRW: '\u20a9', RUB: '\u20bd', TRY: '\u20ba', UAH: '\u20b4',
  NGN: '\u20a6', VND: '\u20ab', THB: '\u0e3f', PHP: '\u20b1', ILS: '\u20aa',
  AUD: '$', CAD: '$', NZD: '$', HKD: '$', SGD: '$', MXN: '$', BRL: 'R$',
};

function currencySymbol(code) {
  return SYMBOLS[String(code ?? '').toUpperCase()] ?? '';
}

export function formatMoney(value, currency, opts = {}) {
  return currencySymbol(currency) + formatPrice(value, opts);
}
