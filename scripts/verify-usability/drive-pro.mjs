// Usability driver — area "pro": Pro-gating surfaces as seen by a FREE user (USER_B).
// Verifies the 4 Pro-gated surfaces (/backtest, /broker, /wiki, /chat?t=classifica)
// show the PaywallCard over blurred content with a working CTA, that the server-side
// gates (402) don't leak Pro data to free users, and that /pro → "Passa a Pro" creates
// a real Stripe checkout session (test-mode) WITHOUT completing any payment.
//
// Run AFTER drive-onboarding.mjs (it consumes USER_B's virgin onboarding).
// Run from repo root: node scripts/verify-usability/drive-pro.mjs
import { chromium } from "playwright";
import {
  BASE,
  USER_B,
  ensureTestUser,
  signIn,
  completeOnboarding,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "pro";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const findings = [];
const note = (step, kind, detail, severity = "media") => {
  findings.push({ step, kind, detail, severity });
  console.log(`  ▶ [${severity}] (${step}) ${detail}`);
};

// Cookie banner: "OK" (no GA) is not covered by dismiss()'s regexes.
async function acceptCookies(page) {
  const banner = page.locator("div.fixed").filter({ hasText: /cookie tecnici/i }).first();
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: /^(OK|Accetta)$/ }).first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

const SURFACES = [
  { path: "/backtest", name: "backtest", title: "Sblocca il Backtesting" },
  { path: "/broker", name: "broker", title: "Sblocca il Collegamento conto" },
  { path: "/wiki", name: "wiki", title: "Sblocca l'Archivio" },
  { path: "/chat?t=classifica", name: "chat-classifica", title: "Sblocca le Classifiche" },
];

// Server-side leak probes: all must answer 402 for a free user.
const PROBES = [
  "/api/backtest/sessions",
  "/api/leaderboard",
  "/api/wiki/sources",
  "/api/brokers/profiles",
];

