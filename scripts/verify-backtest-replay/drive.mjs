// Manual runtime verifier for the Backtest Replay Terminal
// (/backtest/:id/replay): login (Clerk test user) → create a session → open
// the terminal → assert chart canvas + real candles → step forward → BUY →
// close at market → journal row + trade persisted to the API. Not part of the
// automated suite; run by hand against a local dev server. Mirrors
// scripts/verify-nav-hubs/drive.mjs.
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

function loadEnvLocal() {
  const env = {};
  try {
    const txt = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i).replace(/^export\s+/, "").trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local */
  }
  return env;
}

const env = loadEnvLocal();
process.env.CLERK_PUBLISHABLE_KEY ||= env.VITE_CLERK_PUBLISHABLE_KEY;
process.env.CLERK_SECRET_KEY ||= env.CLERK_SECRET_KEY;

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:5173";
const EMAIL = process.env.VERIFY_EMAIL || "verify+clerk_test@example.com";
const SECRET = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY;
const SYMBOL = process.env.VERIFY_SYMBOL || "BTC/USD"; // warehouse-seeded symbol

async function clerkUserId() {
  const r = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const users = await r.json();
  const id = Array.isArray(users) ? users[0]?.id : users?.data?.[0]?.id;
  if (!id) throw new Error(`no Clerk user for ${EMAIL}`);
  return id;
}

async function mintTicket(userId) {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const body = await res.json();
  if (!res.ok || !body.token) throw new Error(`sign_in_tokens failed: ${res.status} ${JSON.stringify(body)}`);
  return body.token;
}

const outDir = new URL("../../artifacts.local/verify-backtest-replay/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, outDir)) }).then(() => console.log(`  📸 ${name}`));

async function main() {
  const userId = await clerkUserId();
  await clerkSetup();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); // desktop terminal
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  page.on("console", (m) => m.type() === "error" && console.log("  [browser error]", m.text()));

  try {
    await setupClerkTestingToken({ page });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    const ticket = await mintTicket(userId);
    await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket } });

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 15000 }).catch(() => {});

    const apiToken = await page.evaluate(async () => {
      try {
        return await window.Clerk?.session?.getToken();
      } catch {
        return null;
      }
    });
    const authHeaders = { "Content-Type": "application/json", ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) };

    // ── silence first-run onboarding: ChecklistSetupModal opens whenever the
    // user has zero checklist items, overlaying the terminal (both z-60) ────
    await page.evaluate(async ({ headers }) => {
      const existing = await fetch("/api/checklist", { headers }).then((res) => res.json()).catch(() => []);
      if (Array.isArray(existing) && existing.length > 0) return;
      await fetch("/api/checklist", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "verify: setup replay terminal", completed: true }),
      });
    }, { headers: authHeaders });

    // ── create a session via API (deterministic, no UI dependency) ─────────
    const created = await page.evaluate(async ({ headers, symbol }) => {
      const res = await fetch("/api/backtest/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `verify-terminal-${Date.now()}`, pair: symbol, timeframe: "H1" }),
      });
      return res.json();
    }, { headers: authHeaders, symbol: SYMBOL });
    console.log("  [setup] session created:", created?.id, created?.pair);
    if (!created?.id) throw new Error("session create failed");

    // ── open the terminal ──────────────────────────────────────────────────
    await page.goto(`${BASE}/backtest/${created.id}/replay`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="backtest-terminal"]', { timeout: 20000 });
    // chart canvas rendered with real data (loading spinner gone)
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="replay-chart"] canvas').length > 0,
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(2500);

    // Dismiss app-level onboarding modals (e.g. ChecklistSetupModal on a fresh
    // user) that overlay the terminal. Buttons only — NEVER Escape here, the
    // terminal binds Esc to exit.
    const DISMISS = [/^Dopo$/i, /^Salta$/i, /^Skip$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
    for (let pass = 0; pass < 5; pass++) {
      let acted = false;
      for (const re of DISMISS) {
        const btn = page.getByRole("button", { name: re }).first();
        if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
          await btn.click().catch(() => {});
          acted = true;
          await page.waitForTimeout(300);
        }
      }
      if (!acted) break;
    }
    const counter = await page.locator(".btm-clock-count").textContent();
    console.log("  [terminal] candle counter:", counter?.trim());
    await shot(page, "01-terminal-loaded.png");

    // ── transport: step forward moves the counter ──────────────────────────
    const stepBtn = page.getByRole("button", { name: "Avanti di una candela" });
    await stepBtn.click();
    await page.waitForTimeout(300);
    const counterAfter = await page.locator(".btm-clock-count").textContent();
    console.log("  [transport] counter after step:", counterAfter?.trim(), "(changed:", counterAfter !== counter, ")");

    // ── indicator chips present (EMA 9 / EMA 21 / Vol defaults) ────────────
    console.log("  [indicators] EMA 9 chip:", await page.getByRole("button", { name: "EMA 9" }).count());
    console.log("  [indicators] Vol chip:", await page.getByRole("button", { name: "Vol" }).count());

    // ── trading: BUY → position card → close at market → journal row ───────
    await page.getByRole("button", { name: /^BUY$/ }).click();
    await page.waitForTimeout(500);
    const posCard = await page.locator(".btm-poscard").count();
    console.log("  [trade] position card visible:", posCard);
    await shot(page, "02-position-open.png");

    await page.getByRole("button", { name: /Chiudi a mercato/ }).click();
    await page.waitForTimeout(800);
    console.log("  [trade] journal rows:", await page.locator(".btm-traderow").count());
    await shot(page, "03-trade-closed.png");

    // ── persistence: the closed trade reached the on-contract API ──────────
    await page.waitForTimeout(1500);
    const persisted = await page.evaluate(async ({ headers, id }) => {
      const res = await fetch(`/api/backtest/sessions/${id}/trades`, { headers });
      return res.json();
    }, { headers: authHeaders, id: created.id });
    console.log("  [persistence] trades in DB:", Array.isArray(persisted) ? persisted.length : persisted);

    // ── hotkeys: Space toggles play (button label flips to pause) ──────────
    await page.keyboard.press(" ");
    await page.waitForTimeout(400);
    console.log("  [hotkeys] pause button after Space:", await page.getByRole("button", { name: /Pausa/ }).count());
    await page.keyboard.press(" ");

    // ── settings dialog opens ──────────────────────────────────────────────
    await page.getByRole("button", { name: "Impostazioni" }).first().click();
    await page.waitForTimeout(400);
    console.log("  [settings] dialog visible:", await page.locator(".btm-modal").count());
    await shot(page, "04-settings.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log("  [settings] Esc closed dialog (terminal still mounted):", await page.locator('[data-testid="backtest-terminal"]').count());

    // ── esc exits to /backtest ─────────────────────────────────────────────
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    console.log("  [exit] URL after Esc:", page.url());

    console.log("\nVERIFY BACKTEST REPLAY: done");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
