// Runtime verifier for the Archive page (/wiki) — Claude Design "Archivio".
// Seeds a deterministic set of wiki rows for the Clerk test user, signs in,
// forces Pro, drives grid/list/board + the detail modal's tag editor (which
// hits PATCH /api/wiki/sources/:id { tags }), screenshots each state, confirms
// the tag persisted in the DB, then deletes the seeded rows.
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import pg from "pg";

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
const DB_URL = process.env.VERIFY_DATABASE_URL || "postgres://trader:trader@127.0.0.1:55432/traderloadings";

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

const pool = new pg.Pool({ connectionString: DB_URL });

async function seed(userId) {
  await cleanup(userId); // start clean
  const fA = await pool.query(
    `INSERT INTO wiki_folders (user_id, name, position) VALUES ($1,'Setup salvati',0) RETURNING id`, [userId]);
  const fB = await pool.query(
    `INSERT INTO wiki_folders (user_id, name, color, position) VALUES ($1,'Strategie & Piani','#22c55e',1) RETURNING id`, [userId]);
  const a = fA.rows[0].id, b = fB.rows[0].id;
  const rows = [
    ["image", "Breakout EUR/USD 4H — setup A+", a, '["breakout","EURUSD"]', "1920x1080 PNG"],
    ["pdf", "Piano di Trading 2026", b, '["regole","risk"]', "12 pagine"],
    ["video", "Order Blocks & Fair Value Gaps", null, '["SMC","lezione"]', ""],
    ["audio", "Review settimana 12 — vocale", a, '["review","disciplina"]', ""],
    ["url", "ForexFactory — Calendario economico", null, '["news","calendario"]', ""],
    ["text", "Regola: stop dopo -2R nella giornata", b, '["disciplina"]', ""],
    ["text", "Checklist pre-entrata (5 punti)", null, '["checklist","regole"]', ""],
  ];
  const ids = [];
  for (const [kind, title, folder, tags, fileName] of rows) {
    const r = await pool.query(
      `INSERT INTO wiki_sources (user_id, kind, title, status, extracted_text, tags, folder_id, file_name)
       VALUES ($1,$2,$3,'ready',$4,$5,$6,$7) RETURNING id`,
      [userId, kind, title, `Nota di esempio per "${title}".`, tags, folder, fileName || null],
    );
    ids.push(r.rows[0].id);
  }
  console.log(`seeded ${ids.length} sources, folders [${a}, ${b}]`);
  return { sourceIds: ids, folderIds: [a, b] };
}

async function cleanup(userId) {
  await pool.query(`DELETE FROM wiki_sources WHERE user_id=$1`, [userId]);
  await pool.query(`DELETE FROM wiki_folders WHERE user_id=$1`, [userId]);
}

