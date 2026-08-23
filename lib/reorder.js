export function moveCoin(coins, fromId, toId) {
  const from = coins.findIndex(c => c.id === fromId);
  const to = coins.findIndex(c => c.id === toId);
  if (from < 0 || to < 0 || from === to) return coins;
  const next = coins.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
