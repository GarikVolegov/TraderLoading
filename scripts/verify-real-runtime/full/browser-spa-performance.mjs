import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { root, run, base, database, connect } from './env.mjs';

process.env.VERIFY_BASE_URL = base;
process.env.VERIFY_DATABASE_URL = `postgres://trader:trader@127.0.0.1:55432/${database}`;
const { clerkUserId, signIn, dismiss, loadEnvLocal } = await import('../../verify-usability/lib/common.mjs');
assert.match(loadEnvLocal().CLERK_SECRET_KEY, /^sk_test_/);
const executionId = `spa-performance-${Date.now()}-${randomUUID().slice(0, 8)}`;
const output = `${run.output}/${executionId}`;
mkdirSync(output, { recursive: true });
const report = {
  runId: run.runId, executionId, startedAt: new Date().toISOString(),
  mode: 'Production frontend and API on isolated port 3002; real Clerk Development authentication',
  viewport: { width: 1440, height: 1000 }, timezone: 'Europe/Rome',
  measurement: {
    cycles: 10, routesPerCycle: 6, explicitWarmupCycles: 1,
    start: 'Immediately before the real anchor click',
    end: 'Route-specific loaded content and enabled controls, completed inline entrance fades, no visible modal, followed by two animation frames',
    excludes: ['Authentication and initial full-page loads', 'Explicit lazy-chunk/query warm-up', 'Settings support-section preparation, recorded separately', 'External market providers'],
    percentile: 'Nearest rank: sorted values[ceil(0.95 * count) - 1]',
    latencyTargetMs: 1000, targetIsPassAssertion: false,
    noReloadProof: 'A document-scoped random sentinel and the initial performance.timeOrigin must remain identical after every navigation; main-frame document requests are also recorded',
    supportNavigation: 'The real Supporto & Aiuto settings section contains a[href="/support"]. Support has no desktop sidebar slot. Its link click is measured; opening that section is reported separately.',
    journalNavigation: 'The sidebar /journal link opens the overview; its recent synthetic entries must be rendered from the existing 10,000-row dataset.',
    cachedViewPolicy: 'After explicit warm-up, cached loaded data is usable while normal background refetches continue. A completed refetch is not required before the view becomes usable.',
    expectedDomainResponse: 'This dataset has no closed trades with R. POST /journal/risk-of-ruin may therefore return its documented 422 insufficient-sample response. The exact server message and the explicit insufficient-data UI state are verified; this is not treated as a successful risk calculation or as an unexpected API failure.',
    traceRecording: false,
  },
  dataset: null, warmup: [], samples: [], summaries: {}, errors: [], apiErrors: [],
  requests: [], failedRequests: [], excludedProviderRequests: [], documentRequests: [],
  expectedApiStates: [], unexpectedApiErrors: [], status: 'running',
};
const flush = () => writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
const statistics = values => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    count: sorted.length, minMs: sorted[0], maxMs: sorted.at(-1),
    meanMs: values.reduce((total, value) => total + value, 0) / values.length,
    medianMs: sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    observationsWithin1000Ms: values.filter(value => value <= 1000).length,
  };
};
const db = await connect();
const req = createRequire(`${root}artifacts/trader-dashboard/package.json`);
const browser = await chromium.launch({ headless: true, executablePath: req('puppeteer').executablePath() });
const context = await browser.newContext({ viewport: report.viewport, locale: 'it-IT', timezoneId: report.timezone, serviceWorkers: 'block' });
await context.addInitScript(() => {
  localStorage.setItem('tl_language', 'it');
  localStorage.setItem('tl_cookie_consent_v1', 'declined');
  sessionStorage.setItem('tl_checklist_setup_dismissed_session_v1', '1');
  sessionStorage.setItem('tl_review_prompt_shown', '1');
  const today = new Date();
  // SessionCheckinModal uses the local, unpadded, zero-based-month key.
  // Suppress this unrelated periodic prompt in this disposable browser only.
  localStorage.setItem(`tl_checked_sessions_${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`, JSON.stringify(['Asiatica', 'Londinese', 'New York', 'Conferma Vol.']));
});
const page = await context.newPage();
page.setDefaultTimeout(45000);
let phase = 'setup';
let scenario = null;
let initialDocument = null;
const responseTasks = new Set();
const initialData = new Map();
const dataPaths = new Set(['/api/profile', '/api/journal', '/api/backtest/sessions', '/api/library/contents', '/api/wiki/sources', '/api/support/tickets']);
const isProviderPath = path => path === '/api/calendar' || path === '/api/news' || path.startsWith('/api/news/') || path.startsWith('/api/tools/') || path.startsWith('/api/market/');
// Abort excluded requests before they can invoke an external provider. No
// fabricated successful API responses are used anywhere in this benchmark.
await page.route(`${base}/api/**`, async route => {
  const path = new URL(route.request().url()).pathname;
  if (isProviderPath(path)) {
    report.excludedProviderRequests.push({ phase, scenario, method: route.request().method(), path, action: 'aborted before server/provider access' });
    await route.abort('blockedbyclient');
  } else {
    await route.continue();
  }
});
page.on('pageerror', error => report.errors.push({ phase, scenario, message: error.message.slice(0, 1200) }));
page.on('request', request => {
  if (phase !== 'setup' && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
    report.documentRequests.push({ phase, scenario, path: new URL(request.url()).pathname });
  }
});
page.on('requestfailed', request => {
  const url = new URL(request.url());
  if (url.origin === base && url.pathname.startsWith('/api/') && !isProviderPath(url.pathname) && phase !== 'setup') {
    report.failedRequests.push({ phase, scenario, method: request.method(), path: url.pathname, error: request.failure()?.errorText });
  }
});
page.on('response', response => {
  const url = new URL(response.url());
  if (url.origin !== base || !url.pathname.startsWith('/api/')) return;
  const requestPhase = phase;
  const record = { phase: requestPhase, scenario, method: response.request().method(), path: url.pathname, status: response.status(), provenance: 'api' };
  report.requests.push(record);
  if (requestPhase !== 'setup' && response.status() >= 400) report.apiErrors.push(record);
  if (requestPhase !== 'setup' && url.pathname === '/api/journal/risk-of-ruin' && response.request().method() === 'POST' && response.status() === 422) {
    const task = response.json().then(body => {
      if (report.dataset?.allJournalRowsHaveResultNone && body?.error === 'Servono trade chiusi con R calcolabile (entry, stop ed exit).') {
        record.expectedDomainState = 'insufficient_closed_trades_with_R';
        report.expectedApiStates.push(record);
      }
    }).catch(() => {}).finally(() => responseTasks.delete(task));
    responseTasks.add(task);
  }
  if (requestPhase === 'measured' || response.request().method() !== 'GET' || response.status() !== 200 || !dataPaths.has(url.pathname)) return;
  const task = response.json().then(body => {
    initialData.set(url.pathname, {
      count: Array.isArray(body) ? body.length : null,
      firstTitle: Array.isArray(body) ? body[0]?.title ?? body[0]?.name ?? body[0]?.subject ?? null : null,
      ...(url.pathname === '/api/profile' ? { level: body.level } : {}),
      ...(url.pathname === '/api/library/contents' && Array.isArray(body)
        ? { items: body.map(item => ({ title: item.title, requiredLevel: item.requiredLevel })) }
        : {}),
    });
  }).catch(() => {}).finally(() => responseTasks.delete(task));
  responseTasks.add(task);
});

