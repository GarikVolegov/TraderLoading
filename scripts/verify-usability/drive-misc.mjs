// Usability sweep — area "misc": a light but observant pass over several
// standalone pages with USER_A (Dashboard, Settings, Routine, News, Checklist,
// Clock, Library, Calendar). Looks for raw i18n keys, NaN/undefined text,
// console/network errors, uncurated empty states and actions with no feedback.
// Run from the repo root: node scripts/verify-usability/drive-misc.mjs
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  USER_A,
  BASE,
  signIn,
  completeOnboarding,
  outDirFor,
  makeShot,
  settle,
  dismiss,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "misc";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
};

/** Full-page screenshot (makeShot from lib/common.mjs is viewport-only). */
function shotFull(page, name) {
  return page
    .screenshot({ path: fileURLToPath(new URL(name, outDir)), fullPage: true })
    .then(() => console.log(`  📸 ${name}`))
    .catch((e) => console.log(`  📸 ${name} FAILED: ${e?.message}`));
}

/** Scans the rendered body text for raw i18n keys / NaN / undefined leaking into the UI. */
async function scanRawArtifacts(page, step) {
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  const rawKeys = [...new Set(text.match(/\bauto\.ui\.[0-9a-f]{6,}\b/g) ?? [])];
  const nanHits = /\bNaN\b/.test(text);
  const undefinedHits = /\bundefined\b/.test(text);
  if (rawKeys.length) {
    note(step, "assertion", `Raw i18n key(s) leaked into the rendered page: ${rawKeys.join(", ")}`, "alta");
  }
  if (nanHits) note(step, "assertion", '"NaN" found in rendered page text', "alta");
  if (undefinedHits) note(step, "assertion", '"undefined" found in rendered page text', "alta");
}

