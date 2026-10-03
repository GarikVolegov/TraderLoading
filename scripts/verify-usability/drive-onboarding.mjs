// Usability driver — area "onboarding": first sign-in experience of a VIRGIN user (USER_B).
// Documents the REAL sequence: what shows on "/" at first access, the /welcome nickname
// step, the full-screen pair onboarding, the app tutorial wizard, and the first-use
// empty states of every dashboard widget (mobile + desktop, full-page screenshots).
//
// ⚠ The first execution consumes USER_B's virgin state (pairs + tutorial). Re-runs
// degrade gracefully: they log "già onboardato" and verify what remains verifiable
// (/welcome nickname flow, dashboard states).
//
// Run from repo root: node scripts/verify-usability/drive-onboarding.mjs
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  BASE,
  USER_B,
  ensureTestUser,
  signIn,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "onboarding";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);
const shotFull = (page, name) =>
  page
    .screenshot({ path: fileURLToPath(new URL(name, outDir)), fullPage: true })
    .then(() => console.log(`  📸 ${name} (full-page)`))
    .catch((e) => console.log(`  📸 ${name} FAILED: ${e?.message}`));

const findings = [];
const note = (step, kind, detail, severity = "media") => {
  findings.push({ step, kind, detail, severity });
  console.log(`  ▶ [${severity}] (${step}) ${detail}`);
};

// Visible-only click: several CTAs exist twice (mobile footer + hidden desktop sidebar).
async function clickVisible(locator) {
  const n = await locator.count();
  for (let i = 0; i < n; i++) {
    const el = locator.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      return true;
    }
  }
  return false;
}

// The cookie banner ("OK" senza GA, "Accetta/Rifiuta" con GA) is NOT part of the
// standard dismiss() regexes when GA is unset ("OK"), so handle it explicitly.
async function cookieBanner(page) {
  const banner = page.locator("div.fixed").filter({ hasText: /cookie tecnici/i }).first();
  if (!(await banner.isVisible().catch(() => false))) return { visible: false };
  const btn = banner.getByRole("button", { name: /^(OK|Accetta)$/ }).first();
  return { visible: true, banner, btn };
}

async function scanBodyText(page, step) {
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  if (/(?<![A-Za-z])NaN(?![A-Za-z])/.test(text)) {
    note(step, "ux", "Testo 'NaN' visibile nella pagina (valore non formattato)", "media");
  }
  if (/(?<![A-Za-z])undefined(?![A-Za-z])/.test(text)) {
    note(step, "ux", "Testo 'undefined' visibile nella pagina", "media");
  }
  if (/auto\.ui\.[0-9a-f]{6,}/.test(text)) {
    note(step, "ux", "Chiave i18n grezza (auto.ui.*) visibile nella pagina", "media");
  }
  return text;
}

