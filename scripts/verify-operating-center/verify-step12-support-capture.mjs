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
const port = 5216;
const out = '/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883/';
mkdirSync(out, { recursive: true });

const server = await createServer({
  cacheDir: root + '.local-logs/verify-step12-vite',
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

  const tickets = [
    {
      id: 1,
      subject: "Attestato d'Investitura Grado I · Convalida Registri",
      status: "open",
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();

    if (u.pathname === '/api/support/tickets') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tickets) });
    }
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await context.routeWebSocket('**/api/**', (ws) => ws.close());

  const page = await context.newPage();

  console.log('Navigating to /support (Desktop)...');
  await page.goto(`http://127.0.0.1:${port}/support`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + 'step12_support_desktop.png', fullPage: true });
  console.log('Saved step12_support_desktop.png');

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
    if (u.pathname === '/api/support/tickets') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tickets) });
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await mobileContext.routeWebSocket('**/api/**', (ws) => ws.close());

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`http://127.0.0.1:${port}/support`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: out + 'step12_support_mobile.png', fullPage: true });
  console.log('Saved step12_support_mobile.png');

} finally {
  await browser.close();
  await server.close();
}
