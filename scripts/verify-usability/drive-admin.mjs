// Usability driver — area "admin": /admin console with USER_A.
//
// Whether USER_A is an admin depends on ADMIN_BOOTSTRAP_USER_IDS (.env.local) matching
// their Clerk user id. This driver checks that server-side truth via GET /api/admin/me
// (the same call AdminAccessBoundary makes — components/admin/shared.tsx) rather than
// assuming from the env var alone, then exercises whichever branch is real:
//   - admin: visit /admin + the 7 main subpages, screenshot each, watch for console/
//     request errors per-page.
//   - non-admin: verify the honest "Accesso admin non disponibile" fallback renders
//     (no crash, no blank screen).
//
// Run from the repo root: node scripts/verify-usability/drive-admin.mjs
import {
  USER_A,
  BASE,
  loadEnvLocal,
  clerkUserId,
  signIn,
  completeOnboarding,
  apiFromPage,
  outDirFor,
  makeShot,
  settle,
  attachErrorCollectors,
  reportFindings,
} from "./lib/common.mjs";

const AREA = "admin";
const outDir = outDirFor(AREA);
const shot = makeShot(outDir);

const findings = [];
const note = (step, kind, detail, severity = "media", extra = {}) => {
  findings.push({ step, kind, detail, severity, ...extra });
  console.log(`  ⚠ [${severity}] (${step}) ${detail}`);
};

