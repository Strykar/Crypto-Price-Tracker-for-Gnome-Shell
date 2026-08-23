function fractionDigits(price) {
  const p = Math.abs(price);
  if (p >= 1000) return 0;
  if (p >= 100) return 1;
  if (p >= 10) return 2;
  if (p >= 1) return 3;
  if (p >= 0.1) return 4;
  return 5;
}

export function formatPrice(value) {
  if (typeof value !== 'number' || !isFinite(value)) return '-';
  const digits = fractionDigits(value);
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
