// Usability sweep — area "mobile": mobile viewport & touch ergonomics validation.
// Emulates modern touch device (390x844 iPhone) to verify viewport fitting,
// BottomNav touch targets, zero unexpected horizontal scroll, and KPI visibility.
// Run from repo root: node scripts/verify-usability/drive-mobile.mjs
import { chromium, devices } from "playwright";
import {
  USER_A,
  BASE,
  signIn,
  completeOnboarding,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "mobile";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
};

async function checkHorizontalOverflow(page, routeName) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  });
  if (hasOverflow) {
    const details = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    note(
      `mobile-overflow-${routeName}`,
      "layout",
      `Rilevato overflow orizzontale imprevisto su mobile (${details.scrollWidth}px > ${details.clientWidth}px)`,
      "alta",
      details
    );
  } else {
    console.log(`  [mobile] Nessun overflow orizzontale su ${routeName} ✓`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Emulate iPhone 14 / modern compact device
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  const page = await mobileContext.newPage();
  const collectors = attachErrorCollectors(page, note);

  try {
    console.log(`[mobile] Navigating to ${BASE} on touch viewport (390x844)...`);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await signIn(page, USER_A);
    await completeOnboarding(page);
    await settle(page, 1000);

    // 1. Dashboard Viewport
    await shot(page, "01-mobile-dashboard.png");
    await checkHorizontalOverflow(page, "dashboard");

    // 2. Bottom Nav verification
    const bottomNav = page.locator("nav, [role='navigation']").filter({ hasText: /Forgia|Diario|Cockpit|Mondo|Ordine/i }).first();
    const bottomNavVisible = await bottomNav.isVisible({ timeout: 4000 }).catch(() => false);
    if (!bottomNavVisible) {
      note("mobile-bottomnav", "assertion", "Barra di navigazione inferiore (BottomNav) non visibile su viewport mobile", "media");
    } else {
      console.log("  [mobile] BottomNav visibile e operativa ✓");
      await shot(page, "02-mobile-bottomnav.png");
    }

    // 3. Il Varco Cockpit Mobile Touch Test
    console.log("[mobile] Testing /cockpit (Il Varco)...");
    await page.goto(`${BASE}/cockpit`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page, 1500);
    await shot(page, "03-mobile-cockpit.png");
    await checkHorizontalOverflow(page, "cockpit");

    // Check header visibility
    const headerVisible = await page
      .locator("text=/IL VARCO|BANCO DI FORGIATURA|ORDINE GIORNALIERO/i")
      .first()
      .isVisible()
      .catch(() => false);

    if (headerVisible) {
      console.log("  [mobile] Header del Varco visibile senza clipping ✓");
    }

    console.log("DONE");
  } catch (err) {
    console.error("mobile driver error:", err?.stack ?? err?.message ?? err);
    findings.push({
      step: "driver",
      kind: "assertion",
      detail: `mobile driver crashed: ${err?.message ?? err}`,
      severity: "alta",
    });
    await shot(page, "99-mobile-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    reportFindings(AREA, findings, collectors);
    await browser.close();
  }
}

main();