async function closeCookieBanner(page) {
  const banner = page.locator("div.fixed").filter({ hasText: /cookie tecnici/i }).first();
  if (!(await banner.isVisible().catch(() => false))) return false;
  const btn = banner.getByRole("button", { name: /^(OK|Accetta)$/ }).first();
  await btn.click().catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

// The 7 main admin subpages required by the task, each with its known Italian
// page title (h1 or OperationalPageHeader) used to assert a real render.
const ADMIN_PAGES = [
  { path: "/admin", label: "dashboard", title: "Dashboard" },
  { path: "/admin/users", label: "users", title: "Utenti" },
  { path: "/admin/trading", label: "trading", title: "Trading" },
  { path: "/admin/content", label: "content", title: "Content" },
  { path: "/admin/reviews", label: "reviews", title: "Recensioni utenti" },
  { path: "/admin/subscriptions", label: "subscriptions", title: "Abbonamenti" },
  { path: "/admin/support", label: "support", title: "Supporto" },
  { path: "/admin/system", label: "system", title: "Sistema" },
];

async function main() {
  // ── ADMIN_BOOTSTRAP_USER_IDS vs. USER_A's Clerk id (no secrets printed) ──
  const env = loadEnvLocal();
  const bootstrapRaw = env.ADMIN_BOOTSTRAP_USER_IDS ?? "";
  const bootstrapIds = bootstrapRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const userId = await clerkUserId(USER_A);
  const envSaysAdmin = bootstrapIds.includes(userId);
  console.log(
    `  [env] ADMIN_BOOTSTRAP_USER_IDS has ${bootstrapIds.length} id(s); USER_A (${userId}) is ${envSaysAdmin ? "" : "NOT "}among them`,
  );

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tl_language", "it");
    } catch {
      /* ignore */
    }
  });
  // 403 on GET /api/admin/me is the EXPECTED signal for a non-admin user (it's
  // exactly what AdminAccessBoundary itself reacts to, to show the honest
  // fallback) — allow only that endpoint here (documented explicitly below)
  // rather than allowing 403 everywhere, so a real permission bug elsewhere
  // in the admin console would still surface as a finding.
  const collectors = attachErrorCollectors(page, { allowStatus: [401], allowUrl: [/\/api\/admin\/me(\?|$)/] });
  let nonAdminBranch = false;

  try {
    await signIn(page, USER_A);
    await completeOnboarding(page);

    // Server-side truth: what AdminAccessBoundary itself checks.
    const adminMe = await apiFromPage(page, "/api/admin/me");
    const isAdmin = adminMe.status === 200 && Boolean(adminMe.body?.role);
    console.log(`  [admin/me] status=${adminMe.status} role=${adminMe.body?.role ?? "(none)"} isAdmin=${isAdmin}`);
    if (envSaysAdmin !== isAdmin) {
      note(
        "admin-status",
        "assertion",
        `Disaccordo tra ADMIN_BOOTSTRAP_USER_IDS (attende isAdmin=${envSaysAdmin}) e GET /api/admin/me (role=${adminMe.body?.role ?? "nessuno"}) — possibile bootstrap non ancora applicato o admin concesso/rimosso per altra via`,
        "info",
      );
    }

    if (!isAdmin) {
      nonAdminBranch = true;
      note(
        "admin-status",
        "assertion",
        `GET /api/admin/me → ${adminMe.status} per utente non-admin (atteso, è il segnale che fa scattare il fallback lato client)`,
        "info",
      );
      // ── Non-admin branch: verify the honest fallback ──────────────────────
      await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await closeCookieBanner(page);
      const heading = await page.getByText("Accesso admin non disponibile").first().isVisible().catch(() => false);
      const body = await page.getByText("Il tuo account non ha permessi per la console admin.").first().isVisible().catch(() => false);
      await shot(page, "01-admin-non-admin-fallback.png");
      if (!heading || !body) {
        note(
          "admin-fallback",
          "assertion",
          `Fallback "Accesso admin non disponibile" incompleto o assente per utente non-admin (heading=${heading}, body=${body})`,
          "alta",
        );
      } else {
        console.log("  [fallback] messaggio onesto 'Accesso admin non disponibile' presente, nessun crash/blank ✓");
      }
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
      if (bodyText.trim().length === 0) {
        note("admin-fallback", "assertion", "Pagina /admin completamente vuota per utente non-admin", "alta");
      }
      note(
        "admin-branch-coverage",
        "assertion",
        "USER_A non è nel bootstrap admin in questo ambiente: il ramo del driver che visita /admin/users, /admin/trading, /admin/content, /admin/reviews, /admin/subscriptions, /admin/support, /admin/system non è stato esercitato dal vivo (richiederebbe riavviare il server API con ADMIN_BOOTSTRAP_USER_IDS aggiornato, fuori scope). Verificato solo per lettura codice: routing in pages/Admin.tsx + gate AdminAccessBoundary in components/admin/shared.tsx",
        "info",
      );
    } else {
      // ── Admin branch: visit /admin + the 7 main subpages ──────────────────
      for (let i = 0; i < ADMIN_PAGES.length; i++) {
        const { path, label, title } = ADMIN_PAGES[i];

        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await settle(page);
        if (label === "dashboard") await closeCookieBanner(page);

        const titleVisible = await page.getByText(title, { exact: true }).first().isVisible().catch(() => false);
        const shellVisible = await page.getByText("Accesso admin non disponibile").first().isVisible().catch(() => false);
        await shot(page, `0${i + 2}-admin-${label}.png`);

        if (shellVisible) {
          note(label, "assertion", `${path} mostra 'Accesso admin non disponibile' nonostante GET /api/admin/me riporti un ruolo`, "alta");
        } else if (!titleVisible) {
          note(label, "assertion", `${path}: titolo di pagina atteso "${title}" non visibile`, "media");
        } else {
          console.log(`  [admin] ${path} renderizzata (titolo "${title}" visibile) ✓`);
        }
      }
    }

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
    // The browser's own "Failed to load resource: ... 403" console message
    // for the expected, already-documented GET /api/admin/me 403 (non-admin
    // branch only) carries no URL for attachErrorCollectors' allowUrl to
    // match — strip that one specific generic line so it isn't double-
    // reported. Only in the non-admin branch: elsewhere a 403 would be real.
    if (nonAdminBranch) {
      collectors.consoleErrors = collectors.consoleErrors.filter(
        (t) => !/Failed to load resource.*403/.test(t),
      );
    }
    // Console/page/failed-request errors are attributed globally (step "*")
    // by reportFindings itself — the per-page notes above only cover the
    // title-render assertions, which need page context.
    reportFindings(AREA, findings, collectors);
    await browser.close();
  }
}

main();
