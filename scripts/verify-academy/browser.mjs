import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createFixtures } from "../verify-operating-center/fixtures.mjs";
import { ACADEMY_MODULES, ACADEMY_SYLLABUS } from "../../contracts/academy.ts";

// Run: pnpm --filter @workspace/scripts exec tsx verify-academy/browser.mjs
// UI-only fixtures: every API response and mutation is intercepted locally;
// no personal DB, real login, video provider, or payment service is contacted.
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(root + "artifacts/trader-dashboard/package.json");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const out = root + "artifacts.local/academy/";
await mkdir(out, { recursive: true });
const port = Number(process.env.ACADEMY_AUDIT_PORT ?? 5191);
const base = `http://127.0.0.1:${port}`;
process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=";
process.env.PORT = String(port);
const vite = await createServer({
  cacheDir: root + ".local-logs/academy-vite",
  configFile: root + "artifacts/trader-dashboard/vite.config.ts",
  server: { host: "127.0.0.1", port, strictPort: true },
  resolve: { alias: [{ find: "@clerk/react", replacement: fileURLToPath(new URL("./clerk-fixture.js", import.meta.url)) }] },
});
await vite.listen();
const browser = await chromium.launch({ headless: true, executablePath: require("puppeteer").executablePath() });
const checks = [], errors = [], requests = [], blockedExternal = new Set(), contexts = [];
const mark = name => { checks.push(name); console.log("PASS academy browser:", name); };
const now = "2026-10-18T12:00:00.000Z";
const lessonId = "fda37a99-34ba-48d5-a7f1-b5b674438229";
const lessons = [{ id: lessonId, moduleId: "preparazione", syllabusId: "preparazione-1", title: "Lezione di verifica locale", description: "Video sintetico usato esclusivamente per la verifica dell’interfaccia.", orderIndex: 0, publishedAt: now, published: true, videoUrl: "https://www.youtube.com/watch?v=abcdefghijk", videoEmbedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk", bodyMarkdown: "Appunti del docente: verifica locale del percorso.", exercisePrompt: "Descrivi la preparazione della sessione simulata.", createdAt: now, updatedAt: now }];
const progress = new Map();
const affiliates = new Set();
const state = { failProgress: false, failTeacherSave: false, failFeedback: false };
const metadata = lesson => Object.fromEntries(["id", "moduleId", "syllabusId", "title", "description", "orderIndex", "publishedAt"].map(key => [key, lesson[key]]));
const billing = actor => ({
  active: actor === "student", status: actor === "student" ? "active" : "none", currentPeriodEnd: actor === "student" ? "2026-11-18T12:00:00.000Z" : null,
  cancelAtPeriodEnd: false, salesEnabled: false, checkoutAvailable: false,
  price: { amountCents: 15000, currency: "eur", interval: "month" },
  affiliate: { enrolled: affiliates.has(actor), termsVersion: "2026-10-17", rateBps: 2000, holdDays: 30, code: affiliates.has(actor) ? "AC1234567890ABCDEF" : null, link: affiliates.has(actor) ? "/academy?ref=AC1234567890ABCDEF" : null },
  commissions: { pendingCents: 0, availableCents: 0, paidCents: 0, currency: "eur" },
});
async function makeContext(actor = "student") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "it-IT", timezoneId: "Europe/Rome", reducedMotion: "reduce" });
  contexts.push(context);
  const fixtures = createFixtures();
  await context.addInitScript(actor => {
    localStorage.setItem("tl_language", "it");
    localStorage.setItem("tl_cookie_consent_v1", "declined");
    localStorage.setItem("academy_fixture_actor", actor);
  }, actor);
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (["www.youtube-nocookie.com", "player.vimeo.com"].includes(url.hostname)) return route.fulfill({ contentType: "text/html", body: "<html lang='it'><body style='background:#0a1218;color:#bcd2df;font:18px sans-serif;padding:40px'>Anteprima video isolata per verifica UI</body></html>" });
    if (url.hostname !== "127.0.0.1") { blockedExternal.add(url.hostname); return route.abort(); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.slice(4), method = request.method();
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/billing/me") return reply({ pro: false, plan: "free", status: "free", checkoutAvailable: false });
    if (path === "/payout/account") return reply({ available: false, connected: false, payoutsEnabled: false, chargesEnabled: false, detailsSubmitted: false });
    if (!path.startsWith("/academy/")) return fixtures.handle(route);
    const body = request.postDataJSON() ?? {};
    requests.push({ actor, path, method, body });
    if (actor === "visitor") return reply({ error: "Unauthenticated fixture" }, 401);
    const isTeacher = actor === "teacher", hasAccess = isTeacher || actor === "student";
    if (path === "/academy/catalog") return reply({ modules: ACADEMY_MODULES, syllabus: ACADEMY_SYLLABUS, lessons: lessons.filter(item => item.published).map(metadata), access: { hasAccess, isTeacher }, progress: hasAccess ? [...progress.values()].filter(item => item.userId === actor) : [] });
    if (path === "/academy/billing") return reply(billing(actor));
    if (path === "/academy/affiliate/enroll" && method === "POST") {
      if (!body.acceptedTerms || body.termsVersion !== "2026-10-17") return reply({ error: "Terms required" }, 400);
      affiliates.add(actor); return reply({ enrolled: true });
    }
    if (path === "/academy/affiliate/commissions") return reply({ items: [], currency: "eur" });
    if (path === "/academy/affiliate/payouts") return isTeacher ? reply({ items: [], currency: "eur" }) : reply({ error: "Forbidden" }, 403);
    if (path.startsWith("/academy/teacher/") && !isTeacher) return reply({ error: "Teacher required" }, 403);
    if (path === "/academy/teacher/lessons" && method === "GET") return reply(lessons);
    if (path === "/academy/teacher/lessons" && method === "POST") {
      if (state.failTeacherSave) return reply({ error: "Synthetic save failure" }, 503);
      const item = { ...body, id: randomUUID(), createdAt: now, updatedAt: now, publishedAt: body.published ? now : null, videoEmbedUrl: null };
      lessons.push(item); return reply(item, 201);
    }
    if (path.startsWith("/academy/teacher/lessons/") && method === "PATCH") {
      const item = lessons.find(item => item.id === path.split("/").at(-1));
      if (!item) return reply({ error: "Missing fixture" }, 404);
      Object.assign(item, body); return reply(item);
    }
    if (path === "/academy/teacher/submissions") return reply([...progress.values()].filter(item => item.submittedAt).map(item => ({ ...item, lessonTitle: lessons.find(lesson => lesson.id === item.lessonId)?.title ?? "Lezione" })));
    if (path.startsWith("/academy/teacher/submissions/") && method === "PATCH") {
      const item = [...progress.values()].find(item => item.id === path.split("/").at(-1));
      if (!item) return reply({ error: "Missing fixture" }, 404);
      if (state.failFeedback || item.submittedAt !== body.submittedAt) return reply({ error: "Submission changed" }, 409);
      Object.assign(item, { feedback: body.feedback, reviewedAt: now }); return reply(item);
    }
    if (path.startsWith("/academy/lessons/")) {
      if (!hasAccess) return reply({ error: "Academy required" }, 403);
      const id = path.split("/")[3], lesson = lessons.find(item => item.id === id);
      if (!lesson) return reply({ error: "Missing fixture" }, 404);
      const key = `${actor}:${id}`;
      if (method === "GET") return reply({ lesson, progress: progress.get(key) ?? null });
      if (method === "PUT" && path.endsWith("/progress")) {
        if (state.failProgress) return reply({ error: "Synthetic save failure" }, 503);
        const item = progress.get(key) ?? { id: randomUUID(), userId: actor, lessonId: id, completedAt: null, exerciseResponse: "", submittedAt: null, feedback: "", reviewedAt: null, updatedAt: now };
        if (body.exerciseResponse !== undefined && body.exerciseResponse !== item.exerciseResponse) Object.assign(item, { exerciseResponse: body.exerciseResponse, submittedAt: null, feedback: "", reviewedAt: null });
        if (body.completed !== undefined) item.completedAt = body.completed ? now : null;
        if (body.submit) item.submittedAt = now;
        progress.set(key, item); return reply(item);
      }
    }
    return reply({ error: "Unknown Academy fixture endpoint", path }, 404);
  });
  await context.routeWebSocket("**/api/**", ws => ws.close());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  return page;
}
async function visit(page, path) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.getByText(/^(Caricamento risorse|Sincronizzazione dati|Inizializzazione frequenze audio)/).waitFor({ state: "hidden", timeout: 20000 });
}
async function widths(page, name) {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} horizontal overflow ${width}`);
    await page.screenshot({ path: `${out}${name}-${width}.png`, fullPage: true });
  }
}

let failure;
try {
  const page = await makeContext("student");
  await visit(page, "/academy");
  await page.getByRole("heading", { name: "Programma di formazione", exact: true }).waitFor();
  assert.equal(await page.locator("details.academy-module").count(), 8);
  assert.equal(await page.getByRole("link", { name: "Studio docente", exact: true }).count(), 0);
  await widths(page, "course");
  mark("8 modules, published lesson and outlines remain distinct; student has no teaching studio; 375/1440 fit");
  await page.getByRole("link", { name: "Apri lezione", exact: true }).click();
  await page.getByRole("heading", { name: "Lezione di verifica locale", exact: true }).waitFor();
  assert.equal(await page.locator("iframe.academy-player").getAttribute("src"), "https://www.youtube-nocookie.com/embed/abcdefghijk");
  const response = page.getByLabel("Il tuo esercizio", { exact: true });
  const answer = "Risposta di verifica: preparo calendario, contesto e condizioni di attesa.";
  await response.fill(answer);
  state.failProgress = true;
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Operazione non riuscita" }).waitFor();
  assert.equal(await response.inputValue(), answer);
  assert.equal(progress.size, 0);
  state.failProgress = false;
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Salvato" }).waitFor();
  assert.equal(progress.get(`student:${lessonId}`).exerciseResponse, answer);
  await page.reload({ waitUntil: "networkidle" });
  await response.waitFor();
  assert.equal(await response.inputValue(), answer);
  await page.getByRole("button", { name: "Invia al docente", exact: true }).click();
  await page.getByText("Esercizio inviato, in attesa di revisione.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Segna come completata", exact: true }).click();
  await page.getByRole("button", { name: "Segna da rivedere", exact: true }).waitFor();
  await widths(page, "lesson");
  mark("Video frame, retained draft after HTTP failure, successful save/reload, submission and completion work");

  const free = await makeContext("free");
  await visit(free, "/academy?tab=affiliate&ref=AC1234567890ABCDEF");
  const enroll = free.getByRole("button", { name: "Attiva affiliazione gratuita", exact: true });
  await enroll.waitFor();
  assert.equal(await enroll.isDisabled(), true);
  await free.getByText("Adesione gratuita. Nessun abbonamento richiesto. Un solo livello di commissioni.", { exact: true }).waitFor();
  await free.locator(".academy-affiliate input[type=checkbox]").check();
  await enroll.click();
  const link = free.getByLabel("Il tuo link personale", { exact: true });
  await link.waitFor();
  assert.equal(await link.inputValue(), `${base}/academy?ref=AC1234567890ABCDEF`);
  assert.equal(billing("free").active, false);
  assert.ok(requests.some(item => item.actor === "free" && item.path.endsWith("/affiliate/enroll") && item.body.acceptedTerms === true));
  await widths(free, "affiliate");
  await free.getByRole("link", { name: "Percorso", exact: true }).click();
  await free.getByText("Le iscrizioni non sono ancora aperte.", { exact: true }).waitFor();
  assert.equal(await free.getByRole("link", { name: "Apri lezione", exact: true }).count(), 0);
  assert.equal(await free.getByRole("button", { name: "Abbonati all’Academy", exact: true }).count(), 0);
  assert.equal(new URL(free.url()).searchParams.get("ref"), "AC1234567890ABCDEF");
  mark("Free account enrolls as affiliate only after accepting terms; personal link appears; closed checkout and paid lessons stay locked; referral preserved");

  const teacher = await makeContext("teacher");
  await visit(teacher, "/academy?tab=teacher");
  await teacher.getByRole("heading", { name: "Studio docente", exact: true }).waitFor();
  await teacher.getByRole("button", { name: "Nuova lezione", exact: true }).click();
  await teacher.getByLabel("Titolo", { exact: true }).fill("Nuova lezione di verifica locale");
  await teacher.getByLabel("Descrizione", { exact: true }).fill("Descrizione esclusivamente di test.");
  await teacher.getByLabel("Link video YouTube o Vimeo", { exact: true }).fill("https://vimeo.com/123456789");
  await teacher.getByLabel("Spiegazione e appunti", { exact: true }).fill("Appunti per la verifica locale.");
  await teacher.getByLabel("Consegna dell’esercizio", { exact: true }).fill("Rispondi usando il caso simulato.");
  state.failTeacherSave = true;
  await teacher.getByRole("button", { name: "Salva lezione", exact: true }).click();
  await teacher.locator(".academy-editor").getByRole("alert").waitFor();
  assert.equal(await teacher.getByLabel("Titolo", { exact: true }).inputValue(), "Nuova lezione di verifica locale");
  state.failTeacherSave = false;
  await teacher.getByRole("button", { name: "Salva lezione", exact: true }).click();
  await teacher.locator(".academy-editor").waitFor({ state: "hidden" });
  await teacher.getByText("Nuova lezione di verifica locale", { exact: true }).waitFor();
  const created = lessons.find(item => item.title === "Nuova lezione di verifica locale");
  assert.ok(created && !created.published);
  await teacher.locator(".academy-lessons li").filter({ hasText: "Nuova lezione di verifica locale" }).getByRole("button", { name: "Modifica", exact: true }).click();
  await teacher.getByLabel("Titolo", { exact: true }).fill("Lezione locale aggiornata");
  await teacher.getByRole("checkbox", { name: "Pubblica per gli iscritti", exact: true }).check();
  await teacher.getByRole("button", { name: "Salva lezione", exact: true }).click();
  await teacher.locator(".academy-editor").waitFor({ state: "hidden" });
  assert.equal(created.title, "Lezione locale aggiornata");
  assert.equal(created.published, true);
  const feedback = teacher.getByLabel("Feedback del docente", { exact: true });
  await feedback.fill("Feedback locale: esplicita meglio le condizioni di attesa.");
  state.failFeedback = true;
  await teacher.getByRole("button", { name: "Salva feedback", exact: true }).click();
  await teacher.locator(".academy-submission").getByRole("alert").waitFor();
  assert.match(await feedback.inputValue(), /Feedback locale/);
  state.failFeedback = false;
  await teacher.getByRole("button", { name: "Salva feedback", exact: true }).click();
  await teacher.locator(".academy-submission").getByRole("status").filter({ hasText: "Salvato" }).waitFor();
  const feedbackRequest = requests.filter(item => item.path.includes("/teacher/submissions/")).at(-1);
  assert.equal(feedbackRequest.body.submittedAt, now);
  assert.equal(progress.get(`student:${lessonId}`).reviewedAt, now);
  await widths(teacher, "teacher");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Feedback locale: esplicita meglio le condizioni di attesa.", { exact: true }).waitFor();
  mark("Teacher draft/create/edit/publish, retained fields after save failure, versioned feedback and student feedback view work");
  assert.deepEqual(errors, [], "Unhandled browser errors");
} catch (error) {
  failure = error;
  console.error(error);
  for (const [index, context] of contexts.entries()) for (const page of context.pages()) {
    await page.screenshot({ path: `${out}failure-${index}.png`, fullPage: true }).catch(() => {});
    await writeFile(`${out}failure-${index}.txt`, await page.locator("body").innerText().catch(() => "")).catch(() => {});
  }
} finally {
  await writeFile(out + "browser-report.json", JSON.stringify({ checks, errors, failure: failure?.message ?? null, requests, blockedExternal: [...blockedExternal] }, null, 2));
  await browser.close();
  await vite.close();
}
if (failure) throw failure;
console.log(`Academy browser checks passed (${checks.length}); screenshots and report: ${out}`);
