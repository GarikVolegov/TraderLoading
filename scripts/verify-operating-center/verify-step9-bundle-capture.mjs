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
const port = 5212;
const out = '/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883/scratch/step9-bundle/';
mkdirSync(out, { recursive: true });

const server = await createServer({
  cacheDir: root + '.local-logs/verify-step9-vite',
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
    viewport: { width: 1440, height: 950 },
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();
    if (u.pathname === '/api/profile/integrity') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentGrade: 2,
          gradeNumber: 2,
          gradeRoman: 'II',
          gradeTitle: 'Il Custode della Regola',
          integrityIndex: 88,
          integrityIndexPct: 88,
          consecutiveIntegralSessions: 14,
        }),
      });
    }
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await context.routeWebSocket('**/api/**', (ws) => ws.close());

  const page = await context.newPage();

  console.log('Navigating to /resources...');
  await page.goto(`http://127.0.0.1:${port}/resources`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to Arsenal tab if not active
  const armoryTab = page.locator('button:has-text("Arsenale d\'Ordine")');
  if (await armoryTab.isVisible()) {
    await armoryTab.click();
    await page.waitForTimeout(500);
  }

  // Scroll down to ArsenalExpansionHub
  const hub = page.locator('[data-testid="arsenal-expansion-hub"]');
  if (await hub.isVisible()) {
    await hub.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: out + 'step9_resources_uniforme_bundle.png', fullPage: false });
  console.log('✓ Captured step9_resources_uniforme_bundle.png');

  // Click on "Ordina Set Completo" to open the modal
  const openModalBtn = page.locator('button:has-text("Ordina Set Completo")');
  if (await openModalBtn.isVisible()) {
    await openModalBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + 'step9_resources_uniforme_modal.png', fullPage: false });
    console.log('✓ Captured step9_resources_uniforme_modal.png');
  } else {
    console.warn('Modal button not found, searching by title...');
    const cardTitle = page.locator('h3:has-text("L\'Uniforme Completa d\'Ordine")');
    if (await cardTitle.isVisible()) {
      await cardTitle.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: out + 'step9_resources_uniforme_modal.png', fullPage: false });
    }
  }
} finally {
  await browser.close();
  await server.close();
}