async function main() {
  await ensureTestUser(USER_B);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  // 402 = the Pro gate answering a free user: expected on these surfaces.
  const collectors = attachErrorCollectors(page, { allowStatus: [401, 402] });
  const gated402 = new Set();
  page.on("response", (r) => {
    if (r.status() === 402 && r.url().startsWith(BASE)) gated402.add(new URL(r.url()).pathname);
  });

  try {
    await signIn(page, USER_B);
    await completeOnboarding(page); // idempotent: USER_B is already onboarded after drive-onboarding

    // ── Pre-check: USER_B must be free ─────────────────────────────────────
    const billing = await apiFromPage(page, "/api/billing/me");
    const isPro = billing.body?.pro === true;
    console.log(`billing/me: status=${billing.status} plan=${billing.body?.plan} pro=${isPro}`);
    if (isPro) {
      note(
        "pre-state",
        "assertion",
        "USER_B risulta già Pro: i paywall non sono esercitabili in questa run (serve un utente free)",
        "info",
      );
    }

    // ── Server-side leak probes (indipendenti dalla UI) ────────────────────
    for (const probe of PROBES) {
      const r = await apiFromPage(page, probe);
      if (isPro) {
        console.log(`  probe ${probe} → ${r.status} (utente Pro, gate non atteso)`);
        continue;
      }
      if (r.status === 402) {
        console.log(`  probe ${probe} → 402 (gate server-side ok)`);
      } else if (r.status === 200) {
        note(
          "server-gate",
          "assertion",
          `LEAK: ${probe} risponde 200 con dati a un utente free (atteso 402)`,
          "alta",
        );
      } else {
        note(
          "server-gate",
          "assertion",
          `${probe} risponde ${r.status} a un utente free (atteso 402)`,
          "media",
        );
      }
    }

    // ── Le 4 superfici gated: PaywallCard + blur + CTA ─────────────────────
    for (const s of SURFACES) {
      await page.goto(`${BASE}${s.path}`, { waitUntil: "domcontentloaded" });
      await acceptCookies(page);
      await settle(page); // e.g. ChecklistSetupModal auto-opens when the checklist is empty (query settles after navigation)
      await page.waitForTimeout(1200);

      if (isPro) {
        await shot(page, `10-${s.name}-pro-user.png`);
        continue;
      }

      const title = page.getByText(s.title).first();
      const gateShown = await title
        .waitFor({ state: "visible", timeout: 12000 })
        .then(() => true)
        .catch(() => false);
      if (!gateShown) {
        note(s.name, "assertion", `PaywallCard assente su ${s.path}: titolo "${s.title}" non visibile`, "alta");
        await shot(page, `10-${s.name}-no-gate.png`);
        continue;
      }

      // checkoutAvailable is server-driven (Stripe env config) — a fresh dev
      // server missing e.g. APP_BASE_URL correctly degrades to the honest
      // "checkout_unavailable" text instead of a dead-end button (fail-safe,
      // usability audit 3.3). Both are valid; only flag if NEITHER renders.
      const ctaVisible = await page
        .getByRole("button", { name: "Passa a Pro" })
        .first()
        .isVisible()
        .catch(() => false);
      const unavailableTextVisible = await page
        .getByText("Abbonamento non disponibile al momento")
        .first()
        .isVisible()
        .catch(() => false);
      if (!ctaVisible && !unavailableTextVisible) {
        note(s.name, "assertion", `Né il CTA 'Passa a Pro' né il messaggio di indisponibilità sono visibili nel paywall di ${s.path}`, "alta");
      } else if (!ctaVisible) {
        note(s.name, "assertion", `checkoutAvailable=false lato server: paywall di ${s.path} mostra il messaggio onesto invece del CTA (verificare se atteso in questo ambiente)`, "info");
      }

      const priceVisible = await page
        .getByText("7 EUR/mese")
        .first()
        .isVisible()
        .catch(() => false);
      if (!priceVisible) note(s.name, "assertion", `Prezzo '7 EUR/mese' non visibile nel paywall di ${s.path}`, "bassa");

      // Blurred, inert content behind the card.
      const inert = page.locator("[inert]").first();
      const hasInert = (await page.locator("[inert]").count()) > 0;
      if (!hasInert) {
        note(s.name, "assertion", `Contenuto dietro il paywall di ${s.path} non è inert/sfocato`, "media");
      } else {
        const cls = (await inert.getAttribute("class").catch(() => "")) ?? "";
        if (!cls.includes("blur")) {
          note(s.name, "assertion", `Il contenitore inert di ${s.path} non ha la classe blur`, "media");
        }
        const leakText = (await inert.innerText().catch(() => "")).trim();
        console.log(`  [${s.name}] testo dietro il blur: ${leakText.length} chars`);
      }

      const discover = await page
        .getByRole("button", { name: "Scopri tutti i vantaggi" })
        .first()
        .isVisible()
        .catch(() => false);
      if (!discover) {
        note(s.name, "assertion", `Link secondario 'Scopri tutti i vantaggi' non visibile su ${s.path}`, "bassa");
      }

      await shot(page, `10-${s.name}-gate-desktop.png`);
    }

    // Mobile spot-check of the fillViewport gate (clipping / bottom-nav overlap).
    if (!isPro) {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const s of [SURFACES[0], SURFACES[3]]) {
        await page.goto(`${BASE}${s.path}`, { waitUntil: "domcontentloaded" });
        await acceptCookies(page);
      await settle(page); // e.g. ChecklistSetupModal auto-opens when the checklist is empty (query settles after navigation)
        await page.waitForTimeout(1500);
        const gateShown = await page
          .getByText(s.title)
          .first()
          .isVisible()
          .catch(() => false);
        if (!gateShown) {
          note(`${s.name}-mobile`, "assertion", `PaywallCard non visibile su ${s.path} a 390px`, "media");
        } else {
          const ctaVisible = await page
            .getByRole("button", { name: "Passa a Pro" })
            .first()
            .isVisible()
            .catch(() => false);
          const unavailableTextVisible = await page
            .getByText("Abbonamento non disponibile al momento")
            .first()
            .isVisible()
            .catch(() => false);
          if (!ctaVisible && !unavailableTextVisible) {
            note(`${s.name}-mobile`, "ux", `Su mobile il CTA 'Passa a Pro' di ${s.path} non è visibile senza scroll`, "media");
          }
        }
        await shot(page, `11-${s.name}-gate-mobile.png`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    // ── /pro → CTA → ProCheckoutDialog → sessione Stripe creata, NO pagamento ──
    await page.goto(`${BASE}/pro`, { waitUntil: "domcontentloaded" });
    await acceptCookies(page);
    await settle(page); // e.g. ChecklistSetupModal auto-opens when the checklist is empty (query settles after navigation)
    const heroShown = await page
      .getByText("Porta il tuo trading")
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (!heroShown) note("pro-page", "assertion", "/pro non mostra l'hero 'Porta il tuo trading'", "alta");
    await page.waitForTimeout(800);
    await shot(page, "20-pro-page-desktop.png");

    if (isPro) {
      const alreadyPro = await page
        .getByText("Sei già Pro", { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      console.log(`  utente Pro: badge 'già Pro' visibile=${alreadyPro} — checkout non esercitato`);
    } else {
      const upgradeBtn = page.getByRole("button", { name: "Passa a Pro" }).first();
      const upgradeVisible = await upgradeBtn.isVisible().catch(() => false);
      const unavailableVisible = await page
        .getByText("Abbonamento non disponibile al momento")
        .first()
        .isVisible()
        .catch(() => false);
      if (!upgradeVisible && !unavailableVisible) {
        note("pro-page", "assertion", "Né il CTA 'Passa a Pro' né il messaggio di indisponibilità sono visibili sull'hero di /pro per utente free", "alta");
      } else if (!upgradeVisible) {
        note("pro-page", "assertion", "checkoutAvailable=false lato server: /pro mostra il messaggio onesto invece del CTA (verificare se atteso in questo ambiente)", "info");
      } else {
        const respPromise = page
          .waitForResponse((r) => r.url().includes("/api/billing/checkout-session"), { timeout: 20000 })
          .catch(() => null);
        await upgradeBtn.click();

        const dialogTitle = await page
          .getByText("Passa a Pro — 7 EUR/mese")
          .first()
          .waitFor({ state: "visible", timeout: 8000 })
          .then(() => true)
          .catch(() => false);
        if (!dialogTitle) {
          note("checkout", "assertion", "ProCheckoutDialog non si apre (titolo 'Passa a Pro — 7 EUR/mese' assente)", "alta");
        }

        const resp = await respPromise;
        if (!resp) {
          note("checkout", "assertion", "Nessuna chiamata a /api/billing/checkout-session entro 20s dal click", "alta");
        } else {
          const status = resp.status();
          const body = await resp.json().catch(() => null);
          if (status === 200 && body?.clientSecret) {
            console.log("  checkout-session creata (clientSecret presente) — NON completo il pagamento");
          } else if (status === 503) {
            note("checkout", "assertion", "checkout-session → 503: Stripe non configurato sul server locale", "alta");
          } else {
            note("checkout", "assertion", `checkout-session → ${status} senza clientSecret`, "alta");
          }
        }

        // Embedded Stripe checkout iframe should mount; we stop at rendering it.
        const iframeUp = await page
          .waitForSelector('iframe[src*="stripe"], iframe[name*="embedded-checkout"]', { timeout: 25000 })
          .then(() => true)
          .catch(() => false);
        if (!iframeUp) {
          const errorShown = await page
            .getByText(/Checkout non disponibile|Stripe non è ancora configurato/)
            .first()
            .isVisible()
            .catch(() => false);
          note(
            "checkout",
            "assertion",
            errorShown
              ? "Il dialog mostra l'errore di checkout invece del form Stripe"
              : "L'iframe Stripe embedded checkout non è comparso entro 25s (né errore mostrato)",
            "alta",
          );
        } else {
          await page.waitForTimeout(3500); // let the Stripe form paint for the screenshot
        }
        await shot(page, "21-pro-checkout-dialog.png");

        // Close WITHOUT paying.
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(500);
        const dialogGone = !(await page
          .getByText("Passa a Pro — 7 EUR/mese")
          .first()
          .isVisible()
          .catch(() => false));
        if (!dialogGone) {
          note("checkout", "ux", "Il dialog di checkout non si chiude con Escape", "bassa");
          await page.getByRole("button", { name: /close|chiudi/i }).first().click().catch(() => {});
        }

        // Sanity: still free after the aborted checkout.
        const billingAfter = await apiFromPage(page, "/api/billing/me");
        if (billingAfter.body?.pro === true) {
          note("checkout", "assertion", "Utente diventato Pro senza completare il pagamento (!)", "alta");
        } else {
          console.log("  utente ancora free dopo il checkout abbandonato — ok");
        }
      }
    }

    if (gated402.size > 0) {
      note(
        "server-gate",
        "failed-request",
        `Endpoint 402 osservati durante la navigazione (gate server-side attivo, atteso per utente free): ${[...gated402].join(", ")}`,
        "info",
      );
    }

    await settle(page, 2);
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
