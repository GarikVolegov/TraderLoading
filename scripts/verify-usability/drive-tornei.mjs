// Usability sweep — area "tornei": Arena + Percorso on /tornei with USER_A (Pro,
// onboarded, but NOT enrolled and with no synced real broker account — the real
// state of this local env). Exercises: Arena standings/enroll-gate, Percorso +
// Hall of Fame, the certificate CertModal (mintStatus="claimable", TORNEI_MINT_*
// unset locally so mintEnabled must be false), and the Wallet settings card in
// Settings → Abbonamento.
//
// The local DB has ZERO tournament_certificates rows for anyone, so a real
// certificate is seeded directly via Postgres (mirrors scripts/verify-backtest/
// setup-user.mjs's use of `pg`) to drive the CertModal live, then deleted mid-run
// so the true "no certificates yet" empty state can also be observed for real —
// both states get documented. Wallet address is restored to its original value
// (null) at the end.
//
// Run from the repo root: node scripts/verify-usability/drive-tornei.mjs
import pg from "pg";
import { chromium } from "playwright";
import {
  USER_A,
  BASE,
  signIn,
  completeOnboarding,
  clerkUserId,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "tornei";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);
const DB_URL =
  process.env.VERIFY_DATABASE_URL || "postgres://trader:trader@127.0.0.1:55432/traderloadings";
const TEST_WALLET = "0x1111111111111111111111111111111111111111";

const findings = [];
const note = (step, kind, detail, severity = "media") => {
  findings.push({ step, kind, detail, severity });
  console.log(`  ▶ [${severity}] (${step}) ${detail}`);
};

