// Manual runtime verifier for the generalized contextual hub nav
// (Community/Journal/Zen) on BottomNav.tsx — mobile pill (incl. overflow
// sheet) + desktop sidebar. Not part of the automated test suite; run by
// hand against a local dev server. Mirrors scripts/verify-archive/drive.mjs.
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

const outDir = new URL("../../artifacts.local/verify-nav-hubs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, outDir)) }).then(() => console.log(`  📸 ${name}`));

const DISMISS = [/^Accetta$/, /^Skip$/i, /^Dopo$/i, /^Salta$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
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
    if ((await page.locator(".fixed.inset-0").count()) === 0) break;
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
    await setupClerkTestingToken({ page });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    const ticket = await mintTicket(userId);
    await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket } });

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 15000 }).catch(() => {});

    await page.evaluate(async () => {
      let token = null;
      try { token = await window.Clerk?.session?.getToken(); } catch { /* cookie */ }
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ selectedPairs: ["EUR/USD"], onboardingTutorialCompletedAt: new Date().toISOString() }),
      });
    });

    // ── Mobile: /journal hub swap + overflow sheet ──────────────────────
    await page.goto(`${BASE}/journal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 8; i++) { await dismiss(page); await page.waitForTimeout(600); }
    console.log("  [journal/mobile] exit arrow visible:", await page.getByRole("link", { name: "Home" }).count());
    console.log("  [journal/mobile] panoramica tab link present:", await page.locator('a[href="/journal?t=panoramica"]').count());
    console.log("  [journal/mobile] trades tab link present:", await page.locator('a[href="/journal?t=trades"]').count());
    console.log("  [journal/mobile] idee tab link present:", await page.locator('a[href="/journal?t=idee"]').count());
    console.log("  [journal/mobile] obiettivi tab link present:", await page.locator('a[href="/journal?t=obiettivi"]').count());
    console.log("  [journal/mobile] recap-settimanale NOT directly in pill (overflowed):", await page.locator('a[href="/journal?t=recap-settimanale"]').count());
    console.log("  [journal/mobile] Più (overflow) visible:", await page.getByRole("button", { name: "Più" }).count());
    // Regression check: landing on bare /journal (no ?t=) must still highlight
    // Panoramica as active — it must NOT silently fall back to Community's
    // "social" default and leave every item unhighlighted.
    const panoramicaClass = await page.locator('a[href="/journal?t=panoramica"]').first().getAttribute("class");
    console.log("  [journal/mobile] Panoramica active on bare /journal (text-primary in class):", panoramicaClass?.includes("text-primary"));
    await shot(page, "01-journal-mobile-pill.png");

    for (let i = 0; i < 5; i++) { await dismiss(page); await page.waitForTimeout(400); }
    await page.getByRole("button", { name: "Più" }).first().click();
    await page.waitForTimeout(500);
    console.log("  [journal/mobile] overflow sheet shows Recap Sett.:", await page.getByText("Recap Sett.").count());
    await shot(page, "02-journal-mobile-overflow-sheet.png");
    await page.getByRole("link", { name: /Recap Sett\./ }).first().click();
    await page.waitForTimeout(700);
    console.log("  [journal/mobile] URL after overflow tap:", page.url());
    await shot(page, "03-journal-mobile-recap-settimanale.png");

    // Exit hub via the back arrow → Home, root nav restored.
    await page.getByRole("link", { name: "Home" }).first().click();
    await page.waitForTimeout(700);
    console.log("  [after exit] URL:", page.url());
    console.log("  [after exit] root /journal link present (root nav restored):", await page.locator('a[href="/journal"]').count());
    console.log("  [after exit] Più (overflow) gone:", await page.getByRole("button", { name: "Più" }).count());
    await shot(page, "04-after-exit-root-nav.png");

    // ── Mobile: /zen hub swap ────────────────────────────────────────────
    await page.goto(`${BASE}/zen`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(500); }
    console.log("  [zen/mobile] breathing tab link present:", await page.locator('a[href="/zen?t=breathing"]').count());
    console.log("  [zen/mobile] quotes NOT directly in pill (overflowed):", await page.locator('a[href="/zen?t=quotes"]').count());
    console.log("  [zen/mobile] Più (overflow) visible:", await page.getByRole("button", { name: "Più" }).count());
    await shot(page, "05-zen-mobile-pill.png");

    // ── Desktop: /journal sidebar shows full hub list, no overflow ─────
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/journal?t=idee`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(500); }
    console.log("  [journal/desktop] Home exit row visible:", await page.getByRole("link", { name: "Home" }).count());
    console.log("  [journal/desktop] Obiettivi visible (no overflow needed):", await page.locator('a[title="Obiettivi"]').count());
    console.log("  [journal/desktop] recap-mensile also directly visible (desktop = no cap):", await page.locator('a[title="Recap 4 settimane"]').count());
    await shot(page, "06-journal-desktop-sidebar.png");

    // ── In-page selectors removed: the contextual nav alone drives tabs now ──
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/journal`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(500); }
    console.log("  [journal] in-page tab-strip text gone (should be 0):", await page.getByText("Panoramica", { exact: true }).count());
    await shot(page, "07-journal-no-inpage-tabs.png");
    // Tap the nav item for "Trade" (href-based, label only flashes on tap) → content switches.
    await page.locator('a[href="/journal?t=trades"]').first().click();
    await page.waitForTimeout(700);
    console.log("  [journal] URL after nav tap:", page.url());
    console.log("  [journal] Trade content visible (Aggiungi trade / import):", await page.getByText(/trade/i).count() > 0);
    await shot(page, "08-journal-trades-via-nav-only.png");

    await page.goto(`${BASE}/zen`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(500); }
    console.log("  [zen] in-page TabsList text gone (should be 0):", await page.getByText("Respira", { exact: true }).count());
    await shot(page, "09-zen-no-inpage-tabs.png");

    await page.goto(`${BASE}/chat?t=social`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i++) { await dismiss(page); await page.waitForTimeout(500); }
    console.log("  [chat] in-page tab-strip text gone (should be 0):", await page.getByText("Classifica", { exact: true }).count());
    await shot(page, "10-chat-no-inpage-tabs.png");

    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.message ?? err);
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
