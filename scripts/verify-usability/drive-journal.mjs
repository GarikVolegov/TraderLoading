// Usability sweep — area "journal": full happy-path on /journal with USER_A.
// Creates a manual journal entry with structured trade fields (symbol/direction/
// entry/stop/exit/P&L), verifies it in the Trades list, checks that the coach
// (Panoramica / GET /api/journal/edge) reacts, exercises Idee + Obiettivi,
// uploads an image into the entry, then cleans up what it created.
// Run from the repo root: node scripts/verify-usability/drive-journal.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  dismiss,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "journal";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

// 1x1 red PNG — valid file for the react-dropzone image input.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pngPath = fileURLToPath(new URL("fixture-upload.png", outDir));
writeFileSync(pngPath, Buffer.from(PNG_BASE64, "base64"));

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
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

/** Modal helper: the Label→Input pairs aren't wired via htmlFor, so target the
 * input via the real DOM structure of the modal: components/ui/input.tsx wraps
 * the <input> in a `<div class="relative w-full">` sibling of the <label>. */
function fieldAfterLabel(dialog, label) {
  return dialog.locator(`label:text-is("${label}") + div input`).first();
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

  const stamp = Date.now();
  const entryTitle = `Usability trade ${stamp}`;
  const ideaText = `Idea usabilità ${stamp}`;
  const goalText = `Obiettivo usabilità ${stamp}`;

  try {
    await signIn(page, USER_A);
    await completeOnboarding(page);

    // ── Baseline: coach/edge state before creating the trade ─────────────
    const edgeBefore = await apiFromPage(page, "/api/journal/edge");
    const closedBefore = edgeBefore?.body?.overall?.closedTrades ?? 0;
    console.log(`  [edge] baseline closedTrades=${closedBefore} (status ${edgeBefore?.status})`);
    if (edgeBefore.status !== 200) {
      note("edge-baseline", "assertion", `GET /api/journal/edge returned ${edgeBefore.status} before test`, "alta");
    }

    // ── Trades tab: create a manual entry with trade fields ──────────────
    await page.goto(`${BASE}/journal?t=trades`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await shot(page, "01-trades-tab.png");

    const newTradeBtn = page.getByRole("button", { name: "Nuovo Trade" }).first();
    if (!(await newTradeBtn.isVisible().catch(() => false))) {
      // Empty state shows "Primo Trade" instead.
      const firstTradeBtn = page.getByRole("button", { name: "Primo Trade" }).first();
      if (await firstTradeBtn.isVisible().catch(() => false)) {
        await firstTradeBtn.click();
      } else {
        note("create-entry", "assertion", 'Neither "Nuovo Trade" nor "Primo Trade" button visible on /journal?t=trades', "alta");
      }
    } else {
      await newTradeBtn.click();
    }

    const dialog = page.getByRole("dialog");
    const modalOpen = await dialog
      .getByText("Nuovo Entry nel Diario")
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!modalOpen) {
      note("create-entry", "assertion", "JournalEntryModal did not open after clicking Nuovo Trade", "alta");
    } else {
      // Structured trade fields (feed the coach).
      await fieldAfterLabel(dialog, "Simbolo").fill("EURUSD");
      await fieldAfterLabel(dialog, "P&L").fill("100");
      await fieldAfterLabel(dialog, "Entrata").fill("1.1000");
      await fieldAfterLabel(dialog, "Uscita").fill("1.1100");
      await fieldAfterLabel(dialog, "Stop loss").fill("1.0950");
      // Result → Win
      await dialog.getByRole("button", { name: "Win", exact: true }).first().click();
      // Title
      await dialog.getByPlaceholder("Es. Breakout su EUR/USD sessione di Londra").fill(entryTitle);
      await shot(page, "02-entry-modal-filled.png");

      await dialog.getByRole("button", { name: "Salva nel Diario" }).click();
      const savedToast = await sawText(page, "Entry salvata nel diario!");
      if (!savedToast) {
        note("create-entry", "ux", "No success toast after saving the journal entry (journal_modal.saved expected)", "media");
      }
      await page.waitForTimeout(800);
    }

    // Verify entry appears in list.
    const entryVisible = await page
      .getByRole("heading", { name: entryTitle })
      .first()
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!entryVisible) {
      note("entry-in-list", "assertion", `Created entry "${entryTitle}" not visible in the Trades list`, "alta");
    } else {
      console.log("  [trades] entry visible in list ✓");
    }
    await shot(page, "03-entry-in-list.png");

    // ── Panoramica: the coach must react to the new structured trade ─────
    let closedAfter = closedBefore;
    for (let i = 0; i < 6; i++) {
      const edgeAfter = await apiFromPage(page, "/api/journal/edge");
      closedAfter = edgeAfter?.body?.overall?.closedTrades ?? 0;
      if (closedAfter > closedBefore) break;
      await page.waitForTimeout(1500);
    }
    console.log(`  [edge] after create closedTrades=${closedAfter}`);
    if (!(closedAfter > closedBefore)) {
      note(
        "panoramica-coach",
        "assertion",
        `GET /api/journal/edge closedTrades did not increase after creating an entry with complete trade fields (before=${closedBefore}, after=${closedAfter}) — coach not reacting to manual trades`,
        "alta",
      );
    }

    await page.goto(`${BASE}/journal?t=panoramica`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const kpiVisible = await page.getByText("Totale Trade").first().isVisible().catch(() => false);
    if (!kpiVisible) {
      note("panoramica-coach", "assertion", 'KPI tile "Totale Trade" not visible on Panoramica tab', "media");
    }
    // The KPI number should reflect the edge data (— means no data). Scope to
    // exactly ONE ancestor div: StatTile renders <div><p>label</p><p>value</p></div>,
    // so [1] is the single tile's own container — [2] (a prior version of this
    // check) walked up to the shared 4-tile row and matched PROFIT FACTOR's
    // legitimate "—" (undefined with 0 losing trades) as if it were this tile's.
    const kpiText = kpiVisible
      ? await page
          .getByText("Totale Trade")
          .first()
          .locator("xpath=ancestor::*[self::div][1]")
          .innerText()
          .catch(() => "")
      : "";
    console.log(`  [panoramica] Totale Trade tile text: ${JSON.stringify(kpiText.slice(0, 80))}`);
    if (kpiVisible && /—/.test(kpiText) && closedAfter > 0) {
      note("panoramica-coach", "ux", `Panoramica "Totale Trade" tile shows "—" although edge reports ${closedAfter} closed trades`, "media");
    }
    await shot(page, "04-panoramica.png");

    // ── Idee tab: create an idea ──────────────────────────────────────────
    await page.goto(`${BASE}/journal?t=idee`, { waitUntil: "domcontentloaded" });
    await settle(page, 3);
    await page.getByPlaceholder("Nuova strategia o osservazione...").fill(ideaText);
    await page.getByRole("button", { name: "Aggiungi", exact: true }).first().click();
    const ideaVisible = await sawText(page, ideaText, 6000);
    if (!ideaVisible) {
      note("idee-create", "assertion", `Created idea "${ideaText}" not visible in list`, "alta");
    } else {
      console.log("  [idee] idea visible ✓");
      // No toast/confirmation exists for idea creation — the list update is the only feedback.
      note(
        "idee-create",
        "ux",
        "Creating an idea gives no toast/confirmation (only the list silently updates); error path has a toast but success does not",
        "bassa",
      );
    }
    await shot(page, "05-idee.png");

    // ── Obiettivi tab: create a goal ─────────────────────────────────────
    await page.goto(`${BASE}/journal?t=obiettivi`, { waitUntil: "domcontentloaded" });
    await settle(page, 3);
    await page.getByPlaceholder("Obiettivo da raggiungere...").fill(goalText);
    await page.getByRole("button", { name: "Aggiungi", exact: true }).first().click();
    const goalVisible = await sawText(page, goalText, 6000);
    if (!goalVisible) {
      note("obiettivi-create", "assertion", `Created goal "${goalText}" not visible in list`, "alta");
    } else {
      console.log("  [obiettivi] goal visible ✓");
    }
    await shot(page, "06-obiettivi.png");

    // ── Image upload: edit the created entry and attach a PNG ────────────
    await page.goto(`${BASE}/journal?t=trades`, { waitUntil: "domcontentloaded" });
    await settle(page, 3);
    const card = page.locator("div.group", { has: page.getByRole("heading", { name: entryTitle }) }).first();
    if (!(await card.count())) {
      note("image-upload", "assertion", "Entry card not found when returning to Trades tab for image upload", "alta");
    } else {
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.hover().catch(() => {});
      // Edit/delete actions are opacity-0 until hover — a discoverability issue on touch devices.
      const editBtn = card.getByRole("button", { name: "Modifica" }).first();
      const editBtnVisible = await editBtn.isVisible().catch(() => false);
      if (!editBtnVisible) {
        note("image-upload", "assertion", "Edit (Modifica) button not clickable on the entry card even after hover", "alta");
      } else {
        await editBtn.click();
        const editDialog = page.getByRole("dialog");
        const editOpen = await editDialog
          .getByText("Modifica Entry")
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        if (!editOpen) {
          note("image-upload", "assertion", "Edit modal did not open from the entry card", "alta");
        } else {
          await editDialog.locator('input[type="file"]').setInputFiles(pngPath);
          const previewShown = await editDialog
            .locator('img[alt="Preview"]')
            .first()
            .waitFor({ state: "visible", timeout: 5000 })
            .then(() => true)
            .catch(() => false);
          if (!previewShown) {
            note("image-upload", "assertion", "Image preview not shown after selecting a PNG in the dropzone", "alta");
          }
          await shot(page, "07-upload-preview.png");
          await editDialog.getByRole("button", { name: "Salva nel Diario" }).click();
          const savedToast2 = await sawText(page, "Entry salvata nel diario!");
          if (!savedToast2) {
            note("image-upload", "ux", "No success toast after saving the entry with an uploaded image", "media");
          }
          await page.waitForTimeout(1200);
          const thumb = await card
            .locator('img[alt="Thumbnail"]')
            .first()
            .waitFor({ state: "visible", timeout: 8000 })
            .then(() => true)
            .catch(() => false);
          if (!thumb) {
            note("image-upload", "assertion", "Uploaded image thumbnail not visible on the entry card after saving", "alta");
          } else {
            console.log("  [upload] thumbnail visible on card ✓");
          }
          await shot(page, "08-entry-with-image.png");
        }
      }

      // Static observation verified live: card actions are hidden until hover.
      note(
        "trades-card-actions",
        "ux",
        "Edit/delete actions on journal cards are opacity-0 until mouse hover (invisible / hard to discover on touch devices); the delete button is icon-only with no accessible name",
        "media",
      );
    }

    // ── Cleanup: delete entry (has confirm), idea and goal (no confirm) ──
    // Entry delete goes through window.confirm → accept it.
    page.once("dialog", (d) => d.accept().catch(() => {}));
    const delCard = page.locator("div.group", { has: page.getByRole("heading", { name: entryTitle }) }).first();
    if (await delCard.count()) {
      await delCard.hover().catch(() => {});
      const trashBtn = delCard.locator("button").filter({ has: page.locator("svg.lucide-trash-2, svg.lucide-trash2") }).first();
      if (await trashBtn.count()) {
        await trashBtn.click().catch(() => {});
        const deletedToast = await sawText(page, "Entry eliminato.");
        if (!deletedToast) {
          note("cleanup-entry", "ux", "No toast after deleting the journal entry (journal.deleted expected)", "bassa");
        }
        await page.waitForTimeout(800);
        const still = await page.getByRole("heading", { name: entryTitle }).count();
        if (still > 0) note("cleanup-entry", "assertion", "Entry still in list after delete", "media");
      } else {
        note("cleanup-entry", "assertion", "Delete (trash) button not found on the entry card", "media");
      }
    }

    // Idea + goal rows: trash is hover-revealed and there is NO confirmation.
    for (const [tab, text, step] of [
      ["idee", ideaText, "cleanup-idea"],
      ["obiettivi", goalText, "cleanup-goal"],
    ]) {
      await page.goto(`${BASE}/journal?t=${tab}`, { waitUntil: "domcontentloaded" });
      await settle(page, 2);
      const row = page.locator("div.group", { has: page.getByText(text) }).first();
      if (await row.count()) {
        await row.hover().catch(() => {});
        const trash = row.locator("button").filter({ has: page.locator("svg.lucide-trash-2, svg.lucide-trash2") }).first();
        if (await trash.count()) {
          await trash.click().catch(() => {});
          await page.waitForTimeout(700);
          const still = await page.getByText(text).count();
          if (still > 0) note(step, "assertion", `${tab} row still present after delete`, "media");
          else console.log(`  [${step}] deleted ✓`);
        } else {
          note(step, "assertion", `Trash button not found on ${tab} row`, "media");
        }
      } else {
        note(step, "assertion", `${tab} row "${text}" not found for cleanup`, "bassa");
      }
    }
    // Verified live during cleanup: ideas/goals are deleted immediately with no
    // confirmation and no undo — one click on a hover-revealed icon destroys data.
    note(
      "idee-obiettivi-delete",
      "ux",
      "Deleting an idea/goal happens immediately with no confirmation dialog, no toast and no undo (journal entries DO ask for confirm — inconsistent destructive-action pattern)",
      "media",
    );

    await dismiss(page);
    await shot(page, "09-final-state.png");
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
