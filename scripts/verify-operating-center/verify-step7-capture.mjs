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
const port = 5210;
const out = '/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883/scratch/step7-verify/';
mkdirSync(out, { recursive: true });

const server = await createServer({
  cacheDir: root + '.local-logs/verify-step7-vite',
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
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await context.routeWebSocket('**/api/**', (ws) => ws.close());
  await context.addInitScript(() => {
    localStorage.setItem('tl_language', 'it');
    localStorage.setItem('tl_cookie_consent_v1', 'declined');
    sessionStorage.setItem('tl_review_prompt_shown', '1');
    sessionStorage.setItem('tl_checklist_dismissed', '1');
    sessionStorage.setItem('tl_checklist_onboarding_done', '1');
  });

  const page = await context.newPage();
  const base = `http://127.0.0.1:${port}`;

  // 1. Journal Desktop
  console.log('Capturing Journal Desktop...');
  await page.goto(`${base}/journal`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}desktop-journal.png` });

  // 2. Milestones Desktop
  console.log('Capturing Milestones Desktop...');
  await page.goto(`${base}/milestones`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}desktop-milestones.png` });

  // 3. Resources Desktop
  console.log('Capturing Resources Desktop...');
  await page.goto(`${base}/resources`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}desktop-resources.png` });

  // 4. Mobile Journal
  console.log('Capturing Mobile Journal...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    isMobile: true,
    hasTouch: true,
  });
  await mobileContext.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();
    if (u.pathname.startsWith('/api/')) return handle(route);
    return route.continue();
  });
  await mobileContext.routeWebSocket('**/api/**', (ws) => ws.close());
  await mobileContext.addInitScript(() => {
    localStorage.setItem('tl_language', 'it');
    localStorage.setItem('tl_cookie_consent_v1', 'declined');
    sessionStorage.setItem('tl_review_prompt_shown', '1');
    sessionStorage.setItem('tl_checklist_dismissed', '1');
    sessionStorage.setItem('tl_checklist_onboarding_done', '1');
  });

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${base}/journal`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: `${out}mobile-journal.png` });

  console.log('Capture complete!');
} finally {
  await browser.close();
  await server.close();
}
