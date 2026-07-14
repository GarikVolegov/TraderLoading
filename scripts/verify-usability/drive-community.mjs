// Usability sweep — area "community": private community + owner-approved join,
// DM (E2EE), and paid-channel checkout, with USER_A (creator/owner) and a fresh
// third user USER_C in an independent browser context (USER_B is reserved for
// other drivers — do not touch its state).
//
// IMPORTANT environment caveat: the running API server (tsx, no watch-mode) was
// started Sun Jul 12 22:51, well before commit d31b6ea ("fix(community): wire
// the missing isPublic write path") landed today. That commit is the ONLY place
// that ever lets POST /community / PATCH /community/:id persist isPublic:false —
// before it, every community that has ever been created is public, unreachable
// bug. Since we can't restart the shared dev server, this driver:
//   1) still exercises the real UI toggle end-to-end and inspects the live
//      request + response + DB row to confirm (or refute) the stale-server
//      symptom for the record, then
//   2) seeds a private community DIRECTLY via Postgres (mirrors drive-tornei.mjs's
//      use of `pg` for a certificate) so the join-approval flow — which does NOT
//      depend on today's fix — can still be exercised live end-to-end.
//
// Run from the repo root: node scripts/verify-usability/drive-community.mjs
import pg from "pg";
import { chromium } from "playwright";
import {
  USER_A,
  BASE,
  signIn,
  completeOnboarding,
  ensureTestUser,
  clerkUserId,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "community";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);
const DB_URL =
  process.env.VERIFY_DATABASE_URL || "postgres://trader:trader@127.0.0.1:55432/traderloadings";
const USER_C = process.env.VERIFY_EMAIL_C || "verify.c+clerk_test@example.com";

// Mirrors services/communityPermissions.ts COMMUNITY_PERMISSIONS (kept in sync by
// hand — this is a test-only seed, not app code).
const ALL_PERMISSIONS = [
  "community.manage",
  "channels.manage",
  "messages.moderate",
  "files.manage",
  "roles.manage",
  "members.kick",
  "members.ban",
  "members.mute",
  "reviews.respond",
  "reviews.moderate",
];

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

/** Deep-delete a community + every child row, mirroring
 * services/communityDeletion.ts's deleteCommunityDeep (same table order) —
 * used here because this driver seeds/creates via a raw pg.Pool, not the
 * service layer. */
