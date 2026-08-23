import GLib from 'gi://GLib';

function fail(message) {
  throw new Error(message);
}

// A preferred height is cached until the next layout, so wait a turn.
export function settle(ms = 400) {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function is(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) fail(`${what}: expected ${b}, got ${a}`);
}

// Throws on an unallocated child, or two rows of nulls would compare equal.
function columns(row, label = '') {
  return row.get_children()
    .filter(c => c.visible)
    .map(c => {
      const b = c.get_allocation_box();
      if (!isFinite(b.x1) || !isFinite(b.x2))
        fail(`${label}: ${c.style_class || c.constructor.name} has never been allocated`);
      return [Math.round(b.x1), Math.round(b.x2)];
    });
}

const portfolioRows = ind => ind.coins.filter(c => c.visible);

export async function showView(ext, view) {
  ext._settings.set_string('dropdown-view', view);
  ext._applyPortfolio();
  ext._indicator.menu.close();
  ext._indicator.menu.open();
  await settle();
}

export const PRICES = new Map([['1', 80000], ['2', 2500], ['3', 100], ['4', 80000], ['5', 2500]]);

export function seedPrices(ext) {
  for (const [id, price] of PRICES) {
    const state = ext._priceService._state.get(id) ?? { ring: [], lastAppend: 0 };
    ext._priceService._state.set(id, { ...state, price });
  }
  for (const fn of ext._priceService._listeners) fn();
}

