import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createFixtures } from './fixtures.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const req = createRequire(root + 'artifacts/trader-dashboard/package.json');
const { createServer } = await import(pathToFileURL(req.resolve('vite')).href);
const puppeteer = req('puppeteer');

process.env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=';
const port = 5215;
const out = '/Users/gazz/.gemini/antigravity/brain/d1086003-629b-4418-8ea4-eb90b7ed5251/';
mkdirSync(out, { recursive: true });

const server = await createServer({
  cacheDir: root + '.local-logs/verify-step11-vite',
  configFile: root + 'artifacts/trader-dashboard/vite.config.ts',
  server: { host: '127.0.0.1', port, strictPort: true },
  resolve: {
    alias: [
      {
        find: '@clerk/react',
        replacement: fileURLToPath(new URL('./clerk-fixture.js', import.meta.url)),
      },
    ],
  },
});
await server.listen();

const browser = await chromium.launch({
  headless: true,
  executablePath: puppeteer.executablePath(),
});
const { handle } = createFixtures();

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });

  const financialProfile = {
    totalNetWorth: 50000,
    monthlyExpenses: 2000,
    liquidityMonthsCovered: 6,
    externalStableIncome: 2500,
    hasDependents: false,
    liquidityAllocation: 12000,
    reserveAllocation: 12000,
    tradingAllocation: 8000,
    investmentsAllocation: 14000,
    futureProjectsAllocation: 4000,
    accountObjective: "GROWTH",
    timeHorizonYears: 5,
    expectedMonthlyReturnPct: 3,
    simulatedDrawdownPct: 10,
    isCompleted: true,
    wealthSubAllocations: {
      equityAllocation: 7000,
      dividendsAllocation: 3500,
      cryptoAllocation: 1400,
      hedgingAllocation: 2100,
    },
    validatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await context.addInitScript((profile) => {
    localStorage.setItem('tl_cookie_consent_v1', 'accepted');
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('limen.financial_profile.v1', JSON.stringify(profile));
  }, financialProfile);

  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();

    if (u.pathname === '/api/financial-profile' || u.pathname === '/api/profile/financial') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(financialProfile) });
    }
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await context.routeWebSocket('**/api/**', (ws) => ws.close());

  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  console.log('Navigating to /patrimonio (Desktop)...');
  await page.goto(`http://127.0.0.1:${port}/patrimonio`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + 'step11_patrimonio_desktop.png', fullPage: true });
  console.log('Saved step11_patrimonio_desktop.png');

  const btnArias = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('aria-label') || b.innerText.slice(0, 30)));
  console.log('Page buttons:', btnArias);

  // Click info dossier button on Azioni & ETF and toggle to Benchmark & Factor Decomposition Tab
  console.log('Clicking equity dossier button via evaluate click...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Dossier e logica operativa: Azioni & ETF (Core)"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(700);

  const modalButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText));
  console.log('All buttons after click:', modalButtons.slice(-15));

    const benchmarkTabBtn = page.locator('[role="dialog"] button', { hasText: /Paniere/ });
    if (await benchmarkTabBtn.count() > 0) {
      await benchmarkTabBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: out + 'step11_patrimonio_factor_decomposition_modal.png', fullPage: true });
      console.log('Saved step11_patrimonio_factor_decomposition_modal.png');
    }

    // Toggle to Cross-Asset Rotation Tab
    const crossAssetTabBtn = page.locator('[role="dialog"] button', { hasText: /Rotazione Cross-Asset/ });
    if (await crossAssetTabBtn.count() > 0) {
      await crossAssetTabBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: out + 'step11_patrimonio_cross_asset_rotation_modal.png', fullPage: true });
      console.log('Saved step11_patrimonio_cross_asset_rotation_modal.png');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

  // Click info dossier button on Trading to verify Half-Kelly matrix
  const tradingDossierBtn = page.locator('button[aria-label="Dossier e logica operativa: Trading (Trans-Limen)"]');
  if (await tradingDossierBtn.count() > 0) {
    console.log('Found tradingDossierBtn, clicking...');
    await tradingDossierBtn.click({ force: true });
    await page.waitForTimeout(600);
    const kellyTabBtn = page.locator('[role="dialog"] button', { hasText: /Matrice Half-Kelly/ });
    if (await kellyTabBtn.count() > 0) {
      await kellyTabBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: out + 'step11_patrimonio_trading_kelly_modal.png', fullPage: true });
      console.log('Saved step11_patrimonio_trading_kelly_modal.png');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Click info dossier button on Dividendi to verify timing matrix modal
  const dividendDossierBtn = page.locator('button[aria-label="Dossier e logica operativa: Dividendi (Cash Flow)"]');
  if (await dividendDossierBtn.count() > 0) {
    console.log('Found dividendDossierBtn, clicking...');
    await dividendDossierBtn.click({ force: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: out + 'step11_patrimonio_timing_dossier.png', fullPage: true });
    console.log('Saved step11_patrimonio_timing_dossier.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Click 1A to capture monthly resolution view
  const btn1A = page.locator('button', { hasText: /^1A$/ });
  if (await btn1A.count() > 0) {
    await btn1A.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + 'step11_patrimonio_1y.png', fullPage: true });
    console.log('Saved step11_patrimonio_1y.png');
  }

  console.log('Testing Mobile viewport (375x812)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });
  await mobileContext.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();
    if (u.pathname === '/api/profile/financial') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(financialProfile) });
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await mobileContext.routeWebSocket('**/api/**', (ws) => ws.close());

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`http://127.0.0.1:${port}/patrimonio`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: out + 'step11_patrimonio_mobile.png', fullPage: true });
  console.log('Saved step11_patrimonio_mobile.png');

} finally {
  await browser.close();
  await server.close();
}