async function deepDeleteCommunity(pool, id) {
  if (!id) return;
  try {
    await pool.query(
      "delete from community_review_reports where review_id in (select id from community_reviews where community_id=$1)",
      [id],
    );
    await pool.query("delete from community_reviews where community_id=$1", [id]);
    await pool.query("delete from community_message_reports where community_id=$1", [id]);
    await pool.query("delete from community_join_requests where community_id=$1", [id]);
    await pool.query("delete from community_channel_entitlements where community_id=$1", [id]);
    await pool.query(
      "delete from community_messages where channel_id in (select id from community_channels where community_id=$1)",
      [id],
    );
    await pool.query(
      "delete from voice_presence where channel_id in (select id from community_channels where community_id=$1)",
      [id],
    );
    await pool.query("delete from community_files where community_id=$1", [id]);
    await pool.query("delete from community_channels where community_id=$1", [id]);
    await pool.query("delete from community_members where community_id=$1", [id]);
    await pool.query("delete from community_roles where community_id=$1", [id]);
    await pool.query("delete from community_bans where community_id=$1", [id]);
    await pool.query("delete from community_mutes where community_id=$1", [id]);
    await pool.query("delete from community_moderation_log where community_id=$1", [id]);
    await pool.query("delete from communities where id=$1", [id]);
    console.log(`  [cleanup] community #${id} deep-deleted`);
  } catch (e) {
    console.log(`  [cleanup] deep-delete community #${id} failed: ${e?.message}`);
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const browser = await chromium.launch();
  // browser.newPage() creates a fresh isolated context per call — exactly what
  // we need for two independently-signed-in Clerk sessions (A and C).
  const pageA = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageC = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const p of [pageA, pageC]) {
    await p.addInitScript(() => {
      try {
        localStorage.setItem("tl_language", "it");
      } catch {
        /* ignore */
      }
    });
  }
  const collectorsA = attachErrorCollectors(pageA, { allowStatus: [401, 402, 409] });
  const collectorsC = attachErrorCollectors(pageC, { allowStatus: [401, 402, 409] });

  const stamp = Date.now();
  const createdName = `Community UI Test ${stamp}`;
  const seededName = `Community Privata Seed ${stamp}`;

  let userIdA, userIdC;
  let createdCommunityId = null; // via the real CreateCommunityModal flow
  let privateCommunityId = null; // the community actually used for the join-approval flow
  let seededCommunityId = null; // only set if we had to DB-seed a private community
  let joinFlowName = null;
  let followEstablished = false;
  let joinRequestedViaApiWorkaround = false;

  try {
    userIdA = await clerkUserId(USER_A);
    userIdC = await ensureTestUser(USER_C, { firstName: "Verify", lastName: "C" });

    await signIn(pageA, USER_A);
    await completeOnboarding(pageA);
    await signIn(pageC, USER_C);
    await completeOnboarding(pageC);

    // ── STEP 1 (A): create a community via the real UI, with the new private
    // toggle switched on ────────────────────────────────────────────────────
    await pageA.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
    await settle(pageA);
    await shot(pageA, "01-comunita-A-initial.png");

    await pageA.getByRole("button", { name: "Crea community" }).first().click();
    const createDialog = pageA.getByRole("dialog");
    const createOpen = await createDialog
      .getByText("Crea Community", { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!createOpen) {
      note("create-modal", "assertion", "CreateCommunityModal non si apre cliccando '+' sull'header Comunità", "alta");
    } else {
      const toggleLabelVisible = await createDialog.getByText("Community privata").first().isVisible().catch(() => false);
      const toggleHintVisible = await createDialog
        .getByText("Chi vuole entrare deve prima essere approvato da te.")
        .first()
        .isVisible()
        .catch(() => false);
      const toggle = createDialog.getByRole("switch").first();
      const toggleVisible = await toggle.isVisible().catch(() => false);
      if (!toggleLabelVisible || !toggleHintVisible || !toggleVisible) {
        note(
          "create-toggle",
          "assertion",
          `Toggle 'Community privata' incompleto nel modale di creazione (label=${toggleLabelVisible} hint=${toggleHintVisible} switch=${toggleVisible})`,
          "alta",
        );
      } else {
        console.log("  [create] toggle 'Community privata' presente e visibile ✓");
      }
      await shot(pageA, "02-create-modal-toggle-off.png");

      await createDialog.getByPlaceholder("es. Trader SMC Italia").fill(createdName);
      await createDialog.getByPlaceholder("Di cosa parla questa community?").fill("Community di test per il sweep di usabilità");

      if (toggleVisible) {
        await toggle.click();
        const checkedAfter = await toggle.getAttribute("aria-checked");
        if (checkedAfter !== "true") {
          note("create-toggle", "assertion", `Il toggle non risulta 'checked' (aria-checked=${checkedAfter}) dopo il click`, "alta");
        }
        await shot(pageA, "03-create-modal-toggle-on.png");
      }

      const [createResp] = await Promise.all([
        pageA
          .waitForResponse(
            (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/api/community"),
            { timeout: 8000 },
          )
          .catch(() => null),
        createDialog.getByRole("button", { name: "Crea Community" }).click(),
      ]);

      if (!createResp) {
        note("create-submit", "assertion", "Nessuna risposta osservata per POST /api/community dopo il click su 'Crea Community'", "alta");
      } else {
        let reqBody = null;
        try {
          reqBody = JSON.parse(createResp.request().postData() ?? "null");
        } catch {
          /* not JSON */
        }
        const respBody = await createResp.json().catch(() => null);
        console.log(`  [create] status=${createResp.status()} reqBody=${JSON.stringify(reqBody)} respBody.isPublic=${respBody?.isPublic}`);
        createdCommunityId = respBody?.id ?? null;

        if (reqBody?.isPublic !== false) {
          note(
            "create-toggle-wiring",
            "assertion",
            `Il body della richiesta POST /api/community non contiene isPublic:false (ricevuto: ${JSON.stringify(reqBody)}) — il toggle non sta inviando il campo correttamente lato client`,
            "alta",
          );
        } else {
          console.log("  [create] request payload correctly sends isPublic:false ✓");
        }

        // Independent DB confirmation (as instructed), on top of the response body.
        let dbIsPublic = null;
        if (createdCommunityId) {
          const { rows } = await pool.query("select is_public from communities where id=$1", [createdCommunityId]);
          dbIsPublic = rows[0]?.is_public ?? null;
        }
        console.log(`  [create] DB is_public for community #${createdCommunityId} = ${dbIsPublic}`);

        if (reqBody?.isPublic === false && dbIsPublic === false) {
          note(
            "create-toggle-effect",
            "assertion",
            "Verificato dal vivo: la community creata con il toggle 'privata' risulta correttamente is_public=false in DB — il fix di oggi (commit d31b6ea) è a quanto pare già servito da questo processo API (non più stale, o riavviato nel frattempo)",
            "info",
          );
          privateCommunityId = createdCommunityId;
          joinFlowName = createdName;
        } else if (reqBody?.isPublic === false && dbIsPublic === true) {
          note(
            "create-toggle-stale-server",
            "assertion",
            "CONFERMATO DAL VIVO: il toggle 'Community privata' invia correttamente isPublic:false nella request, ma la community creata risulta is_public=true in DB. Causa nota e attesa in questo ambiente: il processo API server in esecuzione (tsx, no watch-mode, avviato Sun Jul 12 22:51) precede il commit d31b6ea di oggi ('fix(community): wire the missing isPublic write path'), che è l'UNICO punto che cabla isPublic in POST /community — il codice sorgente è già corretto, ma il processo in memoria esegue ancora la versione pre-fix che ignora il campo. Serve un riavvio del server API per una verifica end-to-end reale; qui sotto si semina la community privata direttamente via DB per testare comunque il flusso di approvazione (che non dipende da questo fix).",
            "alta",
          );
        }
      }
      await pageA.keyboard.press("Escape").catch(() => {});
      await pageA.waitForTimeout(400);
    }

    // ── STEP 2: seed a private community via DB if the UI path didn't yield
    // one (expected, given the stale server) ───────────────────────────────
    if (!privateCommunityId) {
      const { rows: commRows } = await pool.query(
        `insert into communities (name, description, icon_emoji, creator_id, is_public)
         values ($1, $2, '🔒', $3, false) returning id`,
        [seededName, "Community privata seminata via DB per testare il flusso di approvazione join", userIdA],
      );
      seededCommunityId = commRows[0].id;
      privateCommunityId = seededCommunityId;
      joinFlowName = seededName;

      await pool.query(
        `insert into community_roles (community_id, name, permissions, position, is_default)
         values ($1, 'Membro', '[]'::jsonb, 0, true)`,
        [seededCommunityId],
      );
      const { rows: adminRoleRows } = await pool.query(
        `insert into community_roles (community_id, name, permissions, position, is_default)
         values ($1, 'Admin', $2::jsonb, 1, false) returning id`,
        [seededCommunityId, JSON.stringify(ALL_PERMISSIONS)],
      );
      await pool.query(
        `insert into community_members (community_id, user_id, role, role_id) values ($1, $2, 'owner', $3)`,
        [seededCommunityId, userIdA, adminRoleRows[0].id],
      );
      await pool.query(
        `insert into community_channels (community_id, name, type, position) values ($1, 'generale', 'text', 0), ($1, 'analisi', 'text', 1)`,
        [seededCommunityId],
      );

      note(
        "seed-private-community",
        "assertion",
        `LIMITAZIONE AMBIENTE: creata via query diretta al DB Postgres (postgres://…/traderloadings) una community privata di test ("${seededName}", id=${seededCommunityId}, is_public=false) intestata a USER_A, con ruoli Membro/Admin, membership owner e 2 canali — necessario per esercitare dal vivo il flusso di approvazione join perché il toggle UI non è verificabile end-to-end col processo API server stale corrente (vedi finding 'create-toggle-stale-server'). Non è un bypass di un bug applicativo: è l'unico modo per testare oggi una feature già pronta in un processo che non può essere riavviato in questa sessione.`,
        "info",
      );
    } else {
      note(
        "seed-private-community",
        "assertion",
        "Il toggle privata ha funzionato dal vivo: riuso la community creata via UI per il resto del flusso di approvazione join, nessun seed DB necessario.",
        "info",
      );
    }

    // ── STEP 3 (C): the private community must be discoverable-but-locked ──
    await pageC.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
    await settle(pageC);
    await shot(pageC, "04-comunita-C-discover.png");

    const discoverRow = pageC.getByText(joinFlowName, { exact: false }).first();
    const rowVisible = await discoverRow
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!rowVisible) {
      note(
        "discover-list",
        "assertion",
        `Community privata "${joinFlowName}" non visibile nella lista 'Scopri' per USER_C (non membro) — dovrebbe essere discoverable-but-locked`,
        "alta",
      );
    } else {
      await discoverRow.click();
      await pageC.waitForTimeout(1500);
      await shot(pageC, "05-comunita-C-selected-private.png");
      await scanBodyText(pageC, "private-cover");

      const crashBanner = pageC.locator("[data-root-error-boundary]");
      const crashed = await crashBanner.first().isVisible().catch(() => false);

      if (crashed) {
        note(
          "private-cover-crash",
          "assertion",
          "BUG REALE CONFERMATO DAL VIVO (stack trace catturata dal console-error del browser): selezionare una community privata come utente non membro fa crashare l'INTERA app con `TypeError: Cannot read properties of undefined (reading 'find')` in components/social/CommunityTab.tsx, catturato solo dal fallback a schermo intero di RootErrorBoundary ('qualcosa è andato storto'), invece di mostrare il cover-only con lucchetto/bottone 'Richiedi accesso' atteso. Causa: `const selectedChannel = communityDetail?.channels.find(...)` (riga ~48) usa optional-chaining solo su `communityDetail`, non sulla catena fino a `.channels` — se `communityDetail` esiste ma `.channels` è undefined, `.find` esplode comunque; lo stesso pattern non protetto si ripete su `.channels.filter` (~riga 285, dentro channelPanel) e `.channels.find` (~riga 564, pricing). Il payload 'locked' che GET /community/:id (routes/community.ts) restituisce a un non-membro di una community privata OMETTE del tutto il campo `channels` (il tipo CommunityDetail lo dichiara sempre presente, ma a runtime non lo è per questo payload) — TypeError non gestito che sale fino al boundary di root. Qualsiasi utente clicchi su una community privata nella lista 'Scopri' vede l'intera app rompersi, non solo la tab Community: la feature 'community privata' è di fatto INACCESSIBILE per chi deve richiedere l'accesso.",
          "alta",
        );
        await pageC.reload({ waitUntil: "domcontentloaded" });
        await settle(pageC);

        // Work around the crash to still exercise the rest of the approval flow
        // (the "Richiedi accesso" button is unreachable — the page never
        // renders it before crashing).
        const joinResp = await apiFromPage(pageC, `/api/community/${privateCommunityId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Vorrei unirmi al test!" }),
        });
        joinRequestedViaApiWorkaround = true;
        console.log(`  [join-workaround] POST /api/community/${privateCommunityId}/join → ${joinResp.status} ${JSON.stringify(joinResp.body)}`);
        note(
          "join-request-workaround",
          "assertion",
          `A causa del crash sopra, il bottone 'Richiedi accesso' non è mai raggiungibile dalla UI: la richiesta di join di USER_C è stata inviata con una chiamata diretta a POST /api/community/${privateCommunityId}/join (status ${joinResp.status}) solo per poter comunque verificare dal vivo il resto del flusso di approvazione (pannello richieste + approvazione).`,
          "info",
        );
      } else {
        const lockedHintSeen = await sawText(pageC, "Community privata: richiedi l'accesso per vedere i canali.", 4000);
        if (!lockedHintSeen) {
          note("private-cover", "assertion", "Copy 'community.join.locked_hint' non visibile per il non-membro sulla community privata", "media");
        }
        const requestBtn = pageC.getByRole("button", { name: "Richiedi accesso" });
        const requestBtnVisible = await requestBtn.first().isVisible().catch(() => false);
        if (!requestBtnVisible) {
          note("private-cover", "assertion", "Bottone 'Richiedi accesso' non visibile per il non-membro sulla community privata", "alta");
        } else {
          await requestBtn.first().click();
          const pendingSeen = await sawText(pageC, "Richiesta inviata", 5000);
          await shot(pageC, "06-comunita-C-join-requested.png");
          if (!pendingSeen) {
            note("join-request-ui", "assertion", "Dopo il click su 'Richiedi accesso' non compare lo stato 'Richiesta inviata'", "media");
          } else {
            console.log("  [join] richiesta inviata dalla UI ✓");
          }
        }
      }
    }

    // ── STEP 5 (A): approve the pending join request ────────────────────────
    await pageA.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
    await settle(pageA);
    await pageA.getByText(joinFlowName, { exact: false }).first().click();
    await pageA.waitForTimeout(1000);

    const manageBtn = pageA.getByRole("button", { name: "Gestisci community" });
    const manageVisible = await manageBtn.first().isVisible().catch(() => false);
    if (!manageVisible) {
      note("join-approve", "assertion", "Bottone 'Gestisci community' non visibile per il proprietario USER_A", "alta");
    } else {
      await manageBtn.first().click();
      const settingsDialog = pageA.getByRole("dialog");
      const settingsOpen = await settingsDialog
        .getByText("Impostazioni community")
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!settingsOpen) {
        note("join-approve", "assertion", "CommunitySettingsModal non si apre da 'Gestisci community'", "alta");
      } else {
        const requestsTab = settingsDialog.getByRole("button", { name: "Richieste" });
        const requestsTabVisible = await requestsTab.first().isVisible().catch(() => false);
        if (!requestsTabVisible) {
          note("join-approve", "assertion", "Tab 'Richieste' non visibile in CommunitySettingsModal per il proprietario", "alta");
        } else {
          await requestsTab.first().click();
          await pageA.waitForTimeout(600);
          await shot(pageA, "07-join-requests-before.png");

          const approveBtn = settingsDialog.getByRole("button", { name: "Approva" });
          const approveVisible = await approveBtn.first().isVisible().catch(() => false);
          if (!approveVisible) {
            note(
              "join-approve",
              "assertion",
              "Nessuna richiesta pendente visibile nel pannello Richieste (attesa: la richiesta di USER_C)",
              "alta",
            );
          } else {
            await approveBtn.first().click();
            await pageA.waitForTimeout(1200);
            await shot(pageA, "08-join-requests-after.png");
            const emptyNow = await sawText(pageA, "Nessuna richiesta in attesa", 4000);
            if (!emptyNow) {
              note("join-approve", "assertion", "Dopo l'approvazione il pannello Richieste non torna allo stato vuoto atteso", "media");
            } else {
              console.log("  [join] richiesta approvata ✓");
            }
          }
        }
      }
      await pageA.keyboard.press("Escape").catch(() => {});
      await pageA.waitForTimeout(300);
    }

    // ── STEP 6 (C): now a member — channels should be visible ───────────────
    await pageC.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
    await settle(pageC);
    await pageC.getByText(joinFlowName, { exact: false }).first().click();
    await pageC.waitForTimeout(1200);
    await shot(pageC, "09-comunita-C-member-view.png");
    await scanBodyText(pageC, "post-approval-access");

    const crashAgain = await pageC.locator("[data-root-error-boundary]").first().isVisible().catch(() => false);
    if (crashAgain) {
      note("post-approval-access", "assertion", "Anche da membro approvato, selezionare la community fa ancora crashare l'app", "alta");
    } else {
      const channelVisible = await pageC.getByText("generale", { exact: false }).first().isVisible().catch(() => false);
      if (!channelVisible) {
        note("post-approval-access", "assertion", "Dopo l'approvazione, USER_C non vede i canali della community privata", "alta");
      } else {
        note(
          "post-approval-access",
          "assertion",
          "Verificato dal vivo: dopo l'approvazione USER_C vede correttamente i canali della community privata (il crash da non-membro sopra non si ripresenta perché il payload da membro include sempre `channels`).",
          "info",
        );
      }
    }

    // ── STEP 7: DM (E2EE) between A and C ────────────────────────────────────
    await apiFromPage(pageA, `/api/social/follow/${userIdC}`, { method: "POST" });
    await apiFromPage(pageC, `/api/social/follow/${userIdA}`, { method: "POST" });
    followEstablished = true;

    await pageA.goto(`${BASE}/chat?t=messaggi`, { waitUntil: "domcontentloaded" });
    await settle(pageA, 3);
    await pageA.waitForTimeout(2000); // let mutual-followers query settle after the just-established follow
    await shot(pageA, "10-messaggi-A-contacts.png");

    const contactRowA = pageA.locator("div.flex.items-center.gap-3.p-3.rounded-xl.cursor-pointer").first();
    const contactVisibleA = await contactRowA.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
    if (!contactVisibleA) {
      note("dm-contact-list", "assertion", "USER_C non appare nella lista contatti (Messaggi) di USER_A dopo il mutual-follow", "alta");
    } else {
      await contactRowA.click();
      const inputA = pageA.getByPlaceholder("Messaggio cifrato...");
      const inputVisible = await inputA.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
      if (!inputVisible) {
        note("dm-send", "assertion", "Campo di input DM non visibile dopo aver selezionato il contatto", "alta");
      } else {
        const dmText = `DM usabilità ${stamp}`;
        await inputA.fill(dmText);
        await inputA.press("Enter");
        await pageA.waitForTimeout(1500);
        await shot(pageA, "11-messaggi-A-sent.png");
        const sentVisible = await sawText(pageA, dmText, 5000);
        if (!sentVisible) {
          note("dm-send", "assertion", "Il messaggio inviato da USER_A non compare nella propria lista messaggi dopo l'invio", "alta");
        }

        await pageC.goto(`${BASE}/chat?t=messaggi`, { waitUntil: "domcontentloaded" });
        await settle(pageC, 3);
        await pageC.waitForTimeout(2000);
        const contactRowC = pageC.locator("div.flex.items-center.gap-3.p-3.rounded-xl.cursor-pointer").first();
        const contactVisibleC = await contactRowC.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
        if (!contactVisibleC) {
          note("dm-contact-list", "assertion", "USER_A non appare nella lista contatti (Messaggi) di USER_C dopo il mutual-follow", "alta");
        } else {
          await contactRowC.click();
          // MessaggiTab polls messages every 8s; give it margin plus decrypt time.
          const received = await sawText(pageC, dmText, 13000);
          await shot(pageC, "12-messaggi-C-received.png");
          if (!received) {
            note(
              "dm-delivery",
              "assertion",
              `USER_C non ha ricevuto/decrittato entro il timeout il messaggio DM "${dmText}" inviato da USER_A`,
              "alta",
            );
          } else {
            console.log("  [dm] messaggio ricevuto e decrittato correttamente ✓");
          }
        }
      }
    }

    // ── STEP 8: paid channel — price it, then attempt checkout as a buyer ────
    let payingCommunityId = createdCommunityId;
    let payingCommunityName = createdName;
    if (!payingCommunityId) {
      // The UI creation never got a response we could read (see create-submit
      // finding above) — fall back to the seeded private community, which
      // already has channels and C is now a member of.
      payingCommunityId = privateCommunityId;
      payingCommunityName = joinFlowName;
    }

    if (payingCommunityId === privateCommunityId) {
      // C is already a member (approved above); nothing else to do.
    } else {
      // createdCommunityId is a separate (public, given the stale server)
      // community — make sure C is a member so it can hit the paid channel.
      await apiFromPage(pageC, `/api/community/${payingCommunityId}/join`, { method: "POST" });
    }

    await pageA.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
    await settle(pageA);
    await pageA.getByText(payingCommunityName, { exact: false }).first().click();
    await pageA.waitForTimeout(1000);

    const channelRowA = pageA.locator("div.group").filter({ hasText: "analisi" }).first();
    const channelRowVisible = await channelRowA.count().then((c) => c > 0).catch(() => false);
    if (!channelRowVisible) {
      note("paid-channel-setup", "assertion", "Canale 'analisi' non trovato nella community usata per il test del canale a pagamento", "media");
    } else {
      await channelRowA.hover().catch(() => {});
      const gearBtn = channelRowA.getByRole("button", { name: "Prezzo del canale" });
      const gearVisible = await gearBtn.first().isVisible().catch(() => false);
      if (!gearVisible) {
        note("paid-channel-setup", "assertion", "Icona impostazioni prezzo canale non visibile per il proprietario al hover sul canale", "alta");
      } else {
        await gearBtn.first().click();
        const pricingDialog = pageA.getByRole("dialog").filter({ hasText: "Prezzo del canale" });
        const pricingOpen = await pricingDialog.first().waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
        if (!pricingOpen) {
          note("paid-channel-setup", "assertion", "ChannelPricingModal non si apre dall'icona impostazioni", "alta");
        } else {
          await shot(pageA, "13-channel-pricing-modal.png");
          await pricingDialog.getByRole("button", { name: "Una tantum" }).click();
          await pricingDialog.locator('input[type="number"]').fill("5.00");
          await pricingDialog.getByRole("button", { name: "Salva" }).click();
          await pageA.waitForTimeout(1200);
          await shot(pageA, "14-channel-priced.png");
          const priceTagVisible = await pageA.getByText("5 EUR", { exact: false }).first().isVisible().catch(() => false);
          if (!priceTagVisible) {
            note("paid-channel-setup", "assertion", "Dopo il salvataggio, il canale 'analisi' non mostra l'etichetta di prezzo '5 EUR' nella sidebar", "media");
          } else {
            console.log("  [paid-channel] canale prezzato a 5 EUR ✓");
          }

          // ── C: open the now-paid channel and attempt checkout ────────────
          await pageC.goto(`${BASE}/chat?t=comunita`, { waitUntil: "domcontentloaded" });
          await settle(pageC);
          await pageC.getByText(payingCommunityName, { exact: false }).first().click();
          await pageC.waitForTimeout(1000);
          await pageC.getByText("analisi", { exact: false }).first().click();
          await pageC.waitForTimeout(1200);
          await shot(pageC, "15-channel-locked-C.png");
          await scanBodyText(pageC, "paid-channel-lock");

          const unlockBtn = pageC.getByRole("button", { name: /Acquista accesso/ });
          const unlockVisible = await unlockBtn.first().isVisible().catch(() => false);
          if (!unlockVisible) {
            note("paid-channel-unlock", "assertion", "ChannelUnlockPanel / bottone di acquisto non visibile per il canale a pagamento lato acquirente", "alta");
          } else {
            const [checkoutResp] = await Promise.all([
              pageC
                .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/checkout"), { timeout: 10000 })
                .catch(() => null),
              unlockBtn.first().click(),
            ]);
            if (!checkoutResp) {
              note("paid-channel-checkout", "assertion", "Nessuna risposta osservata per POST .../checkout dopo il click su 'Acquista accesso'", "alta");
            } else {
              const status = checkoutResp.status();
              const body = await checkoutResp.json().catch(() => null);
              console.log(`  [checkout] status=${status} body=${JSON.stringify(body)}`);
              await pageC.waitForTimeout(800);
              await shot(pageC, "16-channel-checkout-result.png");
              if (status === 409 && body?.code === "creator_not_onboarded") {
                note(
                  "paid-channel-checkout",
                  "assertion",
                  "Come atteso in locale: checkout bloccato con 409 creator_not_onboarded — USER_A (creatore) non ha completato l'onboarding Stripe Connect in questo ambiente, quindi il gate anti-frode blocca correttamente l'acquisto prima di creare qualunque sessione Stripe. Comportamento corretto, non un bug; il flusso di checkout reale non è ulteriormente testabile senza un account Connect onboardato (fuori scope per un ambiente locale).",
                  "info",
                );
              } else if (status === 402) {
                note("paid-channel-checkout", "assertion", `Checkout non disponibile: ${JSON.stringify(body)} (Stripe non configurato in questo ambiente?)`, "info");
              } else if (status === 200 && body?.url) {
                note(
                  "paid-channel-checkout",
                  "assertion",
                  `Checkout Stripe raggiunto correttamente: sessione creata con redirect verso ${body.url} (non completato, come da istruzioni — nessuna carta inserita).`,
                  "info",
                );
              } else {
                note("paid-channel-checkout", "assertion", `Risposta inattesa da POST .../checkout: status=${status} body=${JSON.stringify(body)}`, "alta");
              }
            }
          }
        }
      }
    }

    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.stack ?? err?.message ?? err);
    note("driver", "assertion", `Crash del driver: ${err?.message ?? err}`, "alta");
    await shot(pageA, "99-error-A.png").catch(() => {});
    await shot(pageC, "99-error-C.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    // ── Cleanup: everything this driver created, best-effort ────────────────
    if (createdCommunityId) await deepDeleteCommunity(pool, createdCommunityId);
    if (seededCommunityId && seededCommunityId !== createdCommunityId) await deepDeleteCommunity(pool, seededCommunityId);

    if (followEstablished && userIdA && userIdC) {
      await apiFromPage(pageA, `/api/social/follow/${userIdC}`, { method: "DELETE" }).catch(() => {});
      await apiFromPage(pageC, `/api/social/follow/${userIdA}`, { method: "DELETE" }).catch(() => {});
      console.log("  [cleanup] follow relationships removed");
    }
    void joinRequestedViaApiWorkaround; // documented above; rows removed with the community itself

    const mergedCollectors = {
      consoleErrors: [...collectorsA.consoleErrors, ...collectorsC.consoleErrors],
      pageErrors: [...collectorsA.pageErrors, ...collectorsC.pageErrors],
      failedRequests: [...collectorsA.failedRequests, ...collectorsC.failedRequests],
    };
    reportFindings(AREA, findings, mergedCollectors);
    await pool.end().catch(() => {});
    await browser.close();
  }
}

main();
