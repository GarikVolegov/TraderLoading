// Playwright driver for the backtest verifier. Signs in a Clerk test user,
// forces Pro by intercepting /api/billing/me, opens the replay, runs the
// change-specific action, and screenshots to artifacts.local/verify/.
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
      env[line.slice(0, i).replace(/^export\s+/, "").trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
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
const BACKTEST_PATH = process.env.VERIFY_BACKTEST_PATH || "/backtest";

// Mint a one-time sign-in token (ticket) via the Clerk Backend API — the most
// reliable programmatic sign-in, independent of which factors the instance has.
async function mintTicket() {
  const lookup = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const users = await lookup.json();
  const userId = Array.isArray(users) ? users[0]?.id : users?.data?.[0]?.id;
  if (!userId) throw new Error(`no Clerk user for ${EMAIL} (run setup-user.mjs first)`);
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const body = await res.json();
  if (!res.ok || !body.token) throw new Error(`sign_in_tokens failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.token;
}

const outDir = new URL("../../artifacts.local/verify/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, outDir)), fullPage: true }).then(() => console.log(`  📸 ${name}`));

// First-time users get a stack of intro modals (cookie banner, session check-in,
// per-feature "what is this" dialogs). Loop until none of the known dismiss
// controls act anymore.
const DISMISS_LABELS = [/^Accetta$/, /^Skip$/i, /^Dopo$/i, /^Salta$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
async function dismissOverlays(page) {
  for (let pass = 0; pass < 5; pass++) {
    let acted = false;
    for (const re of DISMISS_LABELS) {
      const btn = page.getByRole("button", { name: re }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click().catch(() => {});
        acted = true;
        await page.waitForTimeout(300);
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    if (!acted) break;
  }
}

async function main() {
  await clerkSetup();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (m) => m.type() === "error" && console.log("  [browser error]", m.text()));
  page.on("response", (r) => {
    if (r.url().includes("/backtest/session") && r.request().method() === "POST") {
      console.log(`  [session POST ${r.status()}]`);
    } else if (r.status() >= 500 && r.url().includes("clerk")) {
      console.log(`  [${r.status()}] ${r.url()}`);
    }
  });

  // Force Pro so ProUpgradeGate renders the backtest interactively.
  await page.route("**/api/billing/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan: "pro", pro: true, status: "active", manualOverride: true }),
    }),
  );

  try {
    await setupClerkTestingToken({ page });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    console.log("minting sign-in ticket…");
    const ticket = await mintTicket();
    await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket } });

    // Confirm the session took before relying on it (Clerk hydration can lag).
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 15000 }).catch(() => {});
    const session = await page.evaluate(() => ({
      user: window.Clerk?.user?.id ?? null,
      session: window.Clerk?.session?.status ?? null,
    }));
    console.log("post-signIn Clerk state:", JSON.stringify(session));

    // Complete onboarding deterministically (a fresh user is otherwise blocked by
    // the full-screen instrument-selection overlay) via the real settings API.
    const settingsStatus = await page.evaluate(async () => {
      let token = null;
      try {
        token = await window.Clerk?.session?.getToken();
      } catch {
        /* fall back to cookie auth */
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          selectedPairs: ["EUR/USD", "XAU/USD"],
          onboardingTutorialCompletedAt: new Date().toISOString(),
        }),
      });
      return res.status;
    });
    console.log("onboarding-complete settings PUT:", settingsStatus);
    await shot(page, "00-home.png");

    await page.goto(`${BASE}${BACKTEST_PATH}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    await shot(page, "01-backtest.png");

    // Create a session if none exists yet.
    await dismissOverlays(page);
    const card = () => page.locator("h3:has-text('verify-mtf')").first();
    if ((await card().count()) === 0) {
      await page.getByRole("button", { name: /Nuova Sessione|Prima Sessione/i }).first().click().catch(() => {});
      await page.waitForTimeout(600);
      await page.getByPlaceholder(/es\. Strategia/i).first().fill("verify-mtf").catch(() => {});
      await page.getByRole("button", { name: /^M15$/ }).first().click().catch(() => {});
      await dismissOverlays(page);
      await page.getByRole("button", { name: /Crea Sessione/i }).click().catch(() => {});
      await card().waitFor({ timeout: 10000 }).catch(() => {});
    }
    await shot(page, "02-sessions.png");

    // Open the session → replay chart.
    await dismissOverlays(page);
    await card().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(4000); // chart fetch + render
    await dismissOverlays(page);
    await shot(page, "03-replay.png");

    // Toggle the MTF context (Layers button, title contains "contesto").
    await dismissOverlays(page);
    const layers = page.locator('button[title*="ontesto"]').first();
    if (await layers.count()) {
      await layers.click();
      await page.waitForTimeout(4000); // HTF series fetch + render
      await shot(page, "04-mtf-on.png");
      console.log("✅ toggled MTF context");

      // 🔍 Probe: advance the replay; the context chart must track the cursor.
      const play = page.locator("button:has(.lucide-play)").first();
      if (await play.count()) {
        await play.click().catch(() => {});
        await page.waitForTimeout(2500);
        await page.locator("button:has(.lucide-pause)").first().click().catch(() => {});
        await page.waitForTimeout(1500);
        await shot(page, "05-mtf-advanced.png");
        console.log("🔍 advanced replay with MTF on");
      }
    } else {
      console.log("⚠️ Layers toggle not found");
      await shot(page, "04-no-toggle.png");
    }
  } catch (err) {
    console.error("driver error:", err?.message ?? err);
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
