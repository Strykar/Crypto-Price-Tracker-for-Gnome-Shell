// OKX returns newest first, the others oldest first.
export function sortedCloses(pairs, cap = 48) {
  const clean = pairs
    .filter(([t, c]) => isFinite(t) && isFinite(c))
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c);
  return clean.length > cap ? clean.slice(clean.length - cap) : clean;
}
