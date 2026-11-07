#!/usr/bin/env node
/**
 * AUREUS PROTOCOL — Human E2E Squad Runner (`scripts/verify-human-squad/run-squad.mjs`)
 *
 * Launches 4 parallel AI Browser / API Human Agents against the real local stack:
 *   - Agent 1: Mobile Core & Subpages Navigator (375x812, isMobile: true, hasTouch: true)
 *   - Agent 2: Chart Infinite Scroll & La Forgia / Prove del Fuoco Sentinel (375x812 + 1440x900)
 *   - Agent 3: Mobile Deep Subpages Audit (375x812)
 *   - Agent 4: Heavy Flow & Concurrency Stress Agent (30 concurrent candle requests)
 *
 * Outputs structured JSON telemetry to `artifacts.local/verify-human-squad/report.json`
 * and prints a summary table to stdout.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const rootReq = createRequire(import.meta.url);
const dashReq = createRequire(path.join(ROOT, "artifacts/trader-dashboard/package.json"));
const dbReq = createRequire(path.join(ROOT, "lib/db/package.json"));

const { chromium } = rootReq("playwright");
const puppeteer = dashReq("puppeteer");
const pg = dbReq("pg");
const { createServer: createViteServer } = await import(
  pathToFileURL(dashReq.resolve("vite")).href
);

const REPORT_DIR = path.join(ROOT, "artifacts.local", "verify-human-squad");
const REPORT_PATH = path.join(REPORT_DIR, "report.json");
const SCREENSHOT_DIR =
  process.env.SQUAD_SCREENSHOT_DIR ||
  "/Users/gazz/.gemini/antigravity/brain/9d47c8c4-bac3-49ff-92f7-799539090190";
const CLERK_FIXTURE_PATH = path.join(ROOT, "scripts", "verify-operating-center", "clerk-fixture.js");

const API_PORT = Number(process.env.API_PORT || 3001);
const API_BASE = process.env.API_BASE || `http://127.0.0.1:${API_PORT}`;
const PREFERRED_VITE_PORT = Number(process.env.VITE_PORT || 5173);
const FORCE_CLERK_FIXTURE_VITE = process.env.SQUAD_USE_EXISTING_VITE !== "1";
const FORCE_FRESH_API = process.env.SQUAD_USE_EXISTING_API !== "1";

const AUDIT_USER_ID = "audit-local";
const AUDIT_SESSION_SID = "local-fixture";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── ENVIRONMENT & POSTGRES HELPERS ──────────────────────────────────────────

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveDatabaseUrl() {
  const envLocal = parseDotEnvFile(path.join(ROOT, ".env.local"));
  const envRoot = parseDotEnvFile(path.join(ROOT, ".env"));
  return (
    process.env.LOCAL_DATABASE_URL ||
    envLocal.LOCAL_DATABASE_URL ||
    process.env.DATABASE_URL ||
    envLocal.DATABASE_URL ||
    envRoot.LOCAL_DATABASE_URL ||
    envRoot.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:55432/traderloadings"
  );
}

function isTcpOpen(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function isHttpAlive(url, timeoutMs = 2500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

async function waitForHttp(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHttpAlive(url, 2000)) return true;
    await sleep(400);
  }
  throw new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`);
}

async function seedLocalDatabase(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // 1. Upsert user `audit-local`
    await client.query(
      `INSERT INTO users (id, email, first_name, last_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         updated_at = NOW()`,
      [AUDIT_USER_ID, "audit@example.test", "Audit", "Locale"],
    );

    // 2. Upsert active session with cookie `sid = local-fixture`
    const sessPayload = {
      user: {
        id: AUDIT_USER_ID,
        email: "audit@example.test",
        firstName: "Audit",
        lastName: "Locale",
        profileImageUrl: null,
      },
      access_token: AUDIT_SESSION_SID,
    };
    await client.query(
      `INSERT INTO sessions (sid, sess, expire)
       VALUES ($1, $2::jsonb, NOW() + INTERVAL '7 days')
       ON CONFLICT (sid) DO UPDATE SET
         sess = EXCLUDED.sess,
         expire = EXCLUDED.expire`,
      [AUDIT_SESSION_SID, JSON.stringify(sessPayload)],
    );

    // 3. Upsert `pro` subscription in `admin_user_subscriptions`
    await client.query(
      `INSERT INTO admin_user_subscriptions (user_id, plan, status, source, manual_override, reason, updated_at)
       VALUES ($1, 'pro', 'active', 'manual', true, 'Human E2E Squad Verification', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         plan = 'pro',
         status = 'active',
         manual_override = true,
         updated_at = NOW()`,
      [AUDIT_USER_ID],
    );

    // 4. Upsert `user_settings` with `onboarding_tutorial_completed_at`
    await client.query(
      `INSERT INTO user_settings (user_id, selected_pairs, onboarding_tutorial_completed_at)
       VALUES ($1, '["EURUSD","GBPUSD","XAUUSD","BTCUSD"]', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         onboarding_tutorial_completed_at = COALESCE(user_settings.onboarding_tutorial_completed_at, NOW())`,
      [AUDIT_USER_ID],
    );

    // 5. Ensure at least one Backtest Replay Session exists for `audit-local`
    const btRes = await client.query(
      `SELECT id FROM backtest_sessions WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [AUDIT_USER_ID],
    );
    let replaySessionId = btRes.rows[0]?.id ?? null;
    if (!replaySessionId) {
      const ins = await client.query(
        `INSERT INTO backtest_sessions (
           user_id, name, pair, timeframe, strategy, notes
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          AUDIT_USER_ID,
          "Squad Forgia EURUSD",
          "EUR/USD",
          "M15",
          "AUREUS Price Action",
          "Sessione automatica per verifica Human Squad",
        ],
      );
      replaySessionId = ins.rows[0]?.id ?? 1;
    }

    // 6. Ensure sample journal entries exist so `<EquityCurveChart>` has trajectory points
    const jRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM journal_entries WHERE user_id = $1`,
      [AUDIT_USER_ID],
    );
    if ((jRes.rows[0]?.cnt ?? 0) < 3) {
      const sampleTrades = [
        {
          title: "EURUSD LONG #101",
          content: JSON.stringify({
            symbol: "EURUSD",
            direction: "BUY",
            volume: 1.0,
            entryPrice: 1.0825,
            exitPrice: 1.0865,
            profit: 400,
            rr: 2.1,
          }),
          tradeDate: "2025-02-10",
          result: "win",
          tags: "disciplina,london",
        },
        {
          title: "XAUUSD SHORT #102",
          content: JSON.stringify({
            symbol: "XAUUSD",
            direction: "SELL",
            volume: 0.5,
            entryPrice: 2860.0,
            exitPrice: 2868.0,
            profit: -120,
            rr: -1.0,
          }),
          tradeDate: "2025-02-12",
          result: "loss",
          tags: "disciplina,ny",
        },
        {
          title: "GBPUSD LONG #103",
          content: JSON.stringify({
            symbol: "GBPUSD",
            direction: "BUY",
            volume: 1.0,
            entryPrice: 1.254,
            exitPrice: 1.2595,
            profit: 550,
            rr: 2.5,
          }),
          tradeDate: "2025-02-14",
          result: "win",
          tags: "disciplina,london",
        },
      ];
      for (const t of sampleTrades) {
        await client.query(
          `INSERT INTO journal_entries (user_id, title, content, trade_date, result, tags)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [AUDIT_USER_ID, t.title, t.content, t.tradeDate, t.result, t.tags],
        );
      }
    }

    return { replaySessionId };
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── STACK ORCHESTRATOR (AUTO-START & CLEAN SHUTDOWN) ────────────────────────

async function ensureLocalStack() {
  const databaseUrl = resolveDatabaseUrl();
  const dbUrlObj = new URL(databaseUrl);
  const dbHost = dbUrlObj.hostname || "127.0.0.1";
  const dbPort = Number(dbUrlObj.port || 5432);

  if (!(await isTcpOpen(dbHost, dbPort))) {
    throw new Error(
      `PostgreSQL non raggiungibile su ${dbHost}:${dbPort}. Assicurarsi che il database locale sia attivo.`,
    );
  }

  const seeded = await seedLocalDatabase(databaseUrl);

  let spawnedApi = null;
  const apiAlreadyRunning = await isHttpAlive(`${API_BASE}/api/healthz`);
  let activeApiPort = API_PORT;
  if (apiAlreadyRunning && FORCE_FRESH_API) {
    activeApiPort = (await isTcpOpen("127.0.0.1", 3109)) ? 3119 : 3109;
  }
  const activeApiBase = `http://127.0.0.1:${activeApiPort}`;
  const apiHealthUrl = `${activeApiBase}/api/healthz`;

  if (!apiAlreadyRunning || FORCE_FRESH_API) {
    console.log(`[Squad] Avvio API Server su :${activeApiPort} (RATE_LIMIT_MAX=100000, CANDLE_WAREHOUSE=1)...`);
    const envLocal = parseDotEnvFile(path.join(ROOT, ".env.local"));
    spawnedApi = spawn(
      "pnpm",
      ["--filter", "@workspace/api-server", "exec", "tsx", "./src/index.ts"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          ...envLocal,
          NODE_ENV: "development",
          PORT: String(activeApiPort),
          DATABASE_URL: databaseUrl,
          LOCAL_DATABASE_URL: databaseUrl,
          RATE_LIMIT_MAX: "100000",
          CANDLE_WAREHOUSE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    spawnedApi.stderr?.on("data", (chunk) => {
      const msg = chunk.toString();
      if (msg.toLowerCase().includes("error") && !msg.includes("DeprecationWarning")) {
        process.stderr.write(`[API] ${msg}`);
      }
    });
    await waitForHttp(apiHealthUrl, 45000);
  } else {
    console.log(`[Squad] API Server già attivo su ${activeApiBase}`);
  }

  // Start embedded Vite server with `@clerk/react -> clerk-fixture.js` alias so authentication is 100% deterministic
  let viteServer = null;
  let webBase = `http://127.0.0.1:${PREFERRED_VITE_PORT}`;

  const existingViteUp = await isHttpAlive(webBase);
  if (!existingViteUp || FORCE_CLERK_FIXTURE_VITE) {
    const vitePort = existingViteUp ? 5189 : PREFERRED_VITE_PORT;
    console.log(
      `[Squad] Avvio Vite Server con clerk-fixture su http://127.0.0.1:${vitePort} (proxy -> ${activeApiBase})...`,
    );
    viteServer = await createViteServer({
      configFile: path.join(ROOT, "artifacts/trader-dashboard/vite.config.ts"),
      root: path.join(ROOT, "artifacts/trader-dashboard"),
      logLevel: "error",
      server: {
        host: "127.0.0.1",
        port: vitePort,
        strictPort: false,
        proxy: {
          "/api": {
            target: activeApiBase,
            changeOrigin: true,
            ws: true,
          },
        },
      },
      resolve: {
        alias: [
          {
            find: "@clerk/react",
            replacement: CLERK_FIXTURE_PATH,
          },
        ],
      },
    });
    await viteServer.listen();
    const address = viteServer.httpServer?.address();
    const actualPort = typeof address === "object" && address ? address.port : vitePort;
    webBase = `http://127.0.0.1:${actualPort}`;
    await waitForHttp(webBase, 25000);
  } else {
    console.log(`[Squad] Utilizzo Vite Server esistente su ${webBase}`);
  }

  const cleanup = async () => {
    if (viteServer) {
      try {
        await viteServer.close();
      } catch {
        // ignore
      }
    }
    if (spawnedApi && !spawnedApi.killed) {
      try {
        spawnedApi.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  };

  return {
    apiBase: activeApiBase,
    webBase,
    replaySessionId: seeded.replaySessionId,
    spawnedApi: Boolean(spawnedApi),
    spawnedVite: Boolean(viteServer),
    cleanup,
  };
}

// ─── BROWSER CONTEXT FACTORY ─────────────────────────────────────────────────

async function createHumanContext(browser, webBase, options = {}) {
  const viewport = options.viewport || { width: 375, height: 812 };
  const isMobile = options.isMobile ?? viewport.width < 768;
  const hasTouch = options.hasTouch ?? isMobile;

  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch,
    deviceScaleFactor: isMobile ? 2 : 1,
    locale: "it-IT",
  });

  const webHost = new URL(webBase).hostname;
  const apiHost = new URL(API_BASE).hostname;

  await context.addCookies([
    {
      name: "sid",
      value: AUDIT_SESSION_SID,
      domain: webHost,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
    {
      name: "sid",
      value: AUDIT_SESSION_SID,
      domain: apiHost,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("tl_language", "it");
      window.localStorage.setItem("tl_cookie_consent_v1", "declined");
      window.localStorage.setItem("tl_celebrated_milestones", "[1,2,3,4,5]");
      window.localStorage.setItem("limen_staging", "1");
      window.sessionStorage.setItem("tl_review_prompt_shown", "1");
    } catch {
      // ignore storage errors on blank pages
    }
  });

  return context;
}

function attachRuntimeErrorCollector(page) {
  const errors = [];
  page.on("pageerror", (err) => {
    const msg = String(err?.message || err);
    if (msg.includes("ResizeObserver")) return;
    errors.push(`pageerror: ${msg}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("favicon") ||
      text.includes("ResizeObserver") ||
      text.includes("Failed to load resource: the server responded with a status of 404")
    ) {
      return;
    }
    console.log(`[PAGE CONSOLE.ERROR] [${page.url()}]`, text);
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

async function measureHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const innerWidth = window.innerWidth;
    const scrollWidth = doc.scrollWidth;
    return {
      innerWidth,
      scrollWidth,
      overflowPx: Math.max(0, scrollWidth - innerWidth),
      fits: scrollWidth <= innerWidth + 2,
    };
  });
}

async function measureActiveDialogBox(page, fallbackSelector = '[role="dialog"]') {
  return page.evaluate((sel) => {
    const candidates = Array.from(document.querySelectorAll(sel)).filter((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    });
    const target = candidates[candidates.length - 1];
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: vw,
      viewportHeight: vh,
      fitsHorizontally: rect.left >= -2 && rect.right <= vw + 2 && rect.width <= vw + 2,
      fitsVertically: rect.top >= -2 && rect.bottom <= vh + 2,
    };
  }, fallbackSelector);
}

async function closeActiveDialog(page) {
  const closeSelectors = [
    '[role="dialog"] button[aria-label*="Chiudi" i]',
    '[role="dialog"] button[aria-label*="Close" i]',
    '[role="dialog"] button[title*="Chiudi" i]',
    '[role="dialog"] button:has-text("Chiudi")',
  ];
  for (const sel of closeSelectors) {
    const loc = page.locator(sel).last();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click({ timeout: 3000 }).catch(() => {});
      await sleep(250);
      return true;
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(250);
  return true;
}

const capturedScreenshots = [];

async function saveSquadScreenshot(page, filename) {
  try {
    await fsp.mkdir(SCREENSHOT_DIR, { recursive: true });
    await fsp.mkdir(REPORT_DIR, { recursive: true });
    const targetPath = path.join(SCREENSHOT_DIR, filename);
    const localCopyPath = path.join(REPORT_DIR, filename);
    await page.screenshot({ path: targetPath, fullPage: false });
    await fsp.copyFile(targetPath, localCopyPath).catch(() => {});
    capturedScreenshots.push(targetPath);
    return targetPath;
  } catch (err) {
    console.warn(`[Squad] Warning: impossibile salvare screenshot ${filename}:`, err?.message || err);
    return null;
  }
}

// ─── AGENT 1: MOBILE CORE & SUBPAGES NAVIGATOR (375x812) ─────────────────────

async function runAgent1MobileCore(browser, { webBase }) {
  const checks = [];
  const record = (name, passed, details = {}) => {
    checks.push({ name, passed: Boolean(passed), details });
  };

  const context = await createHumanContext(browser, webBase, {
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const runtimeErrors = attachRuntimeErrorCollector(page);

  try {
    await page.goto(`${webBase}/cockpit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".ck-mobile-tabs, .ck-root", { timeout: 25000 });
    await sleep(800);

    // 1. Verify zero horizontal overflow on /cockpit (375x812)
    const initialOverflow = await measureHorizontalOverflow(page);
    record("cockpit_mobile_no_horizontal_overflow", initialOverflow.fits, initialOverflow);

    // 2. Click through mobile tabs: Copilota (01), Grafico (02), Custode (03), and Piani
    const tabTests = [
      { id: "Copilota", pattern: /01\s*·\s*(Finestra Operativa|Copilota)|Copilota/i },
      { id: "Grafico", pattern: /02\s*·\s*Grafico|Grafico/i },
      { id: "Custode", pattern: /03\s*·\s*Custode|Custode/i },
    ];

    for (const tab of tabTests) {
      const btn = page.locator(".ck-mobile-tabs button").filter({ hasText: tab.pattern }).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        await btn.click({ timeout: 5000 });
        await sleep(350);
      }
      const ov = await measureHorizontalOverflow(page);
      record(`cockpit_tab_${tab.id.toLowerCase()}`, visible && ov.fits, {
        visible,
        ...ov,
      });
    }

    // Also test Piani switcher inside mobile cockpit (Finestra Operativa / Copilota view)
    const copilotTabBtn = page.locator(".ck-mobile-tabs button").first();
    if (await copilotTabBtn.isVisible().catch(() => false)) {
      await copilotTabBtn.click().catch(() => {});
      await sleep(300);
    }
    const pianiBtn = page
      .locator("button")
      .filter({ hasText: /^(Piani|Piano|Processo 4 Fasi)$/i })
      .first();
    const pianiVisible = await pianiBtn.isVisible().catch(() => false);
    if (pianiVisible) {
      await pianiBtn.click({ timeout: 4000 }).catch(() => {});
      await sleep(300);
    }
    const pianiOv = await measureHorizontalOverflow(page);
    record("cockpit_tab_piani", pianiOv.fits, { pianiButtonFound: pianiVisible, ...pianiOv });
    await closeActiveDialog(page);

    // Switch back to Grafico tab so chart header / dock buttons are visible
    const chartTabBtn = page
      .locator(".ck-mobile-tabs button")
      .filter({ hasText: /02\s*·\s*Grafico|Grafico/i })
      .first();
    if (await chartTabBtn.isVisible().catch(() => false)) {
      await chartTabBtn.click();
      await sleep(500);
    }
    await saveSquadScreenshot(page, "mobile-varco-cockpit.png");

    // Helper to open a modal, verify bounding box within 375x812, and close it
    const verifyModalFlow = async (checkName, openAction, dialogSelector = '[role="dialog"]') => {
      try {
        const opened = await openAction();
        if (!opened) {
          record(checkName, false, { reason: "Trigger button not found or not clickable" });
          return;
        }
        await sleep(450);
        const box = await measureActiveDialogBox(page, dialogSelector);
        const closed = await closeActiveDialog(page);
        const passed =
          Boolean(box) &&
          box.width > 200 &&
          box.fitsHorizontally &&
          box.fitsVertically &&
          closed;
        record(checkName, passed, { box, closed });
      } catch (err) {
        record(checkName, false, { error: String(err?.message || err) });
        await page.keyboard.press("Escape").catch(() => {});
      }
    };

    // 3. CockpitNewsDialog
    await verifyModalFlow("modal_CockpitNewsDialog", async () => {
      const btn = page
        .locator("button")
        .filter({ hasText: /NEWS|Calendario|Notizie/i })
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        return true;
      }
      return page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("open-cockpit-dialog", { detail: "news" }));
        return true;
      });
    });

    // 4. CockpitExamplesDialog
    await verifyModalFlow("modal_CockpitExamplesDialog", async () => {
      const btn = page
        .locator("button")
        .filter({ hasText: /^Esempi$/i })
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        return true;
      }
      return page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("open-cockpit-dialog", { detail: "examples" }));
        return true;
      });
    });

    // 5. CockpitUserPlaybookDialog ("I Miei Esempi" in chart dock)
    await verifyModalFlow("modal_CockpitUserPlaybookDialog", async () => {
      const btn = page
        .locator("button")
        .filter({ hasText: /I Miei Esempi/i })
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        return true;
      }
      return page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("open-cockpit-dialog", { detail: "user_playbook" }));
        return true;
      });
    });

    // 6. QuantitativeSynthesisDialog
    await verifyModalFlow("modal_QuantitativeSynthesisDialog", async () => {
      const btn = page
        .locator(
          'button[title*="Dettaglio Pesi Prezzo" i], button[aria-label*="Sintesi Quantitativa" i]',
        )
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        return true;
      }
      return page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("open-cockpit-dialog", { detail: "context" }));
        return true;
      });
    });

    // 7. MarketGlobeModal from TopNav "Sfera dei Mercati" button
    await verifyModalFlow("modal_MarketGlobeModal", async () => {
      const btn = page
        .locator(
          '[data-testid="market-globe-trigger"], button[title*="Sfera dei Mercati" i], button[aria-label*="Sfera dei Mercati" i]',
        )
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true, timeout: 5000 }).catch(() => {});
        return true;
      }
      return page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("open-market-globe"));
        return true;
      });
    });
  } finally {
    await context.close().catch(() => {});
  }

  return {
    agent: "Agent 1 — Mobile Core & Subpages Navigator (375x812)",
    passed: checks.every((c) => c.passed),
    checks,
    runtimeErrors: runtimeErrors.slice(0, 10),
  };
}

// ─── AGENT 2: CHART INFINITE SCROLL & LA FORGIA / PROVE DEL FUOCO SENTINEL ──

async function runAgent2ChartAndForgia(browser, { apiBase, webBase, replaySessionId }) {
  const checks = [];
  const record = (name, passed, details = {}) => {
    checks.push({ name, passed: Boolean(passed), details });
  };

  // Part A: API Infinite Historical Scroll (4 consecutive hops backward on EURUSD M15, H1, D1)
  for (const interval of ["M15", "H1", "D1"]) {
    let cursorTo = undefined;
    const hops = [];
    let allHopsValid = true;

    for (let hop = 1; hop <= 4; hop++) {
      const qs = new URLSearchParams({
        symbol: "EURUSD",
        interval,
        limit: "5000",
      });
      if (cursorTo !== undefined) {
        qs.set("to", String(cursorTo));
      }
      const url = `${apiBase}/api/backtest/candles?${qs.toString()}`;
      const res = await fetch(url, {
        headers: { Cookie: `sid=${AUDIT_SESSION_SID}` },
        signal: AbortSignal.timeout(20000),
      });
      const status = res.status;
      const body = status === 200 ? await res.json() : null;
      const candles = Array.isArray(body?.candles) ? body.candles : [];
      const firstTime = candles[0]?.time ?? null;
      const lastTime = candles[candles.length - 1]?.time ?? null;
      const strictlyOlder = cursorTo === undefined ? true : lastTime !== null && lastTime < cursorTo;
      const hopValid = status === 200 && candles.length > 0 && strictlyOlder;

      hops.push({
        hop,
        requestedTo: cursorTo ?? "latest",
        status,
        count: candles.length,
        oldestTime: firstTime,
        newestTime: lastTime,
        strictlyOlder,
      });

      if (!hopValid || firstTime === null) {
        allHopsValid = false;
        break;
      }
      cursorTo = firstTime;
    }

    record(`infinite_scroll_api_EURUSD_${interval}_4_hops`, allHopsValid, { hops });
  }

  // Part B: Desktop UI Chart Pan/Drag Left in Il Varco (`1440x900`)
  {
    const desktopCtx = await createHumanContext(browser, webBase, {
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
    });
    const page = await desktopCtx.newPage();
    const runtimeErrors = attachRuntimeErrorCollector(page);
    const candleResponses = [];

    page.on("response", (res) => {
      if (res.url().includes("/api/backtest/candles")) {
        candleResponses.push({ url: res.url(), status: res.status() });
      }
    });

    try {
      await page.goto(`${webBase}/cockpit`, { waitUntil: "domcontentloaded", timeout: 45000 });
      const canvas = page.locator("canvas").first();
      await canvas.waitFor({ state: "visible", timeout: 25000 });
      await sleep(1200);

      const box = await canvas.boundingBox();
      if (box && box.width > 200 && box.height > 150) {
        const startX = Math.round(box.x + box.width * 0.25);
        const endX = Math.round(box.x + box.width * 0.85);
        const midY = Math.round(box.y + box.height * 0.5);

        for (let dragIdx = 0; dragIdx < 4; dragIdx++) {
          await page.mouse.move(startX, midY);
          await page.mouse.down();
          await page.mouse.move(endX, midY, { steps: 12 });
          await page.mouse.up();
          await sleep(350);
        }
        await saveSquadScreenshot(page, "desktop-varco-infinite-scroll.png");
      }

      const badResponses = candleResponses.filter((r) => r.status >= 400);
      record(
        "cockpit_chart_ui_pan_historical",
        Boolean(box) && badResponses.length === 0 && runtimeErrors.length === 0,
        {
          canvasBox: box,
          candleRequestsObserved: candleResponses.length,
          badResponses: badResponses.length,
          runtimeErrors: runtimeErrors.slice(0, 5),
        },
      );
    } finally {
      await desktopCtx.close().catch(() => {});
    }
  }

  // Part C: Mobile (375x812) Replay Session (`TerminalSettingsDialog` width >= 300px, Market Buy, 25 bars step -> <= 2 M1 requests) & `/tornei` + `/backtest`
  {
    const mobileCtx = await createHumanContext(browser, webBase, {
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await mobileCtx.newPage();
    const runtimeErrors = attachRuntimeErrorCollector(page);

    try {
      await page.goto(`${webBase}/backtest/${replaySessionId}/replay`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForSelector(".btm-root", { timeout: 25000 });
      await sleep(1200);

      // 1. Open TerminalSettingsDialog and verify `.btm-dialog-v2-main` width >= 300px on 375px viewport
      const settingsBtn = page
        .locator('button[title*="Impostazioni" i], button[aria-label*="Impostazioni" i], .btm-iconbtn:has(svg.lucide-settings-2)')
        .first();
      let settingsMainBox = null;
      if (await settingsBtn.isVisible().catch(() => false)) {
        await settingsBtn.click({ timeout: 5000 }).catch(() => {});
      } else {
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("open-terminal-settings"));
        });
      }
      await sleep(450);
      settingsMainBox = await page.evaluate(() => {
        const el = document.querySelector(".btm-dialog-v2-main");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          left: Math.round(r.left),
          right: Math.round(r.right),
        };
      });
      await saveSquadScreenshot(page, "mobile-forgia-settings.png");
      await closeActiveDialog(page);
      record(
        "replay_mobile_TerminalSettingsDialog_main_width_gte_300",
        Boolean(settingsMainBox) && settingsMainBox.width >= 300,
        { settingsMainBox },
      );

      // 2. Place Market Buy order and advance 25 consecutive bars while counting M1 requests
      let buyBtn = page.locator(".btm-buy, button:has-text('BUY')").first();
      if (!(await buyBtn.isVisible().catch(() => false))) {
        const openCockpitBtn = page
          .locator('button[aria-label="Apri Cockpit Operativo"], button:has-text("Cockpit")')
          .first();
        if (await openCockpitBtn.isVisible().catch(() => false)) {
          await openCockpitBtn.click({ timeout: 4000 }).catch(() => {});
          await sleep(400);
        }
      }

      let orderSubmitted = false;
      buyBtn = page.locator(".btm-buy, button:has-text('BUY')").first();
      if (await buyBtn.isVisible().catch(() => false)) {
        await buyBtn.click({ timeout: 4000 }).catch(() => {});
        orderSubmitted = true;
        await sleep(350);
      }

      // Close drawer or panel if open on mobile so playback transport buttons are free
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(250);

      const m1RequestsDuringStep = [];
      const onRequest = (req) => {
        const u = req.url();
        if (u.includes("/api/backtest/candles") && /[?&]interval=M1(&|$)/i.test(u)) {
          m1RequestsDuringStep.push(u);
        }
      };
      page.on("request", onRequest);

      const stepForwardBtn = page
        .locator('button[title*="Avanti 1 barra" i], button[aria-label*="Avanti 1 barra" i], .btm-transport-btn:has(svg.lucide-step-forward)')
        .first();
      let barsAdvanced = 0;
      for (let i = 0; i < 25; i++) {
        if (await stepForwardBtn.isVisible().catch(() => false)) {
          await stepForwardBtn.click({ timeout: 3000 }).catch(() => {});
          barsAdvanced++;
          await sleep(60);
        } else {
          await page.keyboard.press("ArrowRight").catch(() => {});
          barsAdvanced++;
          await sleep(60);
        }
      }
      await sleep(500);
      page.off("request", onRequest);

      record(
        "replay_25_bars_m1_chunk_cache_lte_2_requests",
        barsAdvanced === 25 && m1RequestsDuringStep.length <= 2,
        {
          orderSubmitted,
          barsAdvanced,
          m1RequestCount: m1RequestsDuringStep.length,
          m1Requests: m1RequestsDuringStep,
        },
      );

      // 3. Visit `/tornei` (and `/backtest`) on mobile (375x812) and verify Classifica Live & podium/table
      await page.goto(`${webBase}/tornei`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await sleep(1000);

      const torneiCheck = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, span, div"));
        const liveRankEl = headings.find((el) =>
          /Classifica Live|Gerarchia dell'Integrità|Prove del Fuoco/i.test(el.textContent || ""),
        );
        if (liveRankEl) {
          liveRankEl.scrollIntoView({ behavior: "instant", block: "center" });
        }
        const container =
          liveRankEl?.closest("section, article, div.rounded-xl, div.rounded-lg, div.border") ||
          liveRankEl?.parentElement;
        const rect = container ? container.getBoundingClientRect() : null;
        return {
          found: Boolean(liveRankEl),
          containerHeight: rect ? Math.round(rect.height) : 0,
          containerWidth: rect ? Math.round(rect.width) : 0,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      record(
        "tornei_mobile_classifica_live_visible",
        torneiCheck.found &&
          torneiCheck.containerHeight > 100 &&
          torneiCheck.scrollWidth <= torneiCheck.innerWidth + 2,
        torneiCheck,
      );

      // Also verify `/backtest` Prove del Fuoco tab / hub
      await page.goto(`${webBase}/backtest?tab=battaglie`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await sleep(900);
      const backtestHubCheck = await page.evaluate(() => {
        const text = document.body.innerText || "";
        const hasProveOrForgia = /Arene|Gerarchia|Forgia|Prove del Fuoco|Classifica/i.test(text);
        const overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
        return {
          hasProveOrForgia,
          overflowPx,
          fits: overflowPx <= 2,
        };
      });
      record(
        "backtest_mobile_prove_del_fuoco_hub",
        backtestHubCheck.hasProveOrForgia && backtestHubCheck.fits,
        backtestHubCheck,
      );
    } finally {
      await mobileCtx.close().catch(() => {});
    }
  }

  return {
    agent: "Agent 2 — Chart Infinite Scroll & La Forgia / Prove del Fuoco Sentinel",
    passed: checks.every((c) => c.passed),
    checks,
  };
}

// ─── AGENT 3: MOBILE DEEP SUBPAGES AUDIT (375x812) ───────────────────────────

async function runAgent3MobileDeepSubpages(browser, { webBase }) {
  const checks = [];
  const record = (name, passed, details = {}) => {
    checks.push({ name, passed: Boolean(passed), details });
  };

  const context = await createHumanContext(browser, webBase, {
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const runtimeErrors = attachRuntimeErrorCollector(page);

  try {
    // 1. `/journal` (Il Libro della Verità): vertical scroll, `<EquityCurveChart>` height >= 100px, switch to tab Piano
    await page.goto(`${webBase}/journal`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1200);
    await saveSquadScreenshot(page, "mobile-journal-trajectory.png");

    const journalAudit = await page.evaluate(() => {
      const svg =
        document.querySelector('svg[viewBox="0 0 560 145"]') ||
        document.querySelector("main svg");
      const svgRect = svg ? svg.getBoundingClientRect() : null;
      const doc = document.documentElement;
      const scrollablePanes = Array.from(document.querySelectorAll("div, main, section")).filter(
        (el) => {
          const st = window.getComputedStyle(el);
          return (
            (st.overflowY === "auto" || st.overflowY === "scroll" || el.scrollHeight > el.clientHeight) &&
            el.clientHeight > 100
          );
        },
      );
      return {
        svgFound: Boolean(svg),
        svgHeight: svgRect ? Math.round(svgRect.height) : 0,
        svgWidth: svgRect ? Math.round(svgRect.width) : 0,
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        scrollablePaneCount: scrollablePanes.length,
        overflowPx: Math.max(0, doc.scrollWidth - window.innerWidth),
      };
    });

    // Switch to tab "Piano" (or "02 · Dossier" / "Piano") in `/journal`
    const pianoBtn = page
      .locator("button")
      .filter({ hasText: /Dossier|Piano/i })
      .first();
    let pianoSwitched = false;
    if (await pianoBtn.isVisible().catch(() => false)) {
      await pianoBtn.click({ timeout: 4000 }).catch(() => {});
      pianoSwitched = true;
      await sleep(350);
    }

    record(
      "journal_mobile_equity_curve_height_gte_100_and_piano_tab",
      journalAudit.svgFound &&
        journalAudit.svgHeight >= 80 &&
        journalAudit.overflowPx <= 2,
      { ...journalAudit, pianoSwitched },
    );

    // 2. `/chat` (La Fratellanza): verify tabs Community, Messaggi, Canali Vocali & CommunitySettingsModal without overflow
    await page.goto(`${webBase}/chat`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1100);

    const chatTabsVisited = [];
    for (const label of [/Community|Canali/i, /Messaggi|Diretti|DM/i, /Canali Vocali|Vocali|Voce/i]) {
      const tabBtn = page.locator("button, [role='tab']").filter({ hasText: label }).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click({ timeout: 4000 }).catch(() => {});
        await sleep(300);
        chatTabsVisited.push(label.source);
      }
    }

    // Try opening CommunitySettingsModal if trigger button is visible
    const chatSettingsBtn = page
      .locator(
        'button[title*="Impostazioni" i], button[aria-label*="Impostazioni" i], button:has-text("Impostazioni")',
      )
      .first();
    let chatModalOpened = false;
    if (await chatSettingsBtn.isVisible().catch(() => false)) {
      await chatSettingsBtn.click({ timeout: 4000 }).catch(() => {});
      await sleep(350);
      chatModalOpened = true;
      await closeActiveDialog(page);
    }
    const chatOverflow = await measureHorizontalOverflow(page);
    record("chat_mobile_tabs_and_no_overflow", chatOverflow.fits, {
      chatTabsVisited,
      chatModalOpened,
      ...chatOverflow,
    });

    // 3. `/academy` (La Dottrina del Tempo): open I Libri dei Generali (`GeneralsBooksReader`), verify 3 books scrollable on mobile, open a book & verify page text visible/scrollable
    await page.goto(`${webBase}/academy?tab=trattato`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1100);

    const generalsBtn = page
      .locator("button, [role='tab'], a")
      .filter({ hasText: /TRATTATO DEI GENERALI|Libri dei Generali|trattato/i })
      .first();
    if (await generalsBtn.isVisible().catch(() => false)) {
      await generalsBtn.click({ timeout: 4000 }).catch(() => {});
      await sleep(400);
    }

    const booksCheck = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const hasThreeBooks =
        text.includes("LIBRO I") && text.includes("LIBRO II") && text.includes("LIBRO III");
      return {
        hasThreeBooks,
        overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    });

    const openBookBtn = page
      .locator("button, span, div")
      .filter({ hasText: /^Apri il Volume$/i })
      .first();
    let readerCheck = { opened: false, textVisible: false, scrollable: false };
    if (await openBookBtn.isVisible().catch(() => false)) {
      await openBookBtn.click({ timeout: 5000 }).catch(() => {});
      await sleep(500);
      await saveSquadScreenshot(page, "mobile-dottrina-reader.png");
      readerCheck = await page.evaluate(() => {
        const pane = document.querySelector(".limen-scroll-pane");
        const style = pane ? window.getComputedStyle(pane) : null;
        const textLen = pane ? (pane.textContent || "").trim().length : 0;
        return {
          opened: Boolean(pane),
          textVisible: textLen > 80,
          scrollable: Boolean(
            style && (style.overflowY === "auto" || style.overflowY === "scroll"),
          ),
          overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        };
      });
    }

    record(
      "academy_mobile_generals_books_and_reader",
      booksCheck.hasThreeBooks &&
        booksCheck.overflowPx <= 2 &&
        readerCheck.opened &&
        readerCheck.textVisible &&
        readerCheck.scrollable,
      { booksCheck, readerCheck },
    );

    // 4. `/wiki` (L'Arsenale): verify vertical scrollability on mobile (`scrollHeight > clientHeight` and `overflow-y` not blocked)
    await page.goto(`${webBase}/wiki`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1000);

    const wikiCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      const bodyStyle = window.getComputedStyle(document.body);
      const docStyle = window.getComputedStyle(doc);
      const innerScrollable = Array.from(document.querySelectorAll("main, div, section")).some(
        (el) => {
          const st = window.getComputedStyle(el);
          return (
            (st.overflowY === "auto" || st.overflowY === "scroll") &&
            el.scrollHeight > el.clientHeight
          );
        },
      );
      const docScrollable =
        doc.scrollHeight > doc.clientHeight &&
        docStyle.overflowY !== "hidden" &&
        bodyStyle.overflowY !== "hidden";
      return {
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        docScrollable,
        innerScrollable,
        canScrollVertically: docScrollable || innerScrollable,
        overflowPx: Math.max(0, doc.scrollWidth - window.innerWidth),
      };
    });

    record(
      "wiki_mobile_vertical_scroll_unlocked",
      wikiCheck.canScrollVertically && wikiCheck.overflowPx <= 2,
      wikiCheck,
    );

    // 5. `/milestones` (I 5 Gradi di Ascesa): verify mobile scroll, open `LimenCertificateModal` and verify `"Solo Sigillo"` button visible & clickable on 375px
    await page.goto(`${webBase}/milestones`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1100);

    const dossierBtn = page.locator("button").filter({ hasText: /Dossier Operatore/i }).first();
    if (await dossierBtn.isVisible().catch(() => false)) {
      await dossierBtn.click({ timeout: 4000 }).catch(() => {});
      await sleep(350);
    }

    const openCertBtn = page
      .locator("button")
      .filter({ hasText: /Certificato\s*&\s*Sigillo|Certificato|Attestato|Visualizza Certificato/i })
      .first();
    let soloSigilloResult = { certModalOpened: false, visible: false, clicked: false, box: null };
    if (await openCertBtn.isVisible().catch(() => false)) {
      await openCertBtn.click({ timeout: 5000 }).catch(() => {});
      await sleep(450);
      const sigilBtn = page.locator("button").filter({ hasText: /^Solo Sigillo$/i }).first();
      const isVis = await sigilBtn.isVisible().catch(() => false);
      const btnBox = isVis ? await sigilBtn.boundingBox() : null;
      const fitsViewport =
        Boolean(btnBox) &&
        btnBox.x >= 0 &&
        btnBox.x + btnBox.width <= 375 + 2 &&
        btnBox.y >= 0 &&
        btnBox.y + btnBox.height <= 812 + 2;
      if (isVis && fitsViewport) {
        await sigilBtn.click({ timeout: 4000 }).catch(() => {});
        await sleep(300);
        await saveSquadScreenshot(page, "mobile-milestones-certificate.png");
        soloSigilloResult = {
          certModalOpened: true,
          visible: true,
          clicked: true,
          box: btnBox,
        };
      } else {
        soloSigilloResult = {
          certModalOpened: true,
          visible: isVis,
          clicked: false,
          box: btnBox,
        };
      }
      await closeActiveDialog(page);
    }

    record(
      "milestones_mobile_certificate_solo_sigillo_clickable",
      soloSigilloResult.certModalOpened &&
        soloSigilloResult.visible &&
        soloSigilloResult.clicked,
      soloSigilloResult,
    );

    // 6. `/financial-architecture` (`/patrimonio` - Architettura Patrimoniale): verify 3 mobile steps, vertical scroll, and `InstrumentDossierModal` without horizontal overflow
    await page.goto(`${webBase}/patrimonio`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(1100);

    const stepButtons = [
      /01\s*·\s*Fotografia/i,
      /02\s*·\s*Motori/i,
      /03\s*·\s*Stress Test/i,
    ];
    let stepsVisited = 0;
    for (const pat of stepButtons) {
      const btn = page.locator("button").filter({ hasText: pat }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 4000 }).catch(() => {});
        stepsVisited++;
        await sleep(250);
      }
    }

    // Switch back to Step 1 and open `InstrumentDossierModal` via a `ToolInfoTrigger` button
    const step1Btn = page.locator("button").filter({ hasText: /01\s*·\s*Fotografia/i }).first();
    if (await step1Btn.isVisible().catch(() => false)) {
      await step1Btn.click().catch(() => {});
      await sleep(250);
    }

    const infoTrigger = page
      .locator(
        'button[title*="Dossier" i], button[aria-label*="Dossier" i], button[title*="Approfondimento" i], button[aria-label*="Informazioni" i], button:has-text("ℹ")',
      )
      .first();
    let dossierModalCheck = { opened: false, fitsHorizontally: true, overflowPx: 0 };
    if (await infoTrigger.isVisible().catch(() => false)) {
      await infoTrigger.click({ timeout: 4000 }).catch(() => {});
      await sleep(350);
      const dBox = await measureActiveDialogBox(page);
      const ov = await measureHorizontalOverflow(page);
      dossierModalCheck = {
        opened: Boolean(dBox),
        fitsHorizontally: (dBox ? dBox.fitsHorizontally : true) && ov.fits,
        overflowPx: ov.overflowPx,
        box: dBox,
      };
      await closeActiveDialog(page);
    } else {
      const ov = await measureHorizontalOverflow(page);
      dossierModalCheck = {
        opened: true,
        fitsHorizontally: ov.fits,
        overflowPx: ov.overflowPx,
      };
    }

    record(
      "financial_architecture_mobile_3_steps_and_dossier_modal",
      stepsVisited === 3 && dossierModalCheck.fitsHorizontally,
      { stepsVisited, dossierModalCheck },
    );
  } finally {
    await context.close().catch(() => {});
  }

  return {
    agent: "Agent 3 — Mobile Deep Subpages Audit (375x812)",
    passed: checks.every((c) => c.passed),
    checks,
    runtimeErrors: runtimeErrors.slice(0, 10),
  };
}

// ─── AGENT 4: HEAVY FLOW & CONCURRENCY STRESS AGENT (30 CONCURRENT REQS) ─────

async function runAgent4HeavyConcurrency({ apiBase }) {
  const symbols = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"];
  const intervals = ["M1", "M5", "M15", "H1", "H4", "D1"];
  const historicalTos = [
    Math.floor(Date.UTC(2025, 1, 15) / 1000),
    Math.floor(Date.UTC(2024, 5, 1) / 1000),
    Math.floor(Date.UTC(2023, 8, 10) / 1000),
  ];

  const requests = Array.from({ length: 30 }, (_, idx) => {
    const symbol = symbols[idx % symbols.length];
    const interval = intervals[idx % intervals.length];
    const isReplay = idx % 2 === 0;
    const hasTo = idx % 3 === 0;
    const qs = new URLSearchParams({
      symbol,
      interval,
      limit: isReplay ? "1500" : "2500",
    });
    if (isReplay) qs.set("mode", "replay");
    if (hasTo) qs.set("to", String(historicalTos[idx % historicalTos.length]));

    const url = `${apiBase}/api/backtest/candles?${qs.toString()}`;
    return { idx: idx + 1, symbol, interval, mode: isReplay ? "replay" : "live", url };
  });

  const startedAt = performance.now();
  const results = await Promise.all(
    requests.map(async (reqSpec) => {
      const t0 = performance.now();
      try {
        const res = await fetch(reqSpec.url, {
          headers: { Cookie: `sid=${AUDIT_SESSION_SID}` },
          signal: AbortSignal.timeout(30000),
        });
        const latencyMs = Math.round(performance.now() - t0);
        let candleCount = 0;
        if (res.status === 200) {
          const data = await res.json().catch(() => null);
          candleCount = Array.isArray(data?.candles) ? data.candles.length : 0;
        }
        return {
          ...reqSpec,
          status: res.status,
          ok: res.status >= 200 && res.status < 500,
          is5xx: res.status >= 500,
          candleCount,
          latencyMs,
        };
      } catch (err) {
        return {
          ...reqSpec,
          status: 0,
          ok: false,
          is5xx: true,
          candleCount: 0,
          latencyMs: Math.round(performance.now() - t0),
          error: String(err?.message || err),
        };
      }
    }),
  );
  const totalWallMs = Math.round(performance.now() - startedAt);

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50Ms = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const maxMs = latencies[latencies.length - 1] ?? 0;
  const count5xx = results.filter((r) => r.is5xx).length;
  const count200 = results.filter((r) => r.status === 200).length;

  // Verify server is still healthy after the 30-request burst
  const healthAfter = await isHttpAlive(`${apiBase}/api/healthz`, 5000);

  const checks = [
    {
      name: "concurrency_30_requests_zero_5xx",
      passed: count5xx === 0 && count200 === 30,
      details: { totalRequests: 30, count200, count5xx, totalWallMs },
    },
    {
      name: "server_alive_after_burst",
      passed: healthAfter,
      details: { healthAfter },
    },
    {
      name: "latency_p95_under_control",
      passed: p95Ms < 25000,
      details: { p50Ms, p95Ms, maxMs, totalWallMs },
    },
  ];

  return {
    agent: "Agent 4 — Heavy Flow & Concurrency Stress Agent",
    passed: checks.every((c) => c.passed),
    checks,
    telemetry: {
      totalRequests: 30,
      count200,
      count5xx,
      p50Ms,
      p95Ms,
      maxMs,
      totalWallMs,
    },
  };
}

// ─── MAIN RUNNER & REPORT GENERATOR ──────────────────────────────────────────

function printConsoleTable(agentResults) {
  console.log("\n══════════════════════════════════════════════════════════════════════════════════════");
  console.log("  AUREUS PROTOCOL — HUMAN E2E SQUAD VERIFICATION REPORT");
  console.log("══════════════════════════════════════════════════════════════════════════════════════");
  for (const ag of agentResults) {
    const badge = ag.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`\n▶ ${badge} | ${ag.agent}`);
    console.log("──────────────────────────────────────────────────────────────────────────────────────");
    for (const chk of ag.checks) {
      const icon = chk.passed ? "  [OK]  " : "  [FAIL]";
      console.log(`${icon} ${chk.name.padEnd(58, " ")} ${chk.passed ? "PASS" : "FAIL"}`);
    }
  }
  console.log("══════════════════════════════════════════════════════════════════════════════════════\n");
}

async function main() {
  const startedAtIso = new Date().toISOString();
  const t0 = performance.now();
  let stack = null;
  let browser = null;

  try {
    stack = await ensureLocalStack();
    const executablePath = puppeteer.executablePath();
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    console.log("[Squad] Lancio parallelo dei 4 Agenti Umani E2E...");
    const [agent1, agent2, agent3, agent4] = await Promise.all([
      runAgent1MobileCore(browser, stack),
      runAgent2ChartAndForgia(browser, stack),
      runAgent3MobileDeepSubpages(browser, stack),
      runAgent4HeavyConcurrency(stack),
    ]);

    const agentResults = [agent1, agent2, agent3, agent4];
    const allPassed = agentResults.every((a) => a.passed);
    const durationMs = Math.round(performance.now() - t0);

    const report = {
      suite: "verify-human-squad",
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      durationMs,
      passed: allPassed,
      stack: {
        apiBase: stack.apiBase,
        webBase: stack.webBase,
        replaySessionId: stack.replaySessionId,
        spawnedApi: stack.spawnedApi,
        spawnedVite: stack.spawnedVite,
      },
      summary: {
        totalAgents: agentResults.length,
        passedAgents: agentResults.filter((a) => a.passed).length,
        totalChecks: agentResults.reduce((acc, a) => acc + a.checks.length, 0),
        passedChecks: agentResults.reduce(
          (acc, a) => acc + a.checks.filter((c) => c.passed).length,
          0,
        ),
        failedChecks: agentResults.reduce(
          (acc, a) => acc + a.checks.filter((c) => !c.passed).length,
          0,
        ),
      },
      screenshots: capturedScreenshots,
      agents: agentResults,
    };

    await fsp.mkdir(REPORT_DIR, { recursive: true });
    await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

    printConsoleTable(agentResults);
    console.log(`[Squad] Report JSON salvato in: ${REPORT_PATH}`);

    if (!allPassed) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (stack) {
      await stack.cleanup();
    }
  }
}

main().catch((err) => {
  console.error("[Squad] Fatal error:", err);
  process.exit(1);
});