/** Any element still spinning after settle() suggests a query that never resolves. */
async function countSpinners(page) {
  return page.locator(".animate-spin").count().catch(() => 0);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: MOBILE });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  const collectors = attachErrorCollectors(page, { allowStatus: [401] });
  const stamp = Date.now();

  try {
    await signIn(page, USER_A);
    await completeOnboarding(page);

    // The technical-only cookie notice (CookieConsentPopup) is a bottom-fixed
    // banner, not a `.fixed.inset-0` modal, so the shared dismiss()/settle()
    // helpers never target it (its OK button isn't in their DISMISS regex list).
    // Dismiss it once up front so it doesn't clutter every screenshot below.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const cookieOk = page.getByRole("button", { name: "OK", exact: true }).first();
    if (await cookieOk.isVisible().catch(() => false)) await cookieOk.click().catch(() => {});
    await page.waitForTimeout(300);

    // ── 1. Dashboard (mobile) ─────────────────────────────────────────────
    await page.setViewportSize(MOBILE);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.waitForTimeout(1500); // give lazy widgets (COT, sentiment, watchlist) a chance to resolve
    await scanRawArtifacts(page, "dashboard");

    const spinners = await countSpinners(page);
    if (spinners > 0) {
      note("dashboard", "ux", `${spinners} widget(s) still show a spinner after settle+1.5s wait (possibly stuck loading)`, "media");
    }

    const sentimentHeader = page.getByText("Sentiment", { exact: true }).first();
    const sentimentVisible = await sentimentHeader.isVisible().catch(() => false);
    console.log(`  [dashboard] Sentiment widget visible: ${sentimentVisible}`);
    if (sentimentVisible) {
      const sentimentBody = await page.locator(".dashboard-widget-shell", { has: sentimentHeader }).innerText().catch(() => "");
      console.log(`  [dashboard] Sentiment widget text: ${JSON.stringify(sentimentBody.slice(0, 160))}`);
      note(
        "dashboard-sentiment",
        "ux",
        "Sentiment widget IS visible with data — MYFXBOOK_EMAIL/PASSWORD are set in .env.local locally, so the widget renders live (or last-good) numbers instead of being hidden. This differs from prod (no creds → hidden per SentimentWidget.tsx's `if (data && !data.hasCredentials) return null`) — expected/correct behavior, not a bug, but worth confirming this is the intended local state.",
        "bassa",
      );
    } else {
      note("dashboard-sentiment", "ux", "Sentiment widget is NOT visible even though MYFXBOOK_EMAIL/PASSWORD are set in .env.local — check /api/tools/sentiment response (hasCredentials flag / myfxbook login failure)", "alta");
    }
    await shotFull(page, "01-dashboard-mobile.png");

    // ── 2. Settings (desktop) ─────────────────────────────────────────────
    await page.setViewportSize(DESKTOP);
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "settings");
    await shot(page, "02-settings-overview.png");

    // Desktop left-rail sections: click each, watch for crashes / raw keys.
    // Accessible name = label + subtitle concatenated, so anchor at the start.
    const railClick = async (label) => {
      const btn = page.getByRole("button", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
      const ok = await btn.isVisible().catch(() => false);
      if (!ok) {
        note("settings-rail", "assertion", `Left-rail section "${label}" not found/visible on desktop`, "media");
        return false;
      }
      await btn.click();
      await page.waitForTimeout(500);
      return true;
    };

    const sections = [
      "Abbonamento", "Pair Preferiti", "Aspetto", "Notifiche", "Sicurezza",
      "Lingua", "Trading", "Missioni", "Citazioni", "Checklist", "Biblioteca",
      "Supporto & Aiuto", "Aiuto", "Termini & Condizioni", "Account",
    ];
    for (const label of sections) {
      const opened = await railClick(label);
      if (opened) await scanRawArtifacts(page, `settings-${label}`);
    }

    // Re-open "Abbonamento" specifically to check the creator payout card.
    await railClick("Abbonamento");
    await page.waitForTimeout(500);
    const payoutCard = page.getByText("Ricevi pagamenti", { exact: false }).first();
    const payoutVisible = await payoutCard.isVisible().catch(() => false);
    console.log(`  [settings] Creator payout card visible: ${payoutVisible}`);
    await shot(page, "03-settings-abbonamento.png");
    note(
      "settings-payout",
      "ux",
      payoutVisible
        ? 'Creator payout card ("Ricevi pagamenti") IS shown under Abbonamento — CreatorPayoutSettings hides only when Stripe Connect has no secret key at all (`account.available === false`); here it renders (Stripe is configured locally), which is the expected "pertinent" case.'
        : 'Creator payout card is hidden under Abbonamento (Stripe Connect not configured as "available") — correctly not shown when not pertinent.',
      "bassa",
    );

    // ── 3. Routine (desktop) ──────────────────────────────────────────────
    await page.goto(`${BASE}/routine`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "routine");
    await shot(page, "04-routine.png");

    // Mood check-in: click a mood, verify it's recorded.
    const moodBtn = page.getByRole("button", { name: /Calmo/ }).first();
    if (await moodBtn.isVisible().catch(() => false)) {
      await moodBtn.click();
      await page.waitForTimeout(300);
      const recorded = await page.getByText("Umore registrato", { exact: false }).first().isVisible().catch(() => false);
      if (!recorded) {
        note("routine-mood", "assertion", 'Mood check-in click did not show "Umore registrato" confirmation text', "media");
      } else {
        console.log("  [routine] mood check-in recorded ✓");
      }
      // Mood labels were hardcoded Italian literals in ZenZone.tsx before the
      // 2026-07-13 fix (commit 09f9f41) — now routed through MOOD_META.labelKey
      // + uiText(), confirmed fixed. No live assertion here: the bug was in the
      // component's source, not something this driver can usefully re-detect
      // from the DOM (rendered text is always Italian for an it-locale test user).
    } else {
      note("routine-mood", "assertion", 'Mood check-in button "Calmo" not found on /routine', "media");
    }
    await shot(page, "05-routine-mood-checked.png");

    // ── 4. News (mobile) ───────────────────────────────────────────────────
    await page.setViewportSize(MOBILE);
    await page.goto(`${BASE}/news`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.waitForTimeout(1200); // let the article fetch + WS snapshot land
    await scanRawArtifacts(page, "news");
    await shotFull(page, "06-news-mobile.png");

    const articleCards = page.locator('div[role="button"]');
    const articleCount = await articleCards.count();
    console.log(`  [news] article cards: ${articleCount}`);
    if (articleCount === 0) {
      note("news", "ux", "No article cards rendered on /news — cannot verify filters or article detail", "media");
    } else {
      const impactAlto = page.getByRole("button", { name: "Alto", exact: true }).first();
      if (await impactAlto.isVisible().catch(() => false)) {
        await impactAlto.click();
        await page.waitForTimeout(400);
        const afterFilterCount = await articleCards.count();
        console.log(`  [news] cards after "Alto" impact filter: ${afterFilterCount}`);
        if (afterFilterCount > articleCount) {
          note("news-filters", "assertion", 'Clicking "Alto" impact filter increased the visible article count instead of narrowing it', "alta");
        }
        await shot(page, "07-news-filtered-alto.png");
        // Reset filter back to "Tutti" before opening an article.
        const impactTutti = page.getByRole("button", { name: "Tutti", exact: true }).first();
        if (await impactTutti.isVisible().catch(() => false)) await impactTutti.click();
        await page.waitForTimeout(400);
      } else {
        note("news-filters", "assertion", 'Impact filter "Alto" not visible on /news even though articles are present', "media");
      }

      const firstCard = articleCards.first();
      await firstCard.click();
      const dialogOpen = await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
      if (!dialogOpen) {
        note("news-detail", "assertion", "Clicking an article card did not open the detail dialog", "alta");
      } else {
        console.log("  [news] article detail dialog opened ✓");
        await shot(page, "08-news-article-detail.png");
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // ── 5. Checklist (desktop): create → check off on Dashboard → delete ──
    await page.setViewportSize(DESKTOP);
    await page.goto(`${BASE}/checklist`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "checklist");
    const itemText = `Usability check ${stamp}`;
    await page.getByPlaceholder("es. Ho controllato le news...").fill(itemText);
    await page.getByRole("button", { name: "Aggiungi", exact: true }).first().click();
    const itemVisible = await page.getByText(itemText, { exact: false }).first().waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false);
    if (!itemVisible) {
      note("checklist-create", "assertion", `Created checklist item "${itemText}" not visible in the list`, "alta");
    } else {
      console.log("  [checklist] item visible ✓");
    }
    await shot(page, "09-checklist-created.png");

    // The /checklist page itself has NO check/toggle affordance (only add + delete —
    // the CheckCircle2 icon next to each item is purely decorative, no onClick).
    // The actual "spunta" interaction lives on the Dashboard's ChecklistDashboardWidget,
    // which persists per-day tick state in localStorage (tl_confirmation_session),
    // independent of the item's server-side existence.
    note(
      "checklist-page",
      "ux",
      "The /checklist page (\"Criteri di Conferma\") only supports add/delete — there is no check/toggle on this page itself (the CheckCircle2 icon per row is decorative). The actual tick-off interaction is a separate widget on the Dashboard (ChecklistDashboardWidget), which may not be obvious to a user landing on /checklist expecting to tick items there.",
      "media",
    );

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const dashItemBtn = page.getByRole("button", { name: itemText, exact: false }).first();
    const dashItemVisible = await dashItemBtn.isVisible().catch(() => false);
    if (!dashItemVisible) {
      note("checklist-toggle", "assertion", `Created checklist item "${itemText}" not visible in the Dashboard's ChecklistDashboardWidget`, "alta");
    } else {
      await dashItemBtn.click();
      await page.waitForTimeout(400);
      const checkedClass = await dashItemBtn.evaluate((el) => el.className);
      const looksChecked = /line-through/.test(await dashItemBtn.innerHTML().catch(() => ""));
      console.log(`  [checklist] toggled on Dashboard widget, checked style applied: ${looksChecked}`);
      if (!looksChecked) {
        note("checklist-toggle", "assertion", "Clicking the checklist item on the Dashboard widget did not apply the checked (line-through) style", "alta", { classAfterClick: checkedClass });
      } else {
        console.log("  [checklist] item checked off on Dashboard widget ✓");
      }
      await shotFull(page, "10-dashboard-checklist-checked.png");
    }

    await page.goto(`${BASE}/checklist`, { waitUntil: "domcontentloaded" });
    await settle(page);
    // The checklist query can occasionally still be in flight right after the
    // settle() rounds (two full navigations in quick succession) — poll briefly
    // instead of deciding "not found" on the very first check.
    const delRow = page.locator("div.group", { has: page.getByText(itemText, { exact: false }) }).first();
    for (let attempt = 0; attempt < 4 && (await delRow.count()) === 0; attempt++) {
      await page.waitForTimeout(750);
    }
    if (await delRow.count()) {
      await delRow.hover().catch(() => {});
      const trashBtn = delRow.getByRole("button").first();
      if (await trashBtn.count()) {
        await trashBtn.click().catch(() => {});
        await page.waitForTimeout(700);
        const stillThere = await page.getByText(itemText, { exact: false }).count();
        if (stillThere > 0) {
          note("checklist-delete", "assertion", "Checklist item still present after clicking delete", "alta");
        } else {
          console.log("  [checklist] item deleted ✓");
        }
        note(
          "checklist-delete",
          "ux",
          "Deleting a checklist criterion happens immediately with no confirmation dialog and no undo (same pattern already found on Journal idee/obiettivi rows) — a mis-click permanently loses a pre-trade criterion.",
          "bassa",
        );
      } else {
        note("checklist-delete", "assertion", "Delete (trash) button not found on the checklist row", "media");
      }
    } else {
      note("checklist-delete", "assertion", `Checklist row "${itemText}" not found for cleanup`, "media");
    }
    await shot(page, "11-checklist-after-delete.png");

    // ── 6. Clock (desktop) ─────────────────────────────────────────────────
    await page.goto(`${BASE}/clock`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "clock");
    const sessionCards = await page.getByText("ORARIO LOCALE", { exact: false }).count().catch(() => 0);
    console.log(`  [clock] session cards rendered: ${sessionCards}`);
    if (sessionCards === 0) {
      note("clock", "ux", "No market-session cards rendered on /clock (tradingSessions empty or all disabled) — page falls back to its empty state", "media");
    }
    await shot(page, "12-clock.png");

    // ── 7. Library (desktop) ────────────────────────────────────────────────
    await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "library");
    const libraryEmpty = await page.getByText("Biblioteca in costruzione", { exact: false }).first().isVisible().catch(() => false);
    const libraryAddBtn = await page.getByRole("button", { name: /Aggiungi/i }).first().isVisible().catch(() => false);
    console.log(`  [library] empty state visible: ${libraryEmpty}, admin "add content" button visible: ${libraryAddBtn}`);
    if (libraryEmpty && !libraryAddBtn) {
      note("library", "ux", 'Library is empty for this (non-admin) user with no way to add content — shows the "Biblioteca in costruzione" empty state with no admin controls. Confirmed dark/empty-by-default XP-gated feed (matches CLAUDE.md §7 note: ships empty, no seed data).', "bassa");
    } else if (!libraryEmpty) {
      note("library", "ux", "Library shows content (not the empty state) — unexpected given CLAUDE.md notes it ships empty with no seed data; worth a closer look at what's rendering", "media");
    }
    await shot(page, "13-library.png");

    // ── 8. Calendar (desktop) ───────────────────────────────────────────────
    await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanRawArtifacts(page, "calendar");
    await shot(page, "14-calendar.png");

    await dismiss(page);
    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.message ?? err);
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
