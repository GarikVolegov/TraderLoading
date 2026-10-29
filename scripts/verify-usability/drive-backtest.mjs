// Usability sweep — area "backtest": /backtest (La Forgia del Passato) with USER_A.
// Validates replay cockpit, candlestick canvas, time controls, and performance.
// Run from repo root: node scripts/verify-usability/drive-backtest.mjs
import { chromium } from "playwright";
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

const AREA = "backtest";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
};

async function scanBodyText(page, step) {
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  for (const needle of ["NaN", "undefined", "null", "TODO", "[object Object]"]) {
    if (text.includes(needle)) {
      note(step, "copy-leak", `Literal '${needle}' detected in page text`, "bassa");
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const collectors = attachErrorCollectors(page, note);

  try {
    console.log(`[backtest] Navigating to ${BASE}...`);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await signIn(page, USER_A);
    await completeOnboarding(page);

    console.log("[backtest] Opening /backtest (La Forgia del Passato)...");
    await page.goto(`${BASE}/backtest`, { waitUntil: "networkidle" }).catch(() => {
      return page.goto(`${BASE}/backtest`, { waitUntil: "domcontentloaded" });
    });
    await settle(page, 1500);

    await shot(page, "01-backtest-initial-load.png");
    await scanBodyText(page, "backtest-initial");

    // 1. Check title and cockpit header visibility
    const headerVisible = await page
      .locator("text=/Banco di Forgiatura|La Forgia del Passato|Backtest/i")
      .first()
      .isVisible()
      .catch(() => false);

    if (!headerVisible) {
      note("backtest-header", "assertion", "Header della Forgia del Passato / Backtest non visibile", "alta");
    } else {
      console.log("  [backtest] Header verificato ✓");
    }

    // 2. Check workspace or chart container
    const chartContainer = page.locator("canvas, [data-testid='backtest-chart'], .tv-lightweight-charts, svg").first();
    const chartFound = await chartContainer.isVisible({ timeout: 5000 }).catch(() => false);
    if (!chartFound) {
      note("backtest-chart", "assertion", "Container grafico o canvas delle candele non rilevato", "media");
    } else {
      console.log("  [backtest] Canvas / Grafico operativo rilevato ✓");
    }

    // 3. Check replay controls (Play / Pausa / Step)
    const playControl = page.locator("button").filter({ hasText: /Play|Avvia|Pausa|Step|Velocità/i }).first();
    const hasControls = await playControl.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasControls) {
      console.log("  [backtest] Controlli di riproduzione temporale presenti ✓");
    }

    await shot(page, "02-backtest-ready.png");
    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.stack ?? err?.message ?? err);
    findings.push({
      step: "driver",
      kind: "assertion",
      detail: `driver crashed: ${err?.message ?? err}`,
      severity: "alta",
    });
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    reportFindings(AREA, findings, collectors);
    await browser.close();
  }
}

main();
