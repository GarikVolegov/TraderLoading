// Shared helpers for the manual usability-sweep drivers (scripts/verify-usability/*).
// Extracted from scripts/verify-nav-hubs/drive.mjs (the canonical Clerk test-user
// Playwright driver). Not part of the automated test suite; run by hand against a
// local dev server (`pnpm start:local`).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

export function loadEnvLocal() {
  const env = {};
  try {
    const txt = readFileSync(new URL("../../../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i).replace(/^export\s+/, "").trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local */
  }
  return env;
}

const env = loadEnvLocal();
process.env.CLERK_PUBLISHABLE_KEY ||= env.VITE_CLERK_PUBLISHABLE_KEY;
process.env.CLERK_SECRET_KEY ||= env.CLERK_SECRET_KEY;

// 127.0.0.1 (not localhost): the local Vite dev server binds IPv4-only, while
// Playwright's Chromium resolves localhost to ::1 first → ERR_CONNECTION_CLOSED.
export const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173";
export const USER_A = process.env.VERIFY_EMAIL || "verify+clerk_test@example.com";
export const USER_B = process.env.VERIFY_EMAIL_B || "verify.b+clerk_test@example.com";
const SECRET = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY;

async function clerkFetch(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

export async function clerkUserId(email) {
  const { body } = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}`);
  const id = Array.isArray(body) ? body[0]?.id : body?.data?.[0]?.id;
  if (!id) throw new Error(`no Clerk user for ${email}`);
  return id;
}

// Idempotent: returns the existing user id or creates a passwordless test user.
export async function ensureTestUser(email, { firstName = "Verify", lastName = "B" } = {}) {
  try {
    return await clerkUserId(email);
  } catch {
    /* create below */
  }
  const { res, body } = await clerkFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      first_name: firstName,
      last_name: lastName,
      skip_password_requirement: true,
    }),
  });
  if (!res.ok || !body?.id) {
    throw new Error(`ensureTestUser(${email}) failed: ${res.status} ${JSON.stringify(body?.errors ?? body)}`);
  }
  return body.id;
}

export async function mintTicket(userId) {
  const { res, body } = await clerkFetch("/sign_in_tokens", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok || !body?.token) {
    throw new Error(`sign_in_tokens failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

// One clerkSetup() per process (safe to call once before any signIn).
// Clerk's testing-token API fails transiently: retry a few times and never
// cache a rejected promise (a cached rejection would poison every later signIn).
let clerkReady = null;
export function ensureClerkSetup() {
  clerkReady ||= (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await clerkSetup();
      } catch (err) {
        lastErr = err;
        console.log(`  [clerk] clerkSetup attempt ${attempt} failed: ${err?.message || err?.name || err}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    clerkReady = null;
    throw lastErr;
  })();
  return clerkReady;
}

// Full ticket-strategy sign-in for `email` on a fresh page/context.
export async function signIn(page, email) {
  await ensureClerkSetup();
  const userId = await clerkUserId(email);
  await setupClerkTestingToken({ page });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await clerk.loaded({ page });
  const ticket = await mintTicket(userId);
  await clerk.signIn({ page, signInParams: { strategy: "ticket", ticket } });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 15000 })
    .catch(() => {});
  return userId;
}

// Mark onboarding done + a default pair so drivers land on the real app shell.
// Skip in drivers that exercise onboarding itself.
export async function completeOnboarding(page, pairs = ["EUR/USD"]) {
  await page.evaluate(async (selectedPairs) => {
    let token = null;
    try {
      token = await window.Clerk?.session?.getToken();
    } catch {
      /* cookie */
    }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ selectedPairs, onboardingTutorialCompletedAt: new Date().toISOString() }),
    });
  }, pairs);
}

// Authenticated fetch from inside the page (off-contract API poking from drivers).
export async function apiFromPage(page, path, init = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      let token = null;
      try {
        token = await window.Clerk?.session?.getToken();
      } catch {
        /* cookie */
      }
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers || {}),
        },
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON */
      }
      return { status: res.status, body };
    },
    { path, init },
  );
}

export function outDirFor(area) {
  const dir = new URL(`../../../artifacts.local/verify-usability/${area}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function makeShot(outDir) {
  return (page, name) =>
    page
      .screenshot({ path: fileURLToPath(new URL(name, outDir)), fullPage: false })
      .then(() => console.log(`  📸 ${name}`))
      .catch((e) => console.log(`  📸 ${name} FAILED: ${e?.message}`));
}

const DISMISS = [/^Accetta$/, /^Skip$/i, /^Dopo$/i, /^Salta$/i, /^Chiudi$/i, /Più tardi/i, /^Ho capito$/i];
export async function dismiss(page) {
  for (let p = 0; p < 6; p++) {
    let acted = false;
    for (const re of DISMISS) {
      const btn = page.getByRole("button", { name: re }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click().catch(() => {});
        acted = true;
        await page.waitForTimeout(250);
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
    if (!acted && (await page.locator(".fixed.inset-0").count()) === 0) break;
  }
}

export async function settle(page, rounds = 6) {
  await page.waitForTimeout(800);
  for (let i = 0; i < rounds; i++) {
    await dismiss(page);
    await page.waitForTimeout(400);
  }
}

// Collects browser console errors, uncaught page errors and >=400 responses.
// allowStatus/allowUrl filter *expected* failures (401 pre-auth, deliberate 5xx probes…).
export function attachErrorCollectors(page, { allowStatus = [401], allowUrl = [] } = {}) {
  const consoleErrors = [];
  const failedRequests = [];
  const pageErrors = [];
  const allowed = (url, status) =>
    allowStatus.includes(status) || allowUrl.some((re) => re.test(url));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("response", (r) => {
    const status = r.status();
    const url = r.url();
    // only same-origin app/API traffic; third parties (clerk, fonts…) are not ours
    if (status >= 400 && url.startsWith(BASE.replace(/\/$/, "")) && !allowed(url, status)) {
      failedRequests.push(`${status} ${r.request().method()} ${url}`);
    }
  });
  return { consoleErrors, failedRequests, pageErrors };
}

// Machine-parsable findings block + JSON file, aggregated later by run-all.mjs.
// finding: { step, kind: "console-error"|"failed-request"|"page-error"|"ux"|"assertion",
//            detail, screenshot?, severity? }
export function reportFindings(area, findings, collectors) {
  const all = [...findings];
  if (collectors) {
    const dedupe = (arr) => [...new Set(arr)];
    for (const text of dedupe(collectors.consoleErrors ?? [])) {
      all.push({ step: "*", kind: "console-error", detail: text });
    }
    for (const text of dedupe(collectors.pageErrors ?? [])) {
      all.push({ step: "*", kind: "page-error", detail: text });
    }
    for (const text of dedupe(collectors.failedRequests ?? [])) {
      all.push({ step: "*", kind: "failed-request", detail: text });
    }
  }
  const payload = { area, at: new Date().toISOString(), findings: all };
  const dir = outDirFor(area);
  writeFileSync(fileURLToPath(new URL("findings.json", dir)), JSON.stringify(payload, null, 2));
  console.log(`FINDINGS_JSON: ${JSON.stringify(payload)}`);
  console.log(`FINDINGS: area=${area} count=${all.length}`);
  for (const f of all) console.log(`  - [${f.kind}] (${f.step}) ${f.detail}`);
  return all;
}