export const CASES = [

  ['the heading, a coin row and the total share column offsets', async ext => {
    const ind = ext._indicator;
    await showView(ext, 'portfolio');
    const coin = portfolioRows(ind)[0];
    if (!coin) fail('no visible coin row to measure');
    const total = ind._portfolioRow.get_first_child();
    is(columns(coin, 'coin'), columns(ind._headerRow, 'heading'), 'coin row against the heading');
    is(columns(total, 'total'), columns(ind._headerRow, 'heading'), 'total against the heading');
  }],

  ['the heading lines up with a prices row as well', async ext => {
    const ind = ext._indicator;
    await showView(ext, 'prices');
    try {
      const row = ind.coins.find(c => c.visible);
      if (!row) fail('no visible prices row to measure');
      is(columns(row, 'prices row'), columns(ind._headerRow, 'heading'), 'prices row against the heading');
    } finally {
      await showView(ext, 'portfolio');
    }
  }],

  ['the heading sits above the coin rows and the total below them', ext => {
    const ind = ext._indicator;
    const order = ind.coinsScrollViewVbox.get_children();
    if (order[0] !== ind._headerRow)
      fail('the heading is not the first child of the list');
    if (order[order.length - 1] !== ind._portfolioRow)
      fail('the total is not the last child of the list');
  }],

  ['a pair quoted in the portfolio currency is shown in the portfolio', ext => {
    const currency = ext._settings.get_string('base-currency');
    for (const coin of ext._indicator.coins) {
      const quote = coin.symbol.split('/')[1].toUpperCase();
      const belongs = quote === currency && coin.inPortfolio;
      if (coin.visible !== belongs)
        fail(`${coin.symbol} quoted in ${quote}: visible=${coin.visible}, expected ${belongs}`);
    }
  }],

  ['the portfolio hides price, the panel switch and the exchange logo', ext => {
    const coin = portfolioRows(ext._indicator)[0];
    if (coin.priceLbl.visible) fail('the price column is showing in the portfolio');
    if (coin._statusBtn.visible) fail('the panel switch is showing in the portfolio');
    if (coin._viewBtn.visible) fail('the exchange logo is showing in the portfolio');
  }],

  ['the portfolio shows both charts, held and value', ext => {
    const coin = portfolioRows(ext._indicator)[0];
    for (const [name, actor] of [['price chart', coin.sparkline], ['flow chart', coin.flowSparkline],
                                 ['held', coin.amountLbl], ['value', coin.valueLbl]])
      if (!actor.visible) fail(`${name} is hidden in the portfolio`);
  }],

  ['the prices view hides the portfolio columns rather than blanking them', ext => {
    const coin = portfolioRows(ext._indicator)[0];
    coin.setPortfolioView(false, ext._settings.get_string('base-currency'));
    try {
      for (const [name, actor] of [['flow chart', coin.flowSparkline],
                                   ['held', coin.amountLbl], ['value', coin.valueLbl]])
        if (actor.visible) fail(`${name} is still a visible child in the prices view`);
    } finally {
      ext._applyPortfolio();
    }
  }],

  ['one chart is given more room than two side by side', ext => {
    const coin = portfolioRows(ext._indicator)[0];
    const two = coin.sparkline.get_theme_node().get_min_width();
    coin.setPortfolioView(false, ext._settings.get_string('base-currency'));
    const one = coin.sparkline.get_theme_node().get_min_width();
    ext._applyPortfolio();
    if (!(one > two))
      fail(`a prices chart is ${one}px and a portfolio chart ${two}px`);
  }],

  ['a value quoted in real money carries its symbol', ext => {
    const currency = ext._settings.get_string('base-currency');
    const symbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }[currency];
    if (!symbol) return;                 // nothing to assert for this currency
    const coin = portfolioRows(ext._indicator)[0];
    if (!coin.valueLbl.text.startsWith(symbol))
      fail(`value reads ${JSON.stringify(coin.valueLbl.text)}, expected it to start with ${symbol}`);
  }],

  ['a pair quoted in a token carries no currency symbol', ext => {
    const coin = ext._indicator.coins.find(c => c.symbol.endsWith('/USDT'));
    if (!coin) return;
    if (/^[$€£₹]/.test(coin.priceLbl.text))
      fail(`${coin.symbol} price reads ${JSON.stringify(coin.priceLbl.text)}, which claims real money`);
  }],

  ['the total is the sum of the rows above it', ext => {
    const ind = ext._indicator;
    const digits = s => Number(String(s).replace(/[^0-9.]/g, ''));
    const rows = portfolioRows(ind).map(c => digits(c.valueLbl.text)).filter(n => n > 0);
    if (!rows.length) fail('no priced holdings to sum');
    const shown = digits(ind._portfolioRow.get_first_child().get_children()
      .find(c => c.style_class?.includes('crypto-col-value')).text);
    const sum = rows.reduce((a, b) => a + b, 0);
    // Rounded for display, so allow a unit of the last place per row.
    if (Math.abs(shown - sum) > rows.length)
      fail(`total shows ${shown}, the rows add to ${sum}`);
  }],

  ['the panel shows one label per active pair', ext => {
    const ind = ext._indicator;
    const active = ind.coins.filter(c => c.activeCoin).length;
    const groups = ind.panelBox.get_children()
      .filter(c => c.style_class?.includes('crypto-panel-coin'));
    is(groups.length, active, 'panel groups against active pairs');
  }],

  ['turning the panel separator off hides it rather than leaving its padding', ext => {
    const ind = ext._indicator;
    const seps = () => ind.panelBox.get_children()
      .flatMap(g => g.get_children?.() ?? [])
      .filter(c => c.style_class?.includes('crypto-panel-sep'));
    ind.panelBox.update(ext._priceService, {}, 'none');
    for (const s of seps()) if (s.visible) fail('a separator is still visible with none chosen');
    ind.panelBox.update(ext._priceService, {}, 'pipe');
    const marks = seps();
    if (marks.length && !marks.every(s => s.visible && s.text === '|'))
      fail('choosing pipe did not put a pipe between the pairs');
  }],

  ['a sparkline given the same data again does not repaint', ext => {
    const coin = portfolioRows(ext._indicator)[0];
    const chart = coin.sparkline;
    let repaints = 0;
    const real = chart.queue_repaint.bind(chart);
    chart.queue_repaint = () => { repaints++; real(); };
    try {
      const series = [1, 2, 3, 4];
      chart.setSeries(series);
      const after = repaints;
      chart.setSeries([1, 2, 3, 4]);
      if (repaints !== after) fail('the same series queued a second repaint');
    } finally {
      delete chart.queue_repaint;
    }
  }],

  ['the scroll view follows the height of the view it is showing', async ext => {
    const ind = ext._indicator;
    const rowsHeight = () => Math.round(ind.coinsScrollViewVbox.get_children()
      .filter(c => c.visible)
      .reduce((h, c) => h + c.get_preferred_height(-1)[1], 0));
    const measure = async view => {
      ext._settings.set_string('dropdown-view', view);
      ext._applyPortfolio();
      await settle();
      return [Math.round(ind._coinsScrollview.height), rowsHeight()];
    };
    const [portScroll, portRows] = await measure('portfolio');
    const [priceScroll, priceRows] = await measure('prices');
    ext._settings.set_string('dropdown-view', 'portfolio');
    ext._applyPortfolio();
    await settle();

    if (portRows === priceRows)
      fail(`both views need ${portRows}px, so this proves nothing`);
    if (portScroll !== portRows)
      fail(`portfolio: ${portRows}px of rows in a ${portScroll}px scroll view`);
    if (priceScroll !== priceRows)
      fail(`prices: ${priceRows}px of rows in a ${priceScroll}px scroll view`);
  }],

  // Upstream #44. Runs last, because the deleted pair does not come back.
  ['deleting a pair takes it out of the list before anything redraws', ext => {
    const ind = ext._indicator;
    const before = ind.coins.length;
    const doomed = ind.coins[ind.coins.length - 1];
    const id = doomed.id;
    doomed._delCoin();
    if (ind.coins.some(c => c.id === id)) fail('the deleted pair is still in the list');
    is(ind.coins.length, before - 1, 'pair count after a delete');
    ext._redraw();
  }],
];
