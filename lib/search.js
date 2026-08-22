// Subsequence match, like fzf: "btc" finds "Bitcoin".
export function fuzzyScore(query, text) {
  const q = query.toLowerCase(), t = text.toLowerCase();
  if (!q) return 0;
  let qi = 0, score = 0, streak = 0, first = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) { streak = 0; continue; }
    if (first < 0) first = ti;
    streak++;
    score += streak * 2 + (ti === 0 || /[\s-]/.test(t[ti - 1]) ? 4 : 0);
    qi++;
  }
  if (qi < q.length) return -1;          // not all characters matched
  score -= first;                        // earlier match is a better match
  score -= (t.length - q.length) * 0.1;  // shorter name is a better match
  return score;
}

const DERIVATIVE = /\b(bridged|wrapped|peg(ged)?|binance-peg|wormhole|synthetic|staked|restaked)\b|\(.*\)|\.e$/i;

export function rank(query, coin) {
  const q = query.toLowerCase();
  const sym = coin.symbol.toLowerCase();
  const name = coin.name.toLowerCase();

  const symScore = fuzzyScore(q, sym);
  const nameScore = fuzzyScore(q, name);
  if (symScore < 0 && nameScore < 0) return null;

  let best = Math.max(symScore, nameScore < 0 ? -Infinity : nameScore - 2);

  if (sym === q) best += 100;
  if (name === q) best += 90;
  if (name.startsWith(q)) best += 30;
  if (DERIVATIVE.test(coin.name)) best -= 60;
  best -= coin.name.length * 0.4;   // a plain name beats an embellished one
  return best;
}

export function fuzzySearch(query, coins, limit = 40) {
  if (!query) return [];
  const out = [];
  for (const c of coins) {
    const s = rank(query, c);
    if (s !== null) out.push([s, c]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, c]) => c);
}
