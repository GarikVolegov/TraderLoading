import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createFixtures } from "../verify-operating-center/fixtures.mjs";
import { ACADEMY_MODULES, ACADEMY_SYLLABUS } from "../../contracts/academy.ts";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(root + "artifacts/trader-dashboard/package.json");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const out = root + "artifacts.local/limen-launch/"; await mkdir(out, { recursive: true });
process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=";
const port = 5193; process.env.PORT = String(port); const base = `http://127.0.0.1:${port}`;
const vite = await createServer({ cacheDir: root + ".local-logs/limen-launch-vite", configFile: root + "artifacts/trader-dashboard/vite.config.ts", server: { host: "127.0.0.1", port, strictPort: true }, resolve: { alias: [{ find: "@clerk/react", replacement: fileURLToPath(new URL("../verify-academy/clerk-fixture.js", import.meta.url)) }] } });
await vite.listen(); const browser = await chromium.launch({ headless: true, executablePath: require("puppeteer").executablePath() });
const errors = [], requests = [], checks = [];
const now = new Date().toISOString();
const lessons = ["book", "chapter0", "lesson1", "lesson2"].map((slot, i) => ({ id: `aa000000-0000-4000-8000-00000000000${i + 1}`, title: ["Introduzione LIMEN", "Capitolo 0", "Preparare la sessione", "Rivedere la sessione"][i], moduleId: "preparazione", syllabusId: null, description: "Contenuto di verifica locale", orderIndex: i, publishedAt: now, accessLevel: "free", contentKind: i ? "lesson" : "book", introductionSlot: slot, published: true, bodyMarkdown: "Testo di verifica della Biblioteca LIMEN.", exercisePrompt: "Documenta la tua sessione simulata.", videoUrl: null, videoEmbedUrl: null, streamVideoId: null, createdAt: now, updatedAt: now }));
const metadata = ({ videoUrl, videoEmbedUrl, streamVideoId, bodyMarkdown, exercisePrompt, published, createdAt, updatedAt, ...rest }) => rest;
const state = { candidateFailure: true, schoolFailure: true, uploadOffset: 0, uploadFailure: true, ready: false, teacherSave: null };
const progress = new Map();
async function context(actor) {
 const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
 const fixtures = createFixtures();
 await ctx.addInitScript(({ actor }) => { localStorage.setItem("academy_fixture_actor", actor); localStorage.setItem("tl_language", "it"); localStorage.setItem("tl_lang_manual", "1"); localStorage.setItem("tl_cookie_consent_v1", "declined"); }, { actor });
 await ctx.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url());
  const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.hostname === "upload.videodelivery.net") {
    const cors = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Methods": "HEAD,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Tus-Resumable,Upload-Offset,Content-Type", "Access-Control-Expose-Headers": "Upload-Offset,Tus-Resumable" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "Upload-Offset": String(state.uploadOffset), "Tus-Resumable": "1.0.0" } });
    if (state.uploadFailure) return route.fulfill({ status: 503, headers: cors, body: "test outage" });
    state.uploadOffset += req.postDataBuffer().length; state.ready = true;
    return route.fulfill({ status: 204, headers: { ...cors, "Upload-Offset": String(state.uploadOffset), "Tus-Resumable": "1.0.0" } });
  }
  if (url.hostname.endsWith("cloudflarestream.com")) return route.fulfill({ contentType: "text/html", body: "<html><body>Anteprima locale</body></html>" });
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  const path = url.pathname.slice(4), method = req.method(); let body = null; try { body = req.postDataJSON(); } catch { /* ignore non-JSON bodies */ }
  requests.push({ path, method, body });
  if (path === "/candidate-applications") return state.candidateFailure ? reply({ error: "Invio di prova non riuscito" }, 503) : reply({ candidate: { candidateCode: "TL-PERSISTED-TEST", status: "in_valutazione" } }, 201);
  if (path === "/school-requests") return state.schoolFailure ? reply({ error: "Richiesta di prova non riuscita" }, 503) : reply({ ok: true }, 201);
  if (path === "/billing/me") return reply({ pro: false, plan: "free", status: "free", checkoutAvailable: false });
  if (path === "/academy/billing") return reply({ active: false, status: "none", currentPeriodEnd: null, salesEnabled: false, checkoutAvailable: false, price: { amountCents: 15000, currency: "eur", interval: "month" } });
  if (path === "/academy/catalog") return reply({ modules: ACADEMY_MODULES, syllabus: ACADEMY_SYLLABUS, lessons: lessons.map(metadata), access: { hasAccess: actor === "teacher", isTeacher: actor === "teacher" }, progress: [...progress.values()] });
  if (path === "/academy/teacher/lessons" && method === "GET") return reply(lessons);
  if (path === "/academy/teacher/submissions") return reply([]);
  if (path === "/academy/affiliate/payouts") return reply({ items: [] });
  if (path === "/academy/videos/upload") return reply({ id: "a".repeat(32), uploadUrl: "https://upload.videodelivery.net/test" });
  if (path.startsWith("/academy/videos/")) return reply({ state: state.ready ? "ready" : "processing", url: "https://customer-test.cloudflarestream.com/signed/iframe" });
  if (path.startsWith("/academy/teacher/lessons/") && method === "PATCH") { state.teacherSave = body; return reply({ ...lessons[1], ...body }); }
  if (path.startsWith("/academy/lessons/")) {
   const id = path.split("/")[3], lesson = lessons.find(item => item.id === id);
   if (method === "PUT") { const saved = { id: "progress", lessonId: id, exerciseResponse: body.exerciseResponse ?? "", completedAt: body.completed ? now : null, submittedAt: null, feedback: "", reviewedAt: null, updatedAt: now }; progress.set(id, saved); return reply(saved); }
   return lesson ? reply({ lesson, progress: progress.get(id) ?? null }) : reply({ error: "missing" }, 404);
  }
  return fixtures.handle(route);
 });
 await ctx.routeWebSocket("**/api/**", ws => ws.close());
 const page = await ctx.newPage(); page.setDefaultTimeout(20000); page.on("pageerror", e => errors.push(e.message)); return page;
}
async function widths(page, name) { for (const width of [375, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow ${name} ${width}`); await page.screenshot({ path: `${out}${name}-${width}.png`, fullPage: true }); } }
let failure;
try {
 const page = await context("visitor"); await page.goto(base + "/it", { waitUntil: "networkidle" });
 await page.getByRole("heading", { name: /Il metodo prende forma/ }).waitFor();
 await widths(page, "landing");
 assert.equal(await page.getByRole("link", { name: "Accedi al percorso gratuito", exact: true }).first().getAttribute("href"), "/sign-up?academy=1");
 await page.getByRole("button", { name: "Candidati al Protocollo", exact: true }).click();
 const dialog = page.getByRole("dialog");
 await dialog.getByLabel("Nome", { exact: true }).fill("Trader Test"); await dialog.getByLabel("Email dell’account LIMEN").fill("trader@example.test"); await dialog.getByLabel("Numero o nome utente").fill("@trader"); await dialog.getByLabel("La tua esperienza attuale").fill("Studio e pratico in simulazione"); await dialog.getByLabel("Cosa vuoi migliorare?").fill("Documentare le decisioni"); await dialog.getByRole("checkbox").check();
 await dialog.getByRole("button", { name: "Invia la candidatura", exact: true }).click(); await dialog.getByRole("alert").waitFor();
 assert.equal(await dialog.getByLabel("Nome", { exact: true }).inputValue(), "Trader Test");
 assert.equal(await dialog.getByText("Candidatura ricevuta", { exact: true }).count(), 0);
 state.candidateFailure = false; await dialog.getByRole("button", { name: "Invia la candidatura", exact: true }).click(); await dialog.getByText("TL-PERSISTED-TEST", { exact: true }).waitFor();
 const candidateRequests = requests.filter(r => r.path === "/candidate-applications"); assert.equal(candidateRequests[0].body.requestKey, candidateRequests[1].body.requestKey);
 await page.keyboard.press("Escape");
 const school = page.locator(".launch-school-form");
 for (const [label, value] of [["Scuola o community", "Scuola Test"], ["Referente", "Docente Test"], ["Email di contatto", "school@example.test"], ["Iscritti attuali", "100"], ["Nuovi ingressi al mese", "10"], ["Come vorresti usare LIMEN?", "Caricare formazione e usare il journal"]]) await school.getByLabel(label, { exact: true }).fill(value);
 await school.getByRole("button", { name: "Richiedi una proposta" }).click(); await school.getByRole("alert").waitFor(); state.schoolFailure = false;
 await school.getByRole("button", { name: "Richiedi una proposta" }).click(); await page.getByRole("heading", { name: "Richiesta ricevuta." }).waitFor();
 checks.push("landing at 375/768/1440, free destination, recoverable application and school forms, persistent request key");
 const free = await context("free"); await free.goto(base + "/academy?tab=introduction", { waitUntil: "networkidle" }); await free.getByRole("heading", { name: "Il tuo primo percorso, gratuito" }).waitFor(); await widths(free, "introduction");
 assert.equal(await free.getByRole("link", { name: "Studio docente", exact: true }).count(), 0);
 await free.locator(".limen-persistent-lessons").getByRole("link", { name: "Apri", exact: true }).first().click(); await free.getByRole("heading", { name: "Introduzione LIMEN", exact: true }).waitFor(); await free.getByLabel("Il tuo esercizio", { exact: true }).fill("Esercizio gratuito salvato"); await free.getByRole("button", { name: "Salva bozza", exact: true }).click(); await free.getByRole("status").filter({ hasText: "Salvato" }).waitFor(); assert.equal(await free.getByRole("button", { name: "Invia al docente", exact: true }).isDisabled(), true);
 checks.push("free catalog, reading, saved exercise and paid-only feedback");
 const teacher = await context("teacher"); await teacher.goto(base + "/academy?tab=teacher", { waitUntil: "networkidle" });
 await teacher.getByRole("button", { name: "Modifica", exact: true }).nth(1).click();
 await teacher.locator('input[type="file"]').setInputFiles({ name: "lesson.mp4", mimeType: "video/mp4", buffer: Buffer.from("local-video-test") });
 await teacher.getByRole("button", { name: "Carica video", exact: true }).click(); await teacher.getByRole("alert").filter({ hasText: /Caricamento interrotto/ }).waitFor();
 state.uploadFailure = false; await teacher.getByRole("button", { name: "Riprendi caricamento", exact: true }).click(); await teacher.getByRole("button", { name: "Conferma questo video", exact: true }).waitFor();
 await teacher.getByRole("button", { name: "Conferma questo video", exact: true }).click(); await teacher.getByRole("button", { name: "Salva lezione", exact: true }).click(); await teacher.locator(".academy-editor").waitFor({ state: "hidden" }); assert.equal(state.teacherSave.streamVideoId, "a".repeat(32));
 await widths(teacher, "teacher"); checks.push("owner studio, interrupted/resumed upload, processing preview and confirmed replacement");
 assert.deepEqual(errors, []);
} catch (error) { failure = error; console.error(error); for (const ctx of browser.contexts()) for (const [i, page] of ctx.pages().entries()) { await page.screenshot({ path: `${out}failure-${i}.png`, fullPage: true }).catch(() => {}); await writeFile(`${out}failure-${i}.txt`, await page.locator("body").innerText().catch(() => "")); } }
finally { await writeFile(out + "browser-report.json", JSON.stringify({ checks, errors, failure: failure?.message ?? null }, null, 2)); await browser.close(); await vite.close(); }
if (failure) throw failure;
console.log("PASS LIMEN browser:", checks.join("; "));
