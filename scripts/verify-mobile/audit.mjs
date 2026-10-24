import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';
import { Client } from 'pg';

const root = new URL('../../', import.meta.url);
const phase = process.argv[2] || 'after';
const out = new URL(`artifacts.local/mobile/${phase}/`, root);
mkdirSync(out, { recursive: true });
const dbName = JSON.parse(readFileSync(new URL('.local-logs/runtime-db.json', root))).name;
assert.match(dbName, /^tl_audit_\d+$/);
process.env.VERIFY_BASE_URL = 'http://127.0.0.1:5182';
process.env.VERIFY_DATABASE_URL = `postgres://trader:trader@127.0.0.1:55432/${dbName}`;
const { signIn, ensureTestUser, completeOnboarding, apiFromPage } = await import('../verify-usability/lib/common.mjs');
const req = createRequire(new URL('artifacts/trader-dashboard/package.json', root));
const useWebKit = process.env.MOBILE_BROWSER === 'webkit';
const browser = useWebKit ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: req('puppeteer').executablePath() });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'it-IT', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addInitScript(() => {
  localStorage.setItem('tl_language', 'it');
  localStorage.setItem('tl_cookie_consent_v1', 'declined');
  sessionStorage.setItem('tl_review_prompt_shown', '1');
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const report = { phase, browser: `${useWebKit ? 'WebKit' : 'Chromium'} touch emulation (not a physical device)`, routes: [], checks: [], pageErrors: [] };
page.on('pageerror', e => report.pageErrors.push(e.message));
const base = process.env.VERIFY_BASE_URL;
async function inspect(path, label) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.trim().length > 80, null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    title: document.title, url: location.href, bodyText: document.body.innerText.slice(0, 200),
    overflow: [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).position === 'fixed') return false;
      // Report protruding elements only when no ancestor deliberately clips/scrolls them.
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowX)) return false;
      }
      return r.right > innerWidth + 2 || r.left < -2;
    }).slice(0, 15).map(el => ({ tag: el.tagName, class: String(el.className).slice(0, 160), text: el.textContent.slice(0, 60) }))
  }));
  await page.screenshot({ path: new URL(`${label}.png`, out).pathname, fullPage: true });
  report.routes.push({ path, label, ...metrics });
  console.log(label, metrics.scrollWidth, metrics.overflow.length);
}
try {
  if (!process.env.MOBILE_FLOWS_ONLY) for (const [path, label] of [['/it', 'landing'], ['/sign-in', 'sign-in'], ['/sign-up', 'sign-up'], ['/privacy', 'privacy'], ['/terms', 'terms']]) await inspect(path, label);
  const email = 'verify.mobile+clerk_test@example.com';
  const id = await ensureTestUser(email);
  const db = new Client({ connectionString: process.env.VERIFY_DATABASE_URL });
  await db.connect();
  await db.query("INSERT INTO admin_user_subscriptions(user_id,plan,status,reason) VALUES($1,'pro','active','Mobile isolated audit') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active'", [id]);
  await db.query("INSERT INTO admin_users(user_id, role, status) VALUES($1,'super_admin','active') ON CONFLICT(user_id) DO UPDATE SET role='super_admin',status='active'", [id]);
  await db.end();
  await signIn(page, email);
  await completeOnboarding(page);
  // Make the test profile pass nickname onboarding without touching personal data.
  await apiFromPage(page, '/api/profile', { method: 'PUT', body: JSON.stringify({ nickname: 'MobileAudit' }) });
  const routes = [['/', 'today'], ['/?vista=mercati', 'markets'], ['/?vista=notizie', 'news'], ['/?vista=strumenti', 'tools'], ['/method', 'method'], ['/journal', 'journal'], ['/resources', 'resources'], ['/backtest', 'backtest'], ['/academy', 'academy'], ['/wiki', 'wiki'], ['/milestones', 'milestones'], ['/chat', 'chat'], ['/patrimonio', 'financial'], ['/settings', 'settings'], ['/support', 'support'], ['/pro', 'pro'], ['/protocollo', 'protocollo'], ['/admin', 'admin']];
  if (!process.env.MOBILE_FLOWS_ONLY) for (const [path, label] of routes) await inspect(path, label);
  if (process.env.MOBILE_MATRIX === '1') {
    const { runFlows } = await import('./flows.mjs');
    await runFlows({ page, context, report, out, inspect, apiFromPage });
  }
} catch (e) {
  report.failure = e.stack;
  console.error(e.message);
  process.exitCode = 1;
} finally {
  writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2));
  await browser.close();
}
