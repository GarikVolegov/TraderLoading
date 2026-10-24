import assert from 'node:assert/strict';

export async function runFlows({ page, context, report, out, inspect, apiFromPage }) {
  const base = process.env.VERIFY_BASE_URL;
  const check = async (name, fn) => {
    try {
      await fn();
      report.checks.push({ name, status: 'passed' });
      console.log('PASS', name);
    } catch (error) {
      report.checks.push({ name, status: 'failed', error: error.message });
      await page.screenshot({ path: new URL(`failure-${report.checks.length}.png`, out).pathname }).catch(() => {});
      console.log('FAIL', name, error.message.slice(0, 500));
      process.exitCode = 1;
      await page.keyboard.press('Escape').catch(() => {});
    }
  };
  const go = async path => {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.trim().length > 80, null, { timeout: 20000 });
    await page.waitForTimeout(400);
  };
  const visible = locator => locator.isVisible();
  const viewportBounds = async locator => {
    const box = await locator.boundingBox();
    assert.ok(box, 'element has visible bounds');
    const vp = page.viewportSize();
    assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1, `element outside viewport: ${JSON.stringify(box)}`);
    return box;
  };
  if (!process.env.MOBILE_SKIP_MATRIX) for (const width of [320, 360, 430, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, label] of [['/', 'today'], ['/?vista=mercati', 'markets'], ['/chat', 'chat'], ['/settings', 'settings'], ['/patrimonio', 'financial'], ['/admin/users', 'admin-users']]) {
      await inspect(path, `${label}-${width}`);
      await check(`${label} fits ${width}px and uses the correct navigation`, async () => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const mobileNav = page.locator('[data-mobile-navigation]');
        if (!path.startsWith('/admin')) assert.equal(await visible(mobileNav), width < 1024);
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, label] of [
    ['/resources?view=wellbeing', 'resources-wellbeing'], ['/journal?t=piano', 'journal-plan'],
    ['/chat?tab=social', 'chat-social'], ['/chat?tab=competizioni', 'competitions'],
    ['/settings?section=trading', 'settings-trading'], ['/settings?section=abbonamento', 'settings-billing'],
    ['/billing/return', 'billing-return'], ['/welcome', 'welcome'], ['/sandbox', 'sandbox'],
    ['/admin/candidature', 'admin-applications'], ['/admin/scuole', 'admin-schools'], ['/admin/users', 'admin-users'],
    ['/admin/trading', 'admin-trading'], ['/admin/content', 'admin-content'], ['/admin/reviews', 'admin-reviews'],
    ['/admin/subscriptions', 'admin-subscriptions'], ['/admin/support', 'admin-support'], ['/admin/support/tickets', 'admin-tickets'],
    ['/admin/system', 'admin-system'], ['/admin/security', 'admin-security'],
  ]) await inspect(path, label);
  await check('Mobile menu reaches secondary destinations and restores focus', async () => {
    await go('/');
    const nav = page.locator('[data-mobile-navigation]');
    assert.equal(await nav.locator('a').count(), 3);
    assert.deepEqual(await nav.locator('a').allTextContents(), ['Oggi', 'Metodo', 'Diario']);
    await nav.getByRole('button').tap();
    const menu = page.getByRole('menu');
    await menu.waitFor();
    await viewportBounds(menu);
    for (const href of ['/resources', '/backtest', '/academy', '/milestones', '/chat', '/patrimonio', '/settings', '/support']) {
      assert.ok(await menu.locator(`a[href="${href}"]`).isVisible(), href);
    }
    await page.keyboard.press('Escape');
    assert.equal(await nav.getByRole('button').evaluate(el => document.activeElement === el), true);
  });
  await check('Cockpit preserves form values when changing mobile panel and rotating', async () => {
    await go('/');
    const select = page.locator('.ck-process select').first();
    await select.selectOption({ index: 1 });
    const value = await select.inputValue();
    await page.locator('.ck-mobile-tabs button').nth(1).tap();
    assert.equal(await page.locator('.ck-process').isVisible(), false);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.ck-mobile-tabs button').first().tap();
    assert.equal(await select.inputValue(), value);
    // Risk is a dialog over the selected panel, not a third layout state.
    await page.locator('.ck-mobile-tabs button').last().tap();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ck-process').isVisible(), true);
  });
  await check('Admin filters collapse without losing the search', async () => {
    await go('/admin/users');
    const filters = page.locator('.filter-panel');
    await filters.locator('summary').tap();
    await filters.locator('input').fill('Mobile');
    await filters.locator('summary').tap();
    await filters.locator('summary').tap();
    assert.equal(await filters.locator('input').inputValue(), 'Mobile');
    await page.setViewportSize({ width: 1024, height: 900 });
    assert.ok(await filters.locator('input').isVisible());
    assert.equal(await filters.locator('input').inputValue(), 'Mobile');
    await page.setViewportSize({ width: 390, height: 844 });
  });
  const created = await apiFromPage(page, '/api/backtest/sessions', { method: 'POST', body: JSON.stringify({ name: `Mobile audit ${Date.now()}`, pair: 'EUR/USD', timeframe: 'H1' }) });
  assert.equal(created.status, 200, 'synthetic replay session created');
  const session = created.body;
  const candles = Array.from({ length: 600 }, (_, i) => ({ time: 1756684800 + i * 3600, open: 1.1 + i * .00001, high: 1.1001 + i * .00001, low: 1.0999 + i * .00001, close: 1.1 + i * .00001, volume: 100 }));
  await page.route('**/api/backtest/candles?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candles, source: 'synthetic-mobile-audit' }) }));
  await page.route('**/api/backtest/candles/meta?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ symbol: 'EURUSD', warehouseEnabled: false, warehouse: null }) }));
  const replayPath = `/backtest/${session.id}/replay`;
  const state = () => page.evaluate(id => JSON.parse(localStorage.getItem(`traderloading:backtest-terminal:backtest-session-${id}`)), session.id);
  await check('Portrait replay advances and every header action is reachable', async () => {
    await go(replayPath);
    await page.getByTestId('backtest-terminal').waitFor();
    await page.waitForFunction(id => Boolean(localStorage.getItem(`traderloading:backtest-terminal:backtest-session-${id}`)), session.id);
    await page.locator('.btm-center .btm-spin').waitFor({ state: 'hidden' });
    const before = await state();
    await page.getByRole('button', { name: 'Avanti di una candela', exact: true }).tap();
    assert.ok((await state()).cursorTime > before.cursorTime);
    for (const button of await page.locator('.btm-chips button').all()) await viewportBounds(button);
    const chart = await page.locator('.btm-chartwrap').boundingBox();
    assert.ok(chart.height > 200, `chart too short: ${chart.height}`);
    await page.screenshot({ path: new URL('replay-portrait.png', out).pathname });
  });
  await check('Replay tools open, select a drawing tool, and return to chart', async () => {
    const toggle = page.locator('.btm-mobile-tools-toggle');
    await toggle.tap();
    const rail = page.locator('#replay-drawing-tools');
    assert.ok(await rail.isVisible());
    await rail.getByRole('button', { name: 'Linea orizzontale', exact: true }).tap();
    assert.equal(await rail.isVisible(), false);
    const box = await page.locator('.btm-drawoverlay').boundingBox();
    await page.touchscreen.tap(box.x + box.width * .5, box.y + box.height * .5);
    assert.ok((await state()).drawings.length > 0);
  });
  await check('Replay order panel fits portrait, traps focus, and saves one trade', async () => {
    await page.getByRole('button', { name: 'Pannello ordini', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await viewportBounds(dialog);
    const buy = dialog.getByRole('button', { name: 'BUY', exact: true });
    await buy.tap();
    await dialog.getByRole('button', { name: 'Chiudi a mercato (C)', exact: true }).tap();
    await page.waitForTimeout(500);
    const trades = await apiFromPage(page, `/api/backtest/sessions/${session.id}/trades`);
    assert.equal(trades.status, 200);
    assert.equal(trades.body.length, 1);
    await page.screenshot({ path: new URL('replay-orders.png', out).pathname });
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.ok(page.url().endsWith(replayPath), 'Escape closes panel without exiting replay');
  });
  await check('Replay settings and all tabs fit the portrait viewport', async () => {
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await viewportBounds(dialog);
    for (const tab of await dialog.getByRole('tab').all()) {
      await tab.tap();
      assert.ok(await tab.isVisible());
    }
    await page.screenshot({ path: new URL('replay-settings.png', out).pathname });
    await page.keyboard.press('Escape');
  });
  for (const [width, height] of [[320, 740], [360, 800], [430, 932], [844, 390], [1023, 900], [1024, 900], [1440, 900]]) {
    await check(`Replay has a usable chart and transport at ${width}×${height}`, async () => {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      const chart = await page.locator('.btm-chartwrap').boundingBox();
      assert.ok(chart.width >= 200 && chart.height >= 100, JSON.stringify(chart));
      await viewportBounds(page.locator('.btm-transport'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: new URL(`replay-${width}x${height}.png`, out).pathname });
    });
  }
  // The same test account remains synthetic; only its preferences are changed.
  for (const lang of ['it', 'en', 'es', 'fr', 'de']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(lang => localStorage.setItem('tl_language', lang), lang);
    await inspect('/settings', `settings-${lang}`);
    await check(`Inputs use a readable font in ${lang}`, async () => {
      const sizes = await page.locator('input:not([type=hidden]), textarea, select').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => parseFloat(getComputedStyle(el).fontSize)));
      assert.ok(sizes.every(size => size >= 16));
    });
  }
  await context.clearCookies();
  for (const lang of ['it', 'en', 'es', 'fr', 'de']) await inspect(lang === 'en' ? '/' : `/${lang}`, `public-${lang}`);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await inspect('/it', `public-${width}`);
  }
}