const outDir = new URL("../../artifacts.local/verify-archive/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, outDir)) }).then(() => console.log(`  📸 ${name}`));

const DISMISS = [/^Accetta$/, /^Skip$/i, /^Dopo$/i, /^Salta$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
async function dismiss(page) {
  for (let p = 0; p < 5; p++) {
    let acted = false;
    for (const re of DISMISS) {
      const btn = page.getByRole("button", { name: re }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click().catch(() => {});
        acted = true;
        await page.waitForTimeout(200);
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
    if (!acted) break;
  }
}

async function main() {
  const userId = await clerkUserId();
  const seeded = await seed(userId);

  await clerkSetup();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    try { localStorage.setItem("tl_language", "it"); } catch { /* ignore */ }
  });
  page.on("console", (m) => m.type() === "error" && console.log("  [browser error]", m.text()));
  page.on("response", (r) => {
    if (r.url().includes("/api/wiki/sources/") && r.request().method() === "PATCH") {
      console.log(`  [PATCH ${r.url().split("/").pop()} → ${r.status()}]`);
    }
  });

  await page.route("**/api/billing/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: "pro", pro: true, status: "active", manualOverride: true }) }),
  );

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
        body: JSON.stringify({ selectedPairs: ["EUR/USD", "XAU/USD"], onboardingTutorialCompletedAt: new Date().toISOString() }),
      });
    });

    await page.goto(`${BASE}/wiki`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await dismiss(page);
    await page.waitForTimeout(800);
    await shot(page, "01-grid.png");
    console.log("  cards rendered:", await page.locator("button:has-text('Breakout EUR/USD')").count());
    console.log("  collections in rail:", await page.getByText(/Setup salvati|Strategie & Piani/).count());

    // List view
    await page.getByRole("button", { name: "Lista" }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "02-list.png");

    // Board view
    await page.getByRole("button", { name: "Bacheca" }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "03-board.png");

    // Density toggle (compact) then back to grid
    await page.getByRole("button", { name: "Griglia" }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Densità" }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, "04-grid-compact.png");
    await page.getByRole("button", { name: "Densità" }).first().click().catch(() => {});

    // Type filter: click "Video" chip
    await page.getByRole("button", { name: /^Video$/ }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "05-filter-video.png");
    console.log("  count after Video filter:", await page.locator("button:has-text('Order Blocks')").count());
    await page.getByRole("button", { name: /^Tutti$/ }).first().click().catch(() => {});
    await page.waitForTimeout(300);

    // Open detail modal on the video item and ADD A TAG (drives PATCH tags).
    await page.locator("button:has-text('Order Blocks & Fair Value Gaps')").first().click().catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, "06-modal.png");
    const tagInput = page.getByPlaceholder(/Aggiungi tag/i).first();
    await tagInput.fill("smc-verify").catch(() => {});
    await tagInput.press("Enter").catch(() => {});
    await page.waitForTimeout(900);
    await shot(page, "07-modal-tag-added.png");

    // Confirm the tag persisted server-side.
    const persisted = await pool.query(
      `SELECT tags FROM wiki_sources WHERE user_id=$1 AND title LIKE 'Order Blocks%'`, [userId]);
    console.log("  DB tags after edit:", persisted.rows[0]?.tags);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    // Add dialog
    await page.getByRole("button", { name: /^Aggiungi$/ }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "08-add-dialog.png");
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    // Search narrows the grid (client-side over title/extracted text/tags).
    const searchBox = page.getByPlaceholder(/Cerca per titolo/i).first();
    await searchBox.fill("Breakout").catch(() => {});
    await page.waitForTimeout(500);
    const breakoutVisible = await page.locator("button:has-text('Breakout EUR/USD')").count();
    const pianoVisible = await page.locator("button:has-text('Piano di Trading')").count();
    console.log(`  search 'Breakout' → breakout=${breakoutVisible} other(piano)=${pianoVisible}`);
    await shot(page, "09-search.png");
    await searchBox.fill("").catch(() => {});
    await page.waitForTimeout(400);

    // Drag a source onto a collection (HTML5 DnD via synthetic events) → moves it.
    const setupId = seeded.folderIds[0];
    const moved = await page.evaluate(() => {
      const dt = new DataTransfer();
      const btns = [...document.querySelectorAll("button")];
      const card = btns.find((b) => b.textContent?.includes("Order Blocks & Fair Value Gaps"));
      const target = btns.find((b) => b.textContent?.includes("Setup salvati"));
      if (!card || !target) return { ok: false, card: !!card, target: !!target };
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
      return { ok: true };
    });
    console.log("  DnD dispatched:", JSON.stringify(moved));
    await page.waitForTimeout(1300);
    const afterMove = await pool.query(
      `SELECT folder_id FROM wiki_sources WHERE user_id=$1 AND title LIKE 'Order Blocks%'`, [userId]);
    console.log(`  DB folder_id after drag: ${afterMove.rows[0]?.folder_id} (Setup folder = ${setupId})`);
    await shot(page, "10-after-drag.png");

    console.log("DONE");
  } catch (err) {
    console.error("driver error:", err?.message ?? err);
    await shot(page, "99-error.png").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    await cleanup(userId).catch(() => {});
    await pool.end();
    console.log("cleaned up seeded rows");
  }
}

main();