async function main() {
  await ensureTestUser(USER_B);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // mobile first
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  const collectors = attachErrorCollectors(page, { allowStatus: [401, 402] });
  // Track the (expected) 402s separately so they're documented, not lost.
  const gated402 = new Set();
  page.on("response", (r) => {
    if (r.status() === 402 && r.url().startsWith(BASE)) gated402.add(new URL(r.url()).pathname);
  });

  try {
    await signIn(page, USER_B);

    // ── Pre-state: is USER_B still virgin? ─────────────────────────────────
    const settings = await apiFromPage(page, "/api/settings");
    const profile = await apiFromPage(page, "/api/profile");
    const pairs = settings.body?.selectedPairs ?? [];
    const virgin = pairs.length === 0;
    const tutorialDone = Boolean(settings.body?.onboardingTutorialCompletedAt);
    console.log(
      `state: virgin=${virgin} pairs=[${pairs.join(",")}] tutorialDone=${tutorialDone} profileName=${profile.body?.name ?? "(none)"}`,
    );
    if (!virgin) {
      note(
        "pre-state",
        "assertion",
        `USER_B già onboardato (pairs=[${pairs.join(",")}], tutorialDone=${tutorialDone}): run degradata — pair-onboarding e tutorial non riesercitabili, verifico /welcome + dashboard`,
        "info",
      );
    }

    // ── STEP 1: cosa appare al primo accesso su "/" ────────────────────────
    await page.waitForTimeout(2500);
    const pairScreenVisible = await page
      .getByText("Quali strumenti segui?")
      .first()
      .isVisible()
      .catch(() => false);
    const tutorialVisible = await page
      .getByText("Guida rapida dell'app")
      .first()
      .isVisible()
      .catch(() => false);
    const cookie1 = await cookieBanner(page);
    console.log(
      `first-load: pairOnboarding=${pairScreenVisible} tutorial=${tutorialVisible} cookieBanner=${cookie1.visible}`,
    );
    await shot(page, "01-first-load-root-mobile.png");
    note(
      "first-load",
      "assertion",
      `Sequenza reale al primo accesso su "/": ${
        pairScreenVisible ? "selezione pair a schermo intero" : tutorialVisible ? "tutorial" : "dashboard diretta"
      }${cookie1.visible ? " + banner cookie sovrapposto" : ""} (il /welcome nickname appare solo via redirect post-sign-up)`,
      "info",
    );
    if (virgin && !pairScreenVisible) {
      note(
        "first-load",
        "assertion",
        "Utente vergine ma la selezione pair NON è apparsa su / entro il timeout",
        "alta",
      );
    }

    // Cookie banner vs. CTA overlap (mobile): the banner is z-[80], the pair
    // onboarding CTA sits in a sticky footer — do they collide?
    if (cookie1.visible && pairScreenVisible) {
      const ctaBox = await page
        .getByRole("button", { name: /Inizia con \d+ pair|Seleziona almeno un pair/ })
        .first()
        .boundingBox()
        .catch(() => null);
      const bannerBox = await cookie1.banner.boundingBox().catch(() => null);
      if (ctaBox && bannerBox) {
        const overlap = !(
          bannerBox.y > ctaBox.y + ctaBox.height ||
          bannerBox.y + bannerBox.height < ctaBox.y
        );
        if (overlap) {
          note(
            "first-load",
            "ux",
            "Il banner cookie (z-80) copre il footer CTA della selezione pair su mobile: un nuovo utente deve prima chiudere il banner per vedere/premere 'Inizia con N pair'",
            "media",
          );
          await shot(page, "01b-cookie-overlaps-pair-cta.png");
        }
      }
      if (cookie1.btn) await cookie1.btn.click().catch(() => {});
      await page.waitForTimeout(300);
    } else if (cookie1.visible && cookie1.btn) {
      await cookie1.btn.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // ── STEP 2: /welcome — nickname (rotta reale post-sign-up) ─────────────
    await page.goto(`${BASE}/welcome`, { waitUntil: "domcontentloaded" });
    const nickInput = page.getByPlaceholder("Es. PipHunter");
    const nickVisible = await nickInput
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await shot(page, "02-welcome-nickname-mobile.png");
    if (!nickVisible) {
      note("welcome", "assertion", "/welcome non mostra il form nickname (input 'Es. PipHunter' assente)", "alta");
    } else {
      const nickname = `VerifyB${Date.now().toString(36)}`;
      await nickInput.fill(nickname);
      const availability = await page
        .getByText(/^(Disponibile|Già in uso)$/)
        .first()
        .waitFor({ state: "visible", timeout: 8000 })
        .then(async () => (await page.getByText("Disponibile").first().isVisible().catch(() => false)) ? "ok" : "taken")
        .catch(() => "none");
      if (availability === "none") {
        note(
          "welcome",
          "assertion",
          "Nessun feedback di disponibilità nickname ('Disponibile'/'Già in uso') entro 8s dopo la digitazione",
          "media",
        );
      }
      await shot(page, "03-welcome-nickname-filled.png");
      await page.getByRole("button", { name: "Continua" }).first().click();
      const backHome = await page
        .waitForURL((u) => new URL(u).pathname === "/", { timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      if (!backHome) {
        note(
          "welcome",
          "assertion",
          `Dopo 'Continua' non sono tornato su "/" (URL: ${page.url()}) — possibile dead-end del form nickname`,
          "alta",
        );
        await shot(page, "03b-welcome-stuck.png");
        await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      } else {
        console.log("  nickname salvato, redirect su / ok");
      }
    }

    // ── STEP 3: selezione pair a schermo intero (solo run vergine) ─────────
    const pairHeading = page.getByText("Quali strumenti segui?").first();
    const pairShows = await pairHeading
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (pairShows) {
      await scanBodyText(page, "pair-onboarding");
      await shot(page, "04-pair-onboarding-empty-mobile.png");

      // I più usati: chips rapidi
      const chipEur = page.getByRole("button", { name: "+ EUR/USD" }).first();
      if (await chipEur.isVisible().catch(() => false)) {
        await chipEur.click();
      } else {
        note("pair-onboarding", "assertion", "Chip rapido '+ EUR/USD' non visibile tra 'I più usati'", "media");
      }
      const chipGold = page.getByRole("button", { name: "+ XAU/USD" }).first();
      if (await chipGold.isVisible().catch(() => false)) await chipGold.click();

      // Ricerca: "gbp" → selezione dal grid
      const search = page.locator("input").first();
      await search.fill("gbp");
      await page.waitForTimeout(400);
      const gridGbp = page.getByRole("button", { name: "GBP/USD", exact: true }).first();
      if (await gridGbp.isVisible().catch(() => false)) {
        await gridGbp.click();
      } else {
        note("pair-onboarding", "assertion", "Cercando 'gbp' il pair GBP/USD non compare nel grid", "media");
      }
      await search.fill("");
      await page.waitForTimeout(300);
      await shot(page, "05-pair-onboarding-selected-mobile.png");

      const cta = page.getByRole("button", { name: /Inizia con \d+ pair/ });
      const clicked = await clickVisible(cta);
      if (!clicked) {
        note("pair-onboarding", "assertion", "CTA 'Inizia con N pair' non cliccabile dopo la selezione", "alta");
      } else {
        const gone = await pairHeading
          .waitFor({ state: "hidden", timeout: 8000 })
          .then(() => true)
          .catch(() => false);
        if (!gone) {
          note("pair-onboarding", "assertion", "La schermata pair non si chiude dopo il CTA di conferma", "alta");
        }
      }
    } else if (virgin) {
      note("pair-onboarding", "assertion", "Utente vergine: selezione pair mai apparsa dopo il nickname", "alta");
    } else {
      console.log("  pair onboarding già consumato in una run precedente — skip");
    }

    // ── STEP 4: tutorial wizard (4 slide) ──────────────────────────────────
    const tutorialTitle = page.getByText("Guida rapida dell'app").first();
    const tutorialShows = await tutorialTitle
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (tutorialShows) {
      const hasProgress = await page
        .getByText("Passo 1 di 4")
        .first()
        .isVisible()
        .catch(() => false);
      if (!hasProgress) {
        note("tutorial", "assertion", "Indicatore 'Passo 1 di 4' non visibile nel tutorial", "bassa");
      }
      await shot(page, "06-tutorial-slide1.png");
      for (let i = 2; i <= 4; i++) {
        await page.getByRole("button", { name: "Avanti" }).first().click();
        await page.waitForTimeout(500);
        await shot(page, `0${5 + i - 1}-tutorial-slide${i}.png`); // 07..09
      }
      await page.getByRole("button", { name: "Fine" }).first().click();
      const closed = await tutorialTitle
        .waitFor({ state: "hidden", timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!closed) note("tutorial", "assertion", "Il tutorial non si chiude dopo 'Fine'", "media");
    } else if (pairShows && !tutorialDone) {
      note(
        "tutorial",
        "assertion",
        "Tutorial 'Guida rapida dell'app' non apparso dopo la conferma dei pair (atteso per utente vergine)",
        "media",
      );
    } else {
      console.log("  tutorial già completato — skip");
    }

    // ── STEP 5: dashboard primo-uso — empty state dei widget (mobile) ──────
    await settle(page, 4);
    await page.waitForTimeout(3000); // let the widgets fetch
    const bodyText = await scanBodyText(page, "dashboard-mobile");
    const emptyLines = bodyText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(Nessun|Nessuna|Non hai|Aggiungi|Collega|Inizia|Crea)/.test(l) && l.length < 90);
    console.log("  empty-state copy visibile (mobile):");
    for (const l of [...new Set(emptyLines)]) console.log(`    · ${l}`);
    const crashed = (await page.locator("[data-root-error-boundary]").count()) > 0;
    if (crashed) note("dashboard-mobile", "assertion", "RootErrorBoundary attivo sulla dashboard nuovo utente", "alta");
    await shotFull(page, "10-dashboard-new-user-mobile-full.png");

    // ── STEP 6: dashboard primo-uso (desktop 1440x900) ─────────────────────
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page, 4);
    await page.waitForTimeout(4000);
    await scanBodyText(page, "dashboard-desktop");
    const crashedDesk = (await page.locator("[data-root-error-boundary]").count()) > 0;
    if (crashedDesk) note("dashboard-desktop", "assertion", "RootErrorBoundary attivo (desktop)", "alta");
    await shotFull(page, "11-dashboard-new-user-desktop-full.png");

    if (gated402.size > 0) {
      note(
        "dashboard",
        "failed-request",
        `Endpoint Pro-gated 402 per utente free (atteso, gate server-side attivo): ${[...gated402].join(", ")}`,
        "info",
      );
    }

    // Verify post-state really persisted (idempotence of the run).
    const after = await apiFromPage(page, "/api/settings");
    const afterPairs = after.body?.selectedPairs ?? [];
    if (afterPairs.length === 0) {
      note("post-state", "assertion", "selectedPairs ancora vuoti a fine run: la conferma pair non ha persistito", "alta");
    }
    console.log(`post-state: pairs=[${afterPairs.join(",")}] tutorialDone=${Boolean(after.body?.onboardingTutorialCompletedAt)}`);

    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.stack ?? err?.message ?? err);
    note("driver", "assertion", `Crash del driver: ${err?.message ?? err}`, "alta");
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    reportFindings(AREA, findings, collectors);
    await browser.close();
  }
}

main();