/** Wait for a toast/text to appear; returns true if seen. */
async function sawText(page, text, timeout = 6000) {
  return page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

/** Switch to the Percorso tab, robust to a just-reloaded page (the segmented
 * control button only exists once hydration finishes; a bare settle() after a
 * full page.goto() reload isn't always enough). */
async function goToPercorso(page) {
  await page
    .getByText("Arena dei Trader")
    .first()
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});
  const tab = page.getByRole("button", { name: "Percorso" }).first();
  await tab.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await tab.click();
  await page.getByText("Il tuo percorso").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
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
    note(step, "ux", "Chiave i18n grezza (auto.ui.*) visibile nella pagina", "alta");
  }
  return text;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL });
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

  let userId;
  let seededCertId = null;
  let seededCertDeleted = false;

  try {
    userId = await clerkUserId(USER_A);

    // ── Seed: one real "claimable" certificate for USER_A on the live season ──
    const { rows: seasonRows } = await pool.query(
      "select id, label from tournament_seasons where status = 'live' order by starts_at desc limit 1",
    );
    const liveSeason = seasonRows[0] ?? null;
    console.log(`  [seed] live season: ${liveSeason ? `#${liveSeason.id} ${liveSeason.label}` : "(none)"}`);
    if (liveSeason) {
      const { rows: existing } = await pool.query(
        "select id from tournament_certificates where season_id = $1 and user_id = $2 and tier = 'finisher'",
        [liveSeason.id, userId],
      );
      if (existing.length > 0) {
        seededCertId = existing[0].id;
        console.log(`  [seed] reusing pre-existing certificate #${seededCertId}`);
      } else {
        const { rows: inserted } = await pool.query(
          `insert into tournament_certificates
             (season_id, season_label, user_id, user_name, tier, edition, rarity, mint_status)
           values ($1, $2, $3, $4, 'finisher', 'Open Edition', 'Raro', 'claimable')
           returning id`,
          [liveSeason.id, liveSeason.label, userId, "Verify A"],
        );
        seededCertId = inserted[0].id;
        console.log(`  [seed] inserted certificate #${seededCertId}`);
      }
    } else {
      note("seed", "assertion", "Nessuna stagione 'live' in DB: impossibile seminare un certificato di test", "info");
    }

    await signIn(page, USER_A);
    await completeOnboarding(page);

    // ── STEP 1: Arena — stato iniziale ────────────────────────────────────────
    await page.goto(`${BASE}/tornei`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const titleVisible = await page.getByText("Arena dei Trader").first().isVisible().catch(() => false);
    if (!titleVisible) {
      note("arena-load", "assertion", "Titolo 'Arena dei Trader' non visibile su /tornei", "alta");
    }
    await scanBodyText(page, "arena-initial");
    await shot(page, "01-arena-initial.png");

    const currentBefore = await apiFromPage(page, "/api/tornei/current");
    console.log(`  [current] status=${currentBefore.status} body=${JSON.stringify(currentBefore.body)}`);
    if (currentBefore.status !== 200) {
      note("arena-load", "assertion", `GET /api/tornei/current returned ${currentBefore.status}`, "alta");
    }
    const enrolledBefore = Boolean(currentBefore.body?.enrolled);
    if (enrolledBefore) {
      note(
        "arena-load",
        "assertion",
        "USER_A risulta già iscritto alla stagione live: il flusso di iscrizione (gate conto reale) non è riesercitabile in questo run",
        "info",
      );
    }

    // ── STEP 1b: prova iscrizione — atteso rifiuto (nessun conto reale sync) ──
    if (!enrolledBefore) {
      const enrollBtn = page.getByRole("button", { name: /Iscriviti al torneo|Prenota il tuo posto/ }).first();
      const enrollVisible = await enrollBtn.isVisible().catch(() => false);
      if (!enrollVisible) {
        note("enroll-attempt", "assertion", "Nessun bottone di iscrizione visibile nella SeasonBanner/upcoming panel", "media");
      } else {
        // No consent checkbox/dialog is shown before the request fires — the FE
        // hardcodes enrollTornei(true). The i18n key "tornei.consent" ("Accetto
        // le regole della gara e la classifica pubblica pseudonima.") exists in
        // all 5 dictionaries but is never rendered anywhere in the component tree.
        await enrollBtn.click();
        const rejectedToast = await sawText(page, "Serve un conto reale sincronizzato per partecipare.", 6000);
        const genericToast = !rejectedToast && (await sawText(page, "Iscrizione non riuscita", 2000));
        const successToast = !rejectedToast && !genericToast && (await sawText(page, "Iscrizione confermata.", 2000));
        await shot(page, "02-enroll-attempt-result.png");
        if (rejectedToast) {
          note(
            "enroll-attempt",
            "assertion",
            "Come atteso: iscrizione rifiutata con 402 no_real_account, toast onesto 'Serve un conto reale sincronizzato per partecipare.' — nessun gate UI esplicito però chiede il consenso prima di inviare la richiesta (tornei.consent è definito in i18n ma mai renderizzato in nessun componente: il click invia consent:true senza alcuna interazione di conferma)",
            "info",
          );
          note(
            "enroll-consent",
            "ux",
            "La stringa i18n 'tornei.consent' (\"Accetto le regole della gara e la classifica pubblica pseudonima.\") esiste in tutti e 5 i dizionari ma non è referenziata da nessun componente: il click su 'Iscriviti al torneo' invia enrollTornei(true) immediatamente, senza mai mostrare all'utente che il proprio nome comparirà in una classifica pubblica pseudonima",
            "media",
          );
        } else if (successToast) {
          note(
            "enroll-attempt",
            "assertion",
            "Iscrizione riuscita inaspettatamente: USER_A non dovrebbe avere un conto reale sincronizzato in questo ambiente",
            "info",
          );
        } else {
          note(
            "enroll-attempt",
            "assertion",
            `Nessun toast riconosciuto dopo il click su iscriviti (rejectedToast=${rejectedToast}, genericToast=${genericToast})`,
            "media",
          );
        }
      }
    }

    // ── STEP 2: Arena — classifica/standings ──────────────────────────────────
    await settle(page, 3);
    const boardEmpty = await sawText(page, "Ancora nessun trader in classifica.", 4000);
    console.log(`  [standings] board empty state visible=${boardEmpty}`);
    await scanBodyText(page, "arena-standings");
    await shot(page, "03-arena-standings.png");
    if (!boardEmpty) {
      const rankHeader = await page.getByText("Rango", { exact: true }).first().isVisible().catch(() => false);
      if (!rankHeader) note("arena-standings", "assertion", "Classifica: né righe né empty-state riconosciuti", "media");
    }

    // Prizes + Rules sections should render under Arena regardless of enrollment.
    const prizesVisible = await page.getByText("Cosa si vince").first().isVisible().catch(() => false);
    const rulesVisible = await page.getByText("Regole della gara disciplinata").first().isVisible().catch(() => false);
    if (!prizesVisible) note("arena-standings", "assertion", "Sezione premi ('Cosa si vince') non visibile in Arena", "bassa");
    if (!rulesVisible) note("arena-standings", "assertion", "Sezione regole non visibile in Arena", "bassa");

    // ── STEP 3: Percorso — Albo d'oro ──────────────────────────────────────────
    await goToPercorso(page);
    await settle(page, 3);
    const percorsoTitle = await page.getByText("Il tuo percorso").first().isVisible().catch(() => false);
    if (!percorsoTitle) note("percorso-load", "assertion", "Titolo 'Il tuo percorso' non visibile dopo lo switch tab", "alta");
    const notEnrolledCopy = await sawText(page, "Non sei ancora iscritto a questa stagione.", 4000);
    console.log(`  [percorso] not-enrolled copy visible=${notEnrolledCopy} (enrolledBefore=${enrolledBefore})`);
    if (!enrolledBefore && !notEnrolledCopy) {
      note("percorso-load", "assertion", "Utente non iscritto ma la card 'Il tuo percorso' non mostra il copy 'Non sei ancora iscritto'", "media");
    }
    await scanBodyText(page, "percorso-load");
    await shot(page, "04-percorso.png");

    const hallResp = await apiFromPage(page, "/api/tornei/hall");
    const hallEntries = hallResp.body?.entries ?? [];
    console.log(`  [hall] entries=${JSON.stringify(hallEntries)}`);
    const hallTitleVisible = await page.getByText("Albo d'oro").first().isVisible().catch(() => false);
    if (!hallTitleVisible) note("hall", "assertion", "Titolo 'Albo d'oro' non visibile", "media");
    if (hallEntries.length === 0) {
      const hallEmpty = await sawText(page, "Nessuna stagione conclusa.", 3000);
      if (!hallEmpty) note("hall", "assertion", "Nessuna entry e nessun empty-state 'Nessuna stagione conclusa.' nell'Albo d'oro", "media");
    } else {
      const blankChampion = hallEntries.some((e) => !e.champion);
      if (blankChampion) {
        note(
          "hall",
          "ux",
          `L'Albo d'oro mostra ${hallEntries.length} stagione/i conclusa/e senza alcun campione (nessuno standing/premio registrato) — la riga appare con nome '—' e Disciplina '—%', un empty-state non curato invece di essere omessa o etichettata come 'nessun partecipante'`,
          "bassa",
        );
      }
    }
    await shot(page, "05-hall-of-fame.png");

    // ── STEP 4/5/6: certificato — CertModal, mintEnabled=false → no claim CTA ─
    const walletResp = await apiFromPage(page, "/api/tornei/wallet");
    console.log(`  [wallet] GET status=${walletResp.status} body=${JSON.stringify(walletResp.body)}`);
    if (walletResp.body?.mintEnabled === undefined) {
      // The field is entirely absent from the response (not just false) — this
      // is the fingerprint of a dev API server process that predates the
      // mintEnabled fix in routes/tornei.ts (the local server is no-watch, see
      // README/memory "Local runtime validation": restart to load route changes).
      // The FE defaults a missing field to false (`?? false` in Tornei.tsx), so
      // the CertModal still LOOKS correct below — but that's incidental, not a
      // real end-to-end verification of the fix. Flagging so a human restarts
      // the API server and re-runs this driver for a true confirmation.
      note(
        "cert-mint-config",
        "assertion",
        "GET /api/tornei/wallet non include affatto il campo mintEnabled (solo walletAddress) — sintomo di un processo API server (no-watch, tsx senza reload) avviato PRIMA della fix che aggiunge mintEnabled a questa rotta. La CertModal qui sotto risulta 'onesta' solo perché il FE fa mintEnabled ?? false quando il campo manca: non è una verifica end-to-end reale del fix finché il server non viene riavviato",
        "alta",
      );
    } else if (walletResp.body?.mintEnabled !== false) {
      note(
        "cert-mint-config",
        "assertion",
        `Attesa mintEnabled=false in locale (TORNEI_MINT_* non configurato) ma l'API ha risposto mintEnabled=${walletResp.body?.mintEnabled}`,
        "alta",
      );
    } else {
      note("cert-mint-config", "assertion", "GET /api/tornei/wallet risponde mintEnabled=false come atteso in locale", "info");
    }

    if (seededCertId) {
      const certButtons = page.locator("button.trn-nft");
      const certCount = await certButtons.count();
      console.log(`  [percorso] certificate cards found: ${certCount}`);
      if (certCount === 0) {
        note("cert-open", "assertion", "Certificato seminato in DB ma nessuna card '.trn-nft' visibile in Percorso dopo il reload", "alta");
      } else {
        await certButtons.first().click();
        const dialog = page.getByRole("dialog");
        const dialogOpen = await dialog.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
        if (!dialogOpen) {
          note("cert-open", "assertion", "CertModal non si apre cliccando la card certificato", "alta");
        } else {
          await shot(page, "06-cert-modal-open.png");
          const claimableLabel = await dialog.getByText("Reclamabile").first().isVisible().catch(() => false);
          if (!claimableLabel) note("cert-modal", "assertion", "Badge stato 'Reclamabile' non visibile nel CertModal per un certificato claimable", "media");

          const mintSoonLabel = await dialog
            .getByText("Certificato registrato — il conio on-chain arriva presto.")
            .first()
            .isVisible()
            .catch(() => false);
          const claimBtn = dialog.getByRole("button", { name: "Reclama / Conia" });
          const claimBtnVisible = (await claimBtn.count()) > 0 && (await claimBtn.first().isVisible().catch(() => false));

          console.log(`  [cert-modal] mintSoonLabel=${mintSoonLabel} claimBtnVisible=${claimBtnVisible}`);
          if (claimBtnVisible) {
            note(
              "cert-modal-mint",
              "assertion",
              "TORNEI_MINT_* non configurato (mintEnabled=false) ma il CertModal mostra comunque un bottone 'Reclama / Conia' cliccabile — l'utente premerebbe un CTA che fallisce (o 503) invece di vedere l'etichetta onesta 'mint on-chain in arrivo'",
              "alta",
            );
            // Prove it out: click and confirm what actually happens.
            await claimBtn.first().click();
            await page.waitForTimeout(1500);
            await shot(page, "06b-cert-claim-clicked.png");
          } else if (!mintSoonLabel) {
            note(
              "cert-modal-mint",
              "assertion",
              "mintEnabled=false ma il CertModal non mostra né il bottone claim né il testo onesto 'mint on-chain in arrivo' — stato indeterminato per l'utente",
              "alta",
            );
          } else {
            note(
              "cert-modal-mint",
              "assertion",
              "Verificato dal vivo: il CertModal mostra l'etichetta onesta 'Certificato registrato — il conio on-chain arriva presto.' e NESSUN bottone claim cliccabile — comportamento atteso post-fix (ma vedi il finding 'cert-mint-config': qui il server risponde senza il campo mintEnabled, quindi questo è corretto solo grazie al default lato client, non una riprova diretta della rotta aggiornata)",
              "info",
            );
          }

          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }
      }
    }

    // ── STEP 5: Wallet settings (Impostazioni → Abbonamento) ──────────────────
    await page.goto(`${BASE}/settings?section=abbonamento`, { waitUntil: "domcontentloaded" });
    await settle(page, 3);
    // Extra settle: BillingSubscriptionPanel/CreatorPayoutSettings above WalletSettings
    // in the DOM fetch + animate in first; without this margin the heading check
    // below can race ahead of the section actually mounting.
    await page.waitForTimeout(1500);
    const walletHeading = await page.getByText("Wallet certificati NFT").first().isVisible().catch(() => false);
    if (!walletHeading) {
      note("wallet-settings", "assertion", "Sezione 'Wallet certificati NFT' non visibile in Impostazioni → Abbonamento", "alta");
    } else {
      await shot(page, "07-wallet-settings.png");
      const input = page.getByPlaceholder("0x…").first();
      await input.fill(TEST_WALLET);
      await page.getByRole("button", { name: "Salva wallet" }).first().click();
      const savedToast = await sawText(page, "Wallet salvato.", 5000);
      await shot(page, "08-wallet-saved.png");
      if (!savedToast) {
        note("wallet-settings", "assertion", "Nessun toast 'Wallet salvato.' dopo il salvataggio dell'indirizzo", "media");
      } else {
        console.log("  [wallet] saved ✓");
      }
      const walletAfter = await apiFromPage(page, "/api/tornei/wallet");
      if (walletAfter.body?.walletAddress?.toLowerCase() !== TEST_WALLET.toLowerCase()) {
        note(
          "wallet-settings",
          "assertion",
          `Indirizzo salvato non persistito: GET /api/tornei/wallet ha restituito ${JSON.stringify(walletAfter.body)} dopo il salvataggio`,
          "alta",
        );
      }

      // Re-check the CertModal now that hasWallet=true: mintEnabled is still
      // false, so the honest "mint soon" copy must still win over the wallet
      // being present (mintEnabled gates before hasWallet in CertModal).
      if (seededCertId) {
        await page.goto(`${BASE}/tornei`, { waitUntil: "domcontentloaded" });
        await settle(page, 2);
        await goToPercorso(page);
        await settle(page, 2);
        const certBtn = page.locator("button.trn-nft").first();
        if ((await certBtn.count()) > 0) {
          await certBtn.click();
          const dialog2 = page.getByRole("dialog");
          const open2 = await dialog2.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
          if (open2) {
            const claimBtn2Visible = await dialog2
              .getByRole("button", { name: "Reclama / Conia" })
              .first()
              .isVisible()
              .catch(() => false);
            await shot(page, "09-cert-modal-with-wallet.png");
            if (claimBtn2Visible) {
              note(
                "cert-modal-mint-with-wallet",
                "assertion",
                "Con un wallet salvato ma mintEnabled=false, il CertModal mostra comunque il bottone claim — dovrebbe restare l'etichetta 'mint in arrivo'",
                "alta",
              );
            } else {
              note(
                "cert-modal-mint-with-wallet",
                "assertion",
                "Confermato: avere un wallet salvato non fa comparire il claim CTA quando il mint resta non configurato — coerente",
                "info",
              );
            }
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
          }
        }
      }
    }

    // ── STEP 7: elimina il certificato seminato e osserva l'empty state reale ─
    if (seededCertId) {
      await pool.query("delete from tournament_certificates where id = $1", [seededCertId]);
      seededCertDeleted = true;
      await page.goto(`${BASE}/tornei`, { waitUntil: "domcontentloaded" });
      await settle(page, 3);
      await goToPercorso(page);
      await settle(page, 3);
      const certsHeadingGone = await page.getByText("I tuoi certificati").first().isVisible().catch(() => false);
      const certButtonsAfter = await page.locator("button.trn-nft").count();
      console.log(`  [percorso] after delete: headingVisible=${certsHeadingGone} certButtons=${certButtonsAfter}`);
      await shot(page, "10-percorso-no-certificates.png");
      if (!certsHeadingGone && certButtonsAfter === 0) {
        note(
          "percorso-no-certs",
          "ux",
          "Quando l'utente non ha certificati, la sezione 'I tuoi certificati' non compare affatto (nessuna heading, nessun placeholder/empty-state) — per un utente che non ha mai partecipato a un torneo la Percorso view non spiega che i certificati arriveranno a fine stagione se qualificato, il pannello semplicemente non c'è",
          "info",
        );
      } else if (certsHeadingGone || certButtonsAfter > 0) {
        note(
          "percorso-no-certs",
          "assertion",
          `Il certificato è stato cancellato dal DB ma la UI mostra ancora heading=${certsHeadingGone} o ${certButtonsAfter} card — cache non invalidata?`,
          "media",
        );
      }
    }

    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.stack ?? err?.message ?? err);
    note("driver", "assertion", `Crash del driver: ${err?.message ?? err}`, "alta");
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    // ── Cleanup: restore wallet to null, remove any leftover seeded rows ─────
    try {
      await apiFromPage(page, "/api/tornei/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: "" }),
      });
      console.log("  [cleanup] wallet reset to null");
    } catch (e) {
      console.log(`  [cleanup] wallet reset failed: ${e?.message}`);
    }
    if (seededCertId && !seededCertDeleted) {
      await pool.query("delete from tournament_certificates where id = $1", [seededCertId]).catch(() => {});
      console.log("  [cleanup] seeded certificate removed");
    }
    if (userId) {
      // Safety net: never leave a real enrollment behind from an unexpected
      // success (see the "enroll-attempt" assertion above).
      await pool
        .query(
          "delete from tournament_enrollments where user_id = $1 and season_id in (select id from tournament_seasons where status = 'live')",
          [userId],
        )
        .catch(() => {});
    }
    await pool.end().catch(() => {});
    reportFindings(AREA, findings, collectors);
    await browser.close();
  }
}

main();
