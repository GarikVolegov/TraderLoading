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
const port = 5214;
const out = '/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883/';
mkdirSync(out, { recursive: true });

const server = await createServer({
  cacheDir: root + '.local-logs/verify-step10-vite',
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

  const torneiCurrent = {
    season: {
      id: 1,
      label: 'STAGIONE I · PROVE DEL FUOCO',
      status: 'live',
      startsAt: '2026-01-01T08:00:00Z',
      endsAt: '2026-03-31T22:00:00Z',
    },
    progress: 0.68,
    enrolled: true,
    totalPlayers: 142,
  };

  const torneiStandings = {
    total: 142,
    metric: 'score',
    board: [
      {
        id: 1,
        rank: 1,
        prevRank: 1,
        displayName: 'Custode Primus',
        division: 'oro',
        rCum: 24.5,
        discIndex: 100,
        score: 99.2,
        me: true,
      },
      {
        id: 2,
        rank: 2,
        prevRank: 3,
        displayName: 'Marcus Aurelius',
        division: 'argento',
        rCum: 19.8,
        discIndex: 96,
        score: 92.4,
        me: false,
      },
      {
        id: 3,
        rank: 3,
        prevRank: 2,
        displayName: 'Valerius Flaccus',
        division: 'bronzo',
        rCum: 15.2,
        discIndex: 94,
        score: 87.1,
        me: false,
      },
      {
        id: 4,
        rank: 4,
        prevRank: 5,
        displayName: 'Lucius Varo',
        division: 'bronzo',
        rCum: 12.0,
        discIndex: 91,
        score: 81.3,
        me: false,
      },
    ],
    dq: [
      {
        id: 99,
        displayName: 'Impulsivus Trader',
        division: 'bronzo',
        rCum: -8.4,
        discIndex: 32,
        reason: 'Superamento limite di perdita giornaliera (Violazione Vincolo 1:1)',
      },
    ],
  };

  const torneiMe = {
    enrolled: true,
    standing: {
      rank: 1,
      prevRank: 1,
      displayName: 'Custode Primus',
      division: 'oro',
      rCum: 24.5,
      discIndex: 100,
      score: 99.2,
    },
    nextDivision: 'diamante',
    certificates: [
      {
        id: 1,
        tier: 'champion',
        edition: '01 / 01',
        rarity: 'Sovrano Oro Madeira',
        seasonLabel: 'STAGIONE I',
        mintStatus: 'claimable',
      },
      {
        id: 2,
        tier: 'podio',
        edition: '02 / 10',
        rarity: 'Argento Antico',
        seasonLabel: 'STAGIONE PRELIMINARE',
        mintStatus: 'minted',
      },
    ],
  };

  const torneiHall = {
    entries: [
      {
        id: 1,
        champion: 'Custode Primus',
        rCum: 24.5,
        discIndex: 100,
        seasonLabel: 'STAGIONE PRELIMINARE',
        startsAt: '2025-10-01T08:00:00Z',
        endsAt: '2025-12-31T22:00:00Z',
      },
    ],
  };

  const torneiWallet = {
    walletAddress: '0x71C2834d5885e347E280C56fEbEbE79148d249A1',
    mintEnabled: true,
  };

  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();

    if (u.pathname === '/api/tornei/current') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiCurrent) });
    }
    if (u.pathname === '/api/tornei/standings') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiStandings) });
    }
    if (u.pathname === '/api/tornei/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiMe) });
    }
    if (u.pathname === '/api/tornei/hall') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiHall) });
    }
    if (u.pathname === '/api/tornei/wallet') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiWallet) });
    }
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await context.routeWebSocket('**/api/**', (ws) => ws.close());

  const page = await context.newPage();

  console.log('Navigating to /chat?t=competizioni (Desktop Arena)...');
  await page.goto(`http://127.0.0.1:${port}/chat?t=competizioni`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + 'step10_tornei_arena.png', fullPage: true });
  console.log('Saved step10_tornei_arena.png');

  console.log('Navigating to Percorso tab...');
  await page.goto(`http://127.0.0.1:${port}/chat?t=competizioni&vista=percorso`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + 'step10_tornei_percorso.png', fullPage: true });
  console.log('Saved step10_tornei_percorso.png');

  // Mobile viewport
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
    if (u.pathname === '/api/tornei/current') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiCurrent) });
    if (u.pathname === '/api/tornei/standings') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiStandings) });
    if (u.pathname === '/api/tornei/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiMe) });
    if (u.pathname === '/api/tornei/hall') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiHall) });
    if (u.pathname === '/api/tornei/wallet') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(torneiWallet) });
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await mobileContext.routeWebSocket('**/api/**', (ws) => ws.close());

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`http://127.0.0.1:${port}/chat?t=competizioni`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: out + 'step10_tornei_mobile.png', fullPage: true });
  console.log('Saved step10_tornei_mobile.png');

} finally {
  await browser.close();
  await server.close();
}