const enabled = async locator => {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isEnabled(), true, 'A required view control is disabled');
  return locator;
};
const fullyPainted = async locator => {
  await locator.waitFor({ state: 'visible' });
  const element = await locator.elementHandle();
  assert.ok(element, 'Missing readiness element');
  await page.waitForFunction(node => {
    for (let ancestor = node; ancestor instanceof Element; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      // Locked groups intentionally have a static CSS opacity of 0.7. Wait
      // only for inline motion fades; a deliberate muted style is usable.
      if ((ancestor.style.opacity !== '' && Number(ancestor.style.opacity) < 0.98) || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }, element);
  await element.dispose();
};
const sidebar = () => page.locator('nav').filter({ visible: true }).last();
const ready = {
  journal: async () => {
    await enabled(page.getByRole('button', { name: 'Nuovo Trade', exact: true }).first());
    await fullyPainted(page.getByText(/^Synthetic Perf \d+$/).first());
    await fullyPainted(page.getByText('Servono più trade chiusi con stop per simulare.', { exact: true }));
    return 'Nuovo Trade enabled, recent Synthetic Perf entry rendered, and risk simulation explicitly reports insufficient closed trades with R';
  },
  library: async () => {
    await page.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor();
    const data = initialData.get('/api/library/contents');
    assert.ok(data, 'Library API warm-up has not completed');
    const level = initialData.get('/api/profile')?.level;
    assert.equal(typeof level, 'number', 'Profile level must be loaded before evaluating library access');
    if (data.count === 0) {
      await fullyPainted(page.getByRole('heading', { name: 'Biblioteca in costruzione', exact: true }));
      return 'Library heading and server-confirmed empty state';
    }
    const unlocked = data.items.find(item => (item.requiredLevel ?? 0) <= level);
    if (unlocked) {
      await fullyPainted(page.getByRole('heading', { name: unlocked.title, exact: true }).first());
      return 'Library heading and a server-returned content card accessible at the loaded profile level';
    }
    const lockedLevel = data.items[0].requiredLevel;
    const lockedCount = data.items.filter(item => item.requiredLevel === lockedLevel).length;
    await fullyPainted(page.getByText(`${lockedCount} contenuti al livello ${lockedLevel}`, { exact: true }).first());
    return 'Library heading and a locked level group consistent with returned contents and profile level';
  },
  backtest: async () => {
    await enabled(page.getByRole('button', { name: 'Nuova Sessione', exact: true }).first());
    const data = initialData.get('/api/backtest/sessions');
    assert.ok(data, 'Backtest API warm-up has not completed');
    await fullyPainted(page.getByRole('heading', { name: data.count === 0 ? 'Nessuna sessione di backtest' : data.firstTitle, exact: true }).first());
    return data.count === 0 ? 'New-session control enabled and server-confirmed empty session list' : 'New-session control enabled and a saved session card';
  },
  wiki: async () => {
    await enabled(page.getByRole('button', { name: 'Aggiungi', exact: true }).first());
    await enabled(page.getByPlaceholder('Cerca per titolo o #tag…'));
    const data = initialData.get('/api/wiki/sources');
    assert.ok(data, 'Archive API warm-up has not completed');
    await fullyPainted(data.count === 0
      ? page.getByRole('heading', { name: 'Inizia il tuo archivio', exact: true })
      : page.getByText(data.firstTitle, { exact: true }).first());
    return data.count === 0 ? 'Archive add/search controls enabled and server-confirmed empty state' : 'Archive add/search controls enabled and a saved source card';
  },
  settings: async () => {
    await page.getByRole('heading', { name: 'Impostazioni', exact: true }).waitFor();
    await enabled(page.locator('input[type="range"]').filter({ visible: true }).first());
    await fullyPainted(page.getByRole('heading', { name: 'Audio Binaural', exact: true }).filter({ visible: true }).first());
    await page.getByText('Progressione XP', { exact: true }).filter({ visible: true }).first().waitFor();
    return 'Loaded profile XP panel and audio volume control available in default settings section';
  },
  support: async () => {
    await page.getByRole('heading', { name: 'Nuova richiesta', exact: true }).waitFor();
    await enabled(page.getByPlaceholder('Oggetto della richiesta'));
    await enabled(page.getByPlaceholder('Descrivi il problema nel dettaglio'));
    const data = initialData.get('/api/support/tickets');
    assert.ok(data, 'Support API warm-up has not completed');
    await fullyPainted(data.count === 0
      ? page.getByText('Non hai ancora richieste.', { exact: true })
      : page.locator('a[href^="/support/"]').getByText(data.firstTitle, { exact: true }).first());
    return data.count === 0 ? 'Ticket form enabled and server-confirmed empty ticket list' : 'Ticket form enabled and a saved ticket link';
  },
};
const destinations = [
  { name: 'journal', path: '/journal', dataPath: '/api/journal' },
  { name: 'library', path: '/library', dataPath: '/api/library/contents' },
  { name: 'backtest', path: '/backtest', dataPath: '/api/backtest/sessions' },
  { name: 'wiki', path: '/wiki', dataPath: '/api/wiki/sources' },
  { name: 'settings', path: '/settings' },
  { name: 'support', path: '/support', dataPath: '/api/support/tickets' },
];
const verifyDocument = async () => {
  const documentState = await page.evaluate(() => ({
    sentinel: window.__auditSpaSentinel?.nonce,
    sameObject: window.__auditSpaSentinel === window.__auditSpaSentinelReference,
    timeOrigin: performance.timeOrigin,
  }));
  assert.deepEqual(documentState, initialDocument, 'SPA navigation replaced the original document');
  assert.equal(report.documentRequests.length, 0, 'Unexpected main-frame document navigation');
  return documentState;
};
const navigate = async (destination, cycle) => {
  scenario = `${phase}:${cycle}:${destination.name}`;
  let preparationMs = 0;
  if (destination.name === 'support') {
    const preparationStart = performance.now();
    await page.getByRole('button', { name: /Supporto & Aiuto/ }).filter({ visible: true }).first().click();
    await page.locator('a[href="/support"]').filter({ visible: true }).first().waitFor();
    preparationMs = performance.now() - preparationStart;
  }
  const anchor = destination.name === 'support'
    ? page.locator('a[href="/support"]').filter({ visible: true }).first()
    : sidebar().locator(`a[href="${destination.path}"]`).first();
  await anchor.waitFor({ state: 'visible' });
  assert.equal(await anchor.getAttribute('href'), destination.path);
  assert.notEqual(new URL(page.url()).pathname, destination.path, 'Measurement must change routes');
  const apiReady = phase === 'warmup' && destination.dataPath
    ? page.waitForResponse(response => new URL(response.url()).pathname === destination.dataPath && response.request().method() === 'GET' && response.status() === 200)
    : null;
  const started = performance.now();
  await anchor.click();
  await page.waitForURL(url => url.pathname === destination.path);
  if (apiReady) {
    await apiReady;
    await Promise.all([...responseTasks]);
  }
  const readiness = await ready[destination.name]();
  assert.equal(await page.getByRole('dialog').filter({ visible: true }).count(), 0, 'A modal blocks the target view');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const usableMs = performance.now() - started;
  const documentState = await verifyDocument();
  const sample = { cycle, route: destination.name, path: destination.path, anchor: destination.path, navigationSurface: destination.name === 'support' ? 'settings support link' : 'desktop sidebar', usableMs, preparationMs, readiness, sentinelUnchanged: true, timeOrigin: documentState.timeOrigin };
  (phase === 'warmup' ? report.warmup : report.samples).push(sample);
  flush();
  console.log(`${phase} cycle=${cycle} route=${destination.name} usableMs=${usableMs.toFixed(1)}`);
};

try {
  const email = 'verify.perf+clerk_test@example.com';
  const uid = await clerkUserId(email);
  const counts = (await db.query("SELECT count(*)::int AS count, count(*) FILTER (WHERE result IS DISTINCT FROM 'none')::int AS other_results FROM journal_entries WHERE user_id=$1", [uid])).rows[0];
  const rows = Number(counts.count);
  assert.equal(rows, 10000, 'Expected the existing isolated 10,000-row performance dataset; refusing to reseed or silently measure a different dataset');
  assert.equal(counts.other_results, 0, 'Expected the existing unclosed synthetic journal dataset');
  const subscription = (await db.query('SELECT plan,status FROM admin_user_subscriptions WHERE user_id=$1', [uid])).rows[0];
  assert.equal(subscription?.plan, 'pro');
  assert.equal(subscription?.status, 'active');
  report.dataset = { syntheticIdentity: 'verify.perf+clerk_test@example.com', journalEntries: rows, allJournalRowsHaveResultNone: true, reusedExistingDataset: true, datasetMutations: false, plan: subscription.plan };
  await signIn(page, email);
  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
  await dismiss(page);
  await ready.settings();
  const nonce = randomUUID();
  initialDocument = await page.evaluate(value => {
    window.__auditSpaSentinel = { nonce: value };
    window.__auditSpaSentinelReference = window.__auditSpaSentinel;
    return { sentinel: value, sameObject: true, timeOrigin: performance.timeOrigin };
  }, nonce);
  report.document = initialDocument;
  phase = 'warmup';
  for (const destination of destinations) await navigate(destination, 0);
  await Promise.all([...responseTasks]);
  report.warmedApiData = Object.fromEntries(initialData);
  report.measurement.startedAt = new Date().toISOString();
  phase = 'measured';
  for (let cycle = 1; cycle <= 10; cycle++) {
    for (const destination of destinations) await navigate(destination, cycle);
  }
  report.measurement.finishedAt = new Date().toISOString();
  await verifyDocument();
  await Promise.all([...responseTasks]);
  assert.equal(report.samples.length, 60);
  assert.deepEqual(report.errors, [], 'Unexpected browser JavaScript errors');
  report.unexpectedApiErrors = report.apiErrors.filter(record => !record.expectedDomainState);
  assert.deepEqual(report.unexpectedApiErrors, [], 'Unexpected internal API error responses');
  assert.deepEqual(report.failedRequests, [], 'Unexpected failed internal API requests');
  for (const destination of destinations) {
    report.summaries[destination.name] = statistics(report.samples.filter(sample => sample.route === destination.name).map(sample => sample.usableMs));
  }
  report.summaries.overall = statistics(report.samples.map(sample => sample.usableMs));
  report.summaries.supportPreparation = statistics(report.samples.filter(sample => sample.route === 'support').map(sample => sample.preparationMs));
  report.status = 'verified';
  phase = 'post-measurement';
  await page.screenshot({ path: `${output}/final-support.png`, fullPage: false });
} catch (error) {
  report.status = 'failed';
  report.failure = { phase, scenario, message: error.message.slice(0, 2400) };
  await page.screenshot({ path: `${output}/failure.png`, fullPage: false }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.warmedApiData = Object.fromEntries(initialData);
  report.finishedAt = new Date().toISOString();
  flush();
  await browser.close();
  await db.end();
}
console.log(JSON.stringify({ status: report.status, executionId, output: `${output}/report.json`, samples: report.samples.length, summaries: report.summaries, failure: report.failure }, null, 2));
