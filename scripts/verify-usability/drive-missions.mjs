// Usability driver — area "missions": /missions (Missioni Giornaliere) + /milestones
// (Traguardi) with USER_A (Pro, onboarding complete).
//
// Missions are per-calendar-day and self-report (POST /missions/:id/complete has no
// external validation, just flips completed=false→true once per mission per day —
// see artifacts/api-server/src/routes/missions.ts). That means: the FIRST run of this
// driver on a given day can complete a real pending mission and observe the toast/
// level-up reaction; subsequent re-runs the same day will find all missions already
// completed (no reset endpoint exists on purpose, to prevent XP farming) — the driver
// degrades gracefully and documents that as severity "info" rather than failing.
//
// Run from the repo root: node scripts/verify-usability/drive-missions.mjs
import { chromium } from "playwright";
import {
  USER_A,
  BASE,
  signIn,
  completeOnboarding,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "missions";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
};

async function sawText(page, text, timeout = 6000) {
  return page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

// The GDPR cookie banner ("OK" when GA is unset) isn't in common.mjs's dismiss()
// regex list, so it stays glued to the bottom of the viewport across every
// route. Close it explicitly once so it doesn't keep covering page content.
async function closeCookieBanner(page) {
  const banner = page.locator("div.fixed").filter({ hasText: /cookie tecnici/i }).first();
  if (!(await banner.isVisible().catch(() => false))) return false;
  const btn = banner.getByRole("button", { name: /^(OK|Accetta)$/ }).first();
  await btn.click().catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

// Flags raw i18n keys / NaN / undefined leaking into rendered copy.
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
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  const collectors = attachErrorCollectors(page, { allowStatus: [401] });

  try {
    await signIn(page, USER_A);
    await completeOnboarding(page);

    // ── /missions ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/missions`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanBodyText(page, "missions-load");
    await shot(page, "01-missions.png");
    await closeCookieBanner(page);

    const profileBefore = await apiFromPage(page, "/api/profile");
    const levelBefore = profileBefore?.body?.level ?? null;
    const xpBefore = profileBefore?.body?.xp ?? null;
    console.log(`  [profile] before: level=${levelBefore} xp=${xpBefore} (status ${profileBefore.status})`);

    const missionsResp = await apiFromPage(page, "/api/missions");
    const missions = Array.isArray(missionsResp.body) ? missionsResp.body : [];
    const pending = missions.filter((m) => !m.completed);
    console.log(`  [missions] total=${missions.length} pending=${pending.length}`);

    if (missions.length === 0) {
      note("missions-list", "assertion", "GET /api/missions restituisce un array vuoto (nessuna missione generata per oggi)", "alta");
    }

    if (pending.length === 0 && missions.length > 0) {
      note(
        "missions-complete",
        "assertion",
        `Tutte le ${missions.length} missioni di oggi risultano già completate (probabile run precedente nella stessa giornata): non è possibile testare dal vivo il completamento/level-up finché non cambia la data o il DB viene resettato manualmente — le missioni sono self-report senza endpoint di reset per disegno anti-farming`,
        "info",
      );
      // Still sanity-check the all-completed empty/finished visual state.
      const anyCompleteRow = await page.getByRole("button", { name: "Completa" }).count();
      if (anyCompleteRow > 0) {
        note("missions-complete", "assertion", "Sono presenti bottoni 'Completa' visibili ma nessuna missione risulta pending nell'API — incoerenza UI/stato", "alta");
      }
    } else if (pending.length > 0) {
      // Complete the first pending mission via the real UI.
      const firstPending = pending[0];
      const row = page
        .locator("div", { has: page.getByText(firstPending.title, { exact: true }) })
        .filter({ has: page.getByRole("button", { name: "Completa" }) })
        .first();
      const completeBtn = row.getByRole("button", { name: "Completa" }).first();
      const btnVisible = await completeBtn.isVisible().catch(() => false);
      if (!btnVisible) {
        note("missions-complete", "assertion", `Bottone 'Completa' non trovato/visibile per la missione pending "${firstPending.title}"`, "alta");
      } else {
        await completeBtn.click();
        const toastOk = await sawText(page, "Missione completata");
        if (!toastOk) {
          note("missions-complete", "ux", "Nessun toast 'Missione completata' dopo aver premuto Completa", "media");
        }
        await shot(page, "02-mission-completed-toast.png");

        // Was this the mission that crossed a level? Watch briefly for the
        // in-page level-up toast (Missions.tsx) and/or the global
        // LevelRewardModal (App.tsx, milestone thresholds 5/10/15/20/25/30).
        const levelUpToast = await sawText(page, "Level up!", 2500);
        const rewardModal = await page
          .getByRole("dialog")
          .filter({ hasText: /Trofeo|Traguardo|Livello/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (levelUpToast || rewardModal) {
          console.log(`  [level-up] toast=${levelUpToast} rewardModal=${rewardModal}`);
          await shot(page, "03-level-up.png");
          note(
            "missions-complete",
            "assertion",
            `Level-up osservato dopo il completamento (toast=${levelUpToast}, LevelRewardModal=${rewardModal})`,
            "info",
          );
        } else {
          console.log("  [level-up] non osservato (atteso: serve superare una soglia XP, singola missione spesso non basta)");
        }

        // Row should now show completed (checkmark, strikethrough, no more Completa).
        await page.waitForTimeout(600);
        const stillPending = await page.getByRole("button", { name: "Completa" }).count();
        console.log(`  [missions] bottoni 'Completa' residui dopo il completamento: ${stillPending}`);

        const profileAfter = await apiFromPage(page, "/api/profile");
        console.log(`  [profile] after: level=${profileAfter?.body?.level} xp=${profileAfter?.body?.xp} (status ${profileAfter.status})`);
        if (xpBefore != null && profileAfter?.body?.xp != null && !(profileAfter.body.xp > xpBefore)) {
          note("missions-complete", "assertion", `XP non aumentato dopo il completamento (before=${xpBefore}, after=${profileAfter.body.xp})`, "alta");
        }
      }
    }

    await scanBodyText(page, "missions-after");
    await shot(page, "04-missions-final.png");

    // ── /milestones ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/milestones`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await scanBodyText(page, "milestones-load");
    await shot(page, "05-milestones-ladder.png");

    // Check whether the (not-yet-dismissed) cookie banner overlaps the ladder
    // before closing it — same class of issue already found on onboarding's
    // pair-selection CTA.
    const bannerBeforeClose = page.locator("div.fixed").filter({ hasText: /cookie tecnici/i }).first();
    if (await bannerBeforeClose.isVisible().catch(() => false)) {
      const laddderRow = page.getByText("Apprendista Disciplinato").first();
      const rowBox = await laddderRow.boundingBox().catch(() => null);
      const bannerBox = await bannerBeforeClose.boundingBox().catch(() => null);
      if (rowBox && bannerBox) {
        const overlap = !(bannerBox.y > rowBox.y + rowBox.height || bannerBox.y + bannerBox.height < rowBox.y);
        if (overlap) {
          note(
            "milestones-ladder",
            "ux",
            "Il banner cookie (persistente finché non viene chiuso) copre parte della lista 'Tutti i livelli' in fondo alla pagina Traguardi",
            "bassa",
          );
        }
      }
    }
    await closeCookieBanner(page);

    const adminStatus = await apiFromPage(page, "/api/milestones/admin/status");
    const isAdmin = Boolean(adminStatus?.body?.isAdmin);
    const certs = await apiFromPage(page, "/api/milestones/certificates/me");
    const certCount = Array.isArray(certs?.body) ? certs.body.length : 0;
    console.log(`  [milestones] isAdmin=${isAdmin} certificates=${certCount}`);

    if (certCount === 0) {
      const honestEmptyMsg = await page.getByText("Nessun certificato ancora").isVisible().catch(() => false);
      if (isAdmin) {
        // Missions.helpers/Milestones.tsx gates the honest empty-state message
        // with `!isAdmin`: an admin with 0 certificates gets NEITHER the
        // gallery NOR the "Nessun certificato ancora" explanation — the whole
        // certificates section silently disappears.
        if (honestEmptyMsg) {
          console.log("  [milestones] messaggio 'nessun certificato' visibile anche per admin (meglio del previsto)");
        } else {
          note(
            "milestones-certificates",
            "ux",
            "Utente admin senza certificati: la sezione 'I tuoi Certificati NFT' scompare del tutto in modo muto (né galleria né messaggio 'Nessun certificato ancora', gated da `!isAdmin` in Milestones.tsx) — un admin non capisce se i certificati esistono come funzionalità",
            "media",
          );
        }
      } else if (!honestEmptyMsg) {
        note(
          "milestones-certificates",
          "assertion",
          "Utente non-admin senza certificati: manca il messaggio onesto 'Nessun certificato ancora' (la sezione scompare muta)",
          "alta",
        );
      } else {
        console.log("  [milestones] messaggio onesto 'Nessun certificato ancora' presente ✓");
      }
    } else {
      const galleryVisible = await page.getByText("I tuoi Certificati NFT").isVisible().catch(() => false);
      if (!galleryVisible) {
        note("milestones-certificates", "assertion", `L'utente ha ${certCount} certificati ma la galleria 'I tuoi Certificati NFT' non è visibile`, "media");
      }
      await shot(page, "06-milestones-certificates.png");
    }

    // Expand the current-level row to see its detail panel (content or the
    // honest "unlock this level" / "no content yet" messages).
    const currentLevel = profileBefore?.body?.level ?? 1;
    const currentBadge = page.getByText("ATTUALE", { exact: true }).first();
    if (await currentBadge.isVisible().catch(() => false)) {
      const currentRow = currentBadge.locator("xpath=ancestor::button[1]");
      await currentRow.click().catch(() => {});
      await page.waitForTimeout(600);
      await shot(page, "07-milestones-current-level-expanded.png");
      const noContentMsg = await page.getByText("Nessun contenuto ancora per questo livello.").isVisible().catch(() => false);
      console.log(`  [milestones] livello corrente (${currentLevel}) espanso, 'nessun contenuto' visibile=${noContentMsg}`);
    } else {
      note("milestones-ladder", "assertion", "Badge 'ATTUALE' non trovato sulla ladder dei livelli", "media");
    }

    await scanBodyText(page, "milestones-final");
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
