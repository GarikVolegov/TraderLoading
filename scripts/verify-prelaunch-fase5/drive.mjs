// Manual runtime smoke verifier for the pre-launch page-audit Fase 5 checklist
// (docs/superpowers/plans/2026-07-11-pre-launch-page-audit-fix-plan.md):
// broker badge, an error state (API down), cookie banner, the new BottomNav
// root-level mobile overflow (Library/Clock/News), and BillingReturn's
// "payment not completed" state. Not part of the automated test suite; run by
// hand against a local dev server. Mirrors scripts/verify-nav-hubs/drive.mjs.
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

const outDir = new URL("../../artifacts.local/verify-prelaunch-fase5/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, outDir)) }).then(() => console.log(`  📸 ${name}`));

const DISMISS = [/^Accetta$/, /^OK$/, /^Skip$/i, /^Dopo$/i, /^Salta$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
async function dismiss(page) {
  for (let p = 0; p < 6; p++) {
    let acted = false;
    for (const re of DISMISS) {
      const btn = page.getByRole("button", { name: re }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click().catch(() => {});
        acted = true;
        await page.waitForTimeout(250);
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
    if (!acted) break;
  }
}

async function main() {
  const userId = await clerkUserId();
  await clerkSetup();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // mobile: iPhone-ish
  await page.addInitScript(() => {
    try { localStorage.setItem("tl_language", "it"); } catch { /* ignore */ }
  });
  page.on("console", (m) => m.type() === "error" && console.log("  [browser error]", m.text()));

  try {
    // ── Cookie banner (accept-only variant: VITE_GA_MEASUREMENT_ID is unset
    //    locally, so the "Rifiuta" branch can't be exercised live here — that
    //    branch is covered instead by CookieConsentPopup.static.test.ts). ──
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const banner = page.getByText(/cookie tecnici/i).first();
    console.log("  [cookie] banner visible pre-consent:", await banner.count());
    await shot(page, "00-cookie-banner.png");
    const okBtn = page.getByRole("button", { name: "OK" }).first();
    if (await okBtn.count()) await okBtn.click();
    await page.waitForTimeout(300);
    console.log("  [cookie] banner dismissed:", (await banner.count()) === 0);

    // ── Sign in ──────────────────────────────────────────────────────────
    await setupClerkTestingToken({ page });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    const ticket = await mintTicket(userId);
    await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket } });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 4; i++) { await dismiss(page); await page.waitForTimeout(400); }

    // ── Mobile nav: root-level "Più" overflow surfaces Library/Clock/News ──
    console.log("\n=== Mobile nav root overflow (Fase 4) ===");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(400); }
    const moreBtn = page.getByRole("button", { name: "Più" }).first();
    await moreBtn.waitFor({ timeout: 10_000 }).catch(() => {});
    console.log("  [root/mobile] Più button present:", await moreBtn.count());
    await shot(page, "01-root-mobile-pill.png");
    await moreBtn.click();
    await page.waitForTimeout(500);
    // BottomNav renders both the mobile pill/sheet AND the desktop sidebar in
    // the same tree (toggled via lg:hidden/lg:flex), so href selectors match
    // twice — scope to the currently-visible one.
    console.log("  [overflow sheet] Library link:", await page.locator('a[href="/library"]:visible').count());
    console.log("  [overflow sheet] Clock link:", await page.locator('a[href="/clock"]:visible').count());
    console.log("  [overflow sheet] News link:", await page.locator('a[href="/news"]:visible').count());
    await shot(page, "02-root-mobile-overflow-sheet.png");
    await page.locator('a[href="/clock"]:visible').first().click();
    await page.waitForTimeout(700);
    console.log("  [overflow tap] URL after tapping Clock:", page.url());
    await shot(page, "03-clock-via-overflow.png");

    // ── Desktop nav parity: sidebar secondary group gets Clock + News ──────
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 4; i++) { await dismiss(page); await page.waitForTimeout(400); }
    console.log("  [desktop sidebar] Clock link present:", await page.locator('a[href="/clock"]:visible').count());
    console.log("  [desktop sidebar] News link present:", await page.locator('a[href="/news"]:visible').count());
    console.log("  [desktop sidebar] Library link present:", await page.locator('a[href="/library"]:visible').count());
    await shot(page, "04-desktop-sidebar-parity.png");
    await page.setViewportSize({ width: 390, height: 844 });

    // ── Broker badge: trading-enabled/blocked label must read correctly ────
    console.log("\n=== Broker trading badge (Fase 1) ===");
    await page.goto(`${BASE}/broker`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 4; i++) { await dismiss(page); await page.waitForTimeout(400); }
    console.log("  [broker] 'Trading attivo' present:", await page.getByText("Trading attivo").count());
    console.log("  [broker] 'Trading bloccato' present:", await page.getByText("Trading bloccato").count());
    console.log("  [broker] old inverted label GONE ('Trading non disponibile'):", await page.getByText("Trading non disponibile").count() === 0);
    await shot(page, "05-broker-badge.png");

    // ── Error state: block the journal entries call, confirm QueryErrorState
    //    (not the "no trades yet" empty state) renders with a retry CTA. ────
    console.log("\n=== Error state != empty state (Fase 1) ===");
    await page.route("**/api/journal", (route) => route.abort("failed"));
    await page.goto(`${BASE}/journal?t=trades`, { waitUntil: "domcontentloaded" });
    for (let i = 0; i < 4; i++) { await dismiss(page); await page.waitForTimeout(400); }
    // React Query retries a failed query a few times (exponential backoff)
    // before isError settles — poll instead of a flat sleep, it's flaky otherwise.
    await page.getByText("Impossibile caricare i dati.").waitFor({ timeout: 15_000 }).catch(() => {});
    console.log("  [journal/offline] load-error message shown:", await page.getByText("Impossibile caricare i dati.").count());
    console.log("  [journal/offline] retry button shown:", await page.getByRole("button", { name: "Riprova" }).count());
    console.log("  [journal/offline] empty-state text NOT shown instead:", await page.getByText(/nessun trade/i).count() === 0);
    await shot(page, "06-journal-error-state.png");
    await page.unroute("**/api/journal");

    // ── BillingReturn: no session_id → after the poll timeout, a clear
    //    "payment not completed" state with retry, not an endless spinner. ──
    console.log("\n=== BillingReturn cancel state (Fase 1) ===");
    await page.goto(`${BASE}/billing/return`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // let the billing-status query settle before deciding
    for (let i = 0; i < 4; i++) { await dismiss(page); await page.waitForTimeout(400); }
    const alreadyPro = await page.getByText("Benvenuto in Pro!").count();
    if (alreadyPro) {
      console.log("  [billing/return] SKIPPED: verify user already has Pro — the not-completed");
      console.log("    state is only reachable for a non-Pro session. Verified instead via the");
      console.log("    component logic (notCompleted branch) + typecheck/tests during Fase 1.");
      await shot(page, "07-billing-return-already-pro.png");
    } else {
      console.log("  [billing/return] confirming state first:", await page.getByText(/confermando/i).count());
      await shot(page, "07-billing-return-confirming.png");
      console.log("  waiting ~31s for the poll timeout…");
      await page.waitForTimeout(31_000);
      console.log("  [billing/return] 'not completed' state shown:", await page.getByText("Pagamento non completato").count());
      console.log("  [billing/return] retry CTA shown:", await page.getByText("Riprova").count());
      await shot(page, "08-billing-return-not-completed.png");
    }

    console.log("\nDONE");
  } catch (err) {
    console.error("driver error:", err?.message ?? err);
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
