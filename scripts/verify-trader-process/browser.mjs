import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createFixtures } from "../verify-operating-center/fixtures.mjs";
import { WORKSPACE_TOOLS } from "../../artifacts/trader-dashboard/src/lib/workspaceTools.ts";

/** Real UI and process/journal handlers; every write goes to the disposable database. */
export async function verifyProcessBrowser({ port, pool, today, prior }) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(root + "artifacts/trader-dashboard/package.json");
  const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
  process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=";
  process.env.PORT = "5189";
  const server = await createServer({
    cacheDir: root + ".local-logs/trader-process-vite",
    configFile: root + "artifacts/trader-dashboard/vite.config.ts",
    server: { host: "127.0.0.1", port: 5189, strictPort: true },
    resolve: { alias: [{ find: "@clerk/react", replacement: fileURLToPath(new URL("./clerk-fixture.js", import.meta.url)) }] },
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: require("puppeteer").executablePath() });
  const out = root + "artifacts.local/trader-process/";
  await mkdir(out, { recursive: true });
  const checks = [], errors = [], toolAudit = [], contexts = [];
  const mark = name => { checks.push(name); console.log("PASS browser", name); };
  const user = "audit-guided-v2";
  const base = "http://127.0.0.1:5189";
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(`http://127.0.0.1:${port}/api/${path}`, {
      method, headers: { "x-fixture-user": user, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
  const makeContext = async (width = 1440, legacy = true, fixtureUser = user) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: "it-IT", timezoneId: "Europe/Rome", reducedMotion: "reduce" });
    contexts.push(context);
    const fixtures = createFixtures();
    fixtures.state.contextMode = "available";
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname === "s.tradingview.com") return route.fulfill({contentType:"text/html", body:"<html><body style=\"background:#090f18;color:#779ab5\">Isolated chart fixture</body></html>"});
      if (url.hostname !== "127.0.0.1") return route.abort();
      if (["/api/process", "/api/journal", "/api/market-decisions"].some(prefix => url.pathname.startsWith(prefix))) {
        const response = await route.fetch({ maxRetries: 2, url: `http://127.0.0.1:${port}${url.pathname}${url.search}`, headers: { ...route.request().headers(), "x-fixture-user": fixtureUser } });
        return route.fulfill({ response });
      }
      if (url.pathname === "/api/billing/me") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pro: false, plan: "free", status: "active", checkoutAvailable: false }) });
      if (url.pathname.startsWith("/api/")) return fixtures.handle(route);
      return route.continue();
    });
    await context.routeWebSocket("**/api/**", ws => ws.close());
    await context.addInitScript(() => { localStorage.setItem("tl_language", "it"); localStorage.setItem("tl_cookie_consent_v1", "declined"); });
    if (legacy) await context.addInitScript(() => { if (location.pathname === "/") { const url = new URL(location.href); url.searchParams.set("process", "legacy"); history.replaceState(null, "", url); } });
    return context;
  };
  let page;
  const ready = async () => {
    await page.getByText(/^(Caricamento risorse|Sincronizzazione dati|Inizializzazione frequenze audio)/).waitFor({ state: "hidden", timeout: 20000 });
    await page.locator("body").waitFor();
  };
  const visit = async path => { await page.goto(base + path, { waitUntil: "networkidle" }); await ready(); };
  const label = name => page.getByLabel(name, { exact: true });
  const button = name => page.getByRole("button", { name, exact: true });
  const draftSaved = () => page.getByRole("status").filter({ hasText: "Bozza salvata. Il passaggio richiede ancora la tua conferma." }).waitFor();
  const widths = async name => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow at ${width}`);
      await page.screenshot({ path: `${out}${name}-${width}.png`, fullPage: true });
    }
  };
  try {
    const cockpitUser = "audit-cockpit-v32";
    const cockpitContext = await makeContext(1440, false, cockpitUser);
    const cockpitPage = await cockpitContext.newPage();
    page = cockpitPage;
    cockpitPage.on("pageerror", e => errors.push(e.message));
    await cockpitPage.goto(base + "/", {waitUntil:"networkidle"});
    await cockpitPage.getByTestId("trading-cockpit").waitFor();
    await cockpitPage.getByRole("navigation", {name:"Navigazione cockpit"}).getByRole("link", {name:"Backtest",exact:true}).waitFor();
    for (const name of ["Classifica","Tornei","Diario"]) await cockpitPage.getByRole("navigation",{name:"Navigazione cockpit"}).getByRole("link",{name,exact:true}).waitFor();
    for (const width of [375,768,1440]) {
      await cockpitPage.setViewportSize({width,height:900});
      assert.equal(await cockpitPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await cockpitPage.screenshot({path:out+`cockpit-${width}.png`,fullPage:true});
    }
    await cockpitPage.setViewportSize({width:1440,height:1000});
    await cockpitPage.getByLabel("Mercato",{exact:true}).selectOption("EURUSD");
    await cockpitPage.getByRole("button",{name:"Protezione e impostazioni",exact:true}).click();
    await cockpitPage.getByLabel("Valuta",{exact:true}).selectOption("EUR");
    await cockpitPage.getByLabel("Rischio massimo per trade",{exact:true}).fill("50");
    await cockpitPage.getByLabel("Perdita massima giornaliera",{exact:true}).fill("150");
    await cockpitPage.getByLabel("Numero massimo di trade",{exact:true}).fill("3");
    await cockpitPage.getByRole("checkbox",{name:"Ho letto il protocollo e confermo personalmente questi limiti",exact:true}).check();
    await cockpitPage.getByRole("button",{name:"Conferma protezione e attiva il cockpit",exact:true}).click();
    await cockpitPage.getByRole("dialog").waitFor({state:"hidden"});
    await cockpitPage.getByLabel("Dove ci troviamo nel ciclo HTF?",{exact:true}).selectOption("up");
    await cockpitPage.getByRole("button",{name:/^Liquidity swept/}).click();
    await cockpitPage.getByRole("button",{name:"Leggi la zona a sinistra",exact:true}).click();
    await cockpitPage.getByRole("button",{name:/^Solo liquidità/}).click();
    await cockpitPage.getByRole("checkbox",{name:"Ciclo M15 chiuso e schematica confermata",exact:true}).check();
    await cockpitPage.getByRole("checkbox",{name:"Schematica d’ingresso M1 valida",exact:true}).check();
    assert.equal(await cockpitPage.getByRole("button",{name:"TEST",exact:true}).isDisabled(),true);
    assert.equal(await cockpitPage.getByRole("button",{name:"POC",exact:true}).isDisabled(),true);
    await cockpitPage.getByRole("button",{name:"JTC",exact:true}).click();
    await cockpitPage.getByRole("button",{name:"Storico presente",exact:true}).click();
    await cockpitPage.getByLabel("Pool di liquidità opposto / target",{exact:true}).fill("Asian high · synthetic fixture");
    await cockpitPage.getByRole("checkbox",{name:"Pool opposto identificato e validato",exact:true}).check();
    await cockpitPage.getByLabel("Controllo news",{exact:true}).selectOption("clear");
    await cockpitPage.getByRole("status").filter({hasText:"Bozza salvata."}).waitFor();
    const resumeContext=await makeContext(375,false,cockpitUser);
    const resumePage=await resumeContext.newPage();
    await resumePage.goto(base+"/",{waitUntil:"networkidle"});
    await resumePage.getByLabel("Pool di liquidità opposto / target",{exact:true}).waitFor();
    assert.equal(await resumePage.getByLabel("Pool di liquidità opposto / target",{exact:true}).inputValue(),"Asian high · synthetic fixture");
    assert.equal(await resumePage.getByRole("button",{name:"JTC",exact:true}).getAttribute("aria-pressed"),"true");
    await resumeContext.close();
    mark("Cockpit replaces the generic home; real server draft resumes across devices; no-zone blocks reversal triggers; layouts fit 375/768/1440");
    const storedDraft=(await pool.query("SELECT id,revision,draft FROM process_sessions WHERE user_id=$1",[cockpitUser])).rows[0];
    const rejectedPlan=await fetch(`http://127.0.0.1:${port}/api/process/sessions/${storedDraft.id}`,{method:"PATCH",headers:{"x-fixture-user":cockpitUser,"content-type":"application/json"},body:JSON.stringify({action:"check_in",expectedRevision:storedDraft.revision,preparation:{checklist:[true,true,true],mood:"",focus:""},plan:{decision:"trade",market:"EURUSD",setup:"TEST",entry:"Synthetic",stop:"Synthetic",initialRisk:10,invalidation:"Synthetic",guidance:{expectation:"Synthetic",invalidation:"Synthetic",response:"wait",cockpit:{...storedDraft.draft.cockpit,scenario:"no_zone",trigger:"TEST"}}}})});
    assert.equal(rejectedPlan.status,400,"server rejects reversal triggers in liquidity-only scenarios even when the client is bypassed");
    assert.equal((await pool.query("SELECT prepared_at FROM process_sessions WHERE id=$1",[storedDraft.id])).rows[0].prepared_at,null);

    await cockpitPage.getByRole("button",{name:"Scenario, rischio e conferma",exact:true}).click();
    await cockpitPage.getByRole("button",{name:"Oggi attendo",exact:true}).click();
    await cockpitPage.getByLabel("Perché attendo?",{exact:true}).fill("Nessuna schematica utile, attesa documentata.");
    await cockpitPage.getByLabel("Cosa invalida l’aspettativa?",{exact:true}).fill("Cambio del contesto HTF.");
    await cockpitPage.getByLabel("Se accade, come ti comporti?",{exact:true}).selectOption("reassess");
    for (const name of ["Contesto HTF e liquidità valutati","Schematica, trigger e attesa verificati","Calendario e limiti personali di rischio verificati"]) await cockpitPage.getByRole("checkbox",{name,exact:true}).check();
    await cockpitPage.getByRole("button",{name:"Conferma il piano e documenta la sessione",exact:true}).click();
    await cockpitPage.getByRole("button",{name:"Chiudi con il consuntivo",exact:true}).waitFor();
    await cockpitPage.getByRole("button",{name:"Chiudi con il consuntivo",exact:true}).click();
    assert.equal(await cockpitPage.getByLabel("Come hai seguito il piano?",{exact:true}).inputValue(),"");
    await cockpitPage.getByLabel("L’aspettativa si è verificata?",{exact:true}).selectOption("unassessable");
    await cockpitPage.getByLabel("Come hai seguito il piano?",{exact:true}).selectOption("unknown");
    await cockpitPage.getByLabel("Una correzione per la prossima sessione (facoltativa)",{exact:true}).fill("Rivedere i pool HTF prima del trigger.");
    await cockpitPage.getByRole("checkbox",{name:"Ho verificato operazioni ed esiti collegati",exact:true}).check();
    await cockpitPage.getByRole("button",{name:"Conferma esiti e chiudi",exact:true}).click();
    await cockpitPage.getByText("Sessione conclusa e conservata nel diario.",{exact:true}).waitFor();
    const cockpitRecord=(await pool.query("SELECT plan,closure,mode FROM process_sessions WHERE user_id=$1",[cockpitUser])).rows[0];
    assert.equal(cockpitRecord.plan.guidance.cockpit.target,"Asian high · synthetic fixture");
    assert.equal(cockpitRecord.closure.noTrades,true);
    assert.equal(cockpitRecord.closure.assessment,"unknown");
    assert.equal(cockpitRecord.mode,"practice");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM journal_entries WHERE user_id=$1",[cockpitUser])).rows[0].n,0);
    mark("Cockpit waiting and post-trade review persist with structured analysis, personal limits and no fabricated journal trades");
    await cockpitContext.close();
    const context = await makeContext();
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    await visit("/");
    await label("Setup").waitFor();
    assert.equal(await page.locator(".process-scene").count(), 0);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal((await api("process")).session, null);
    const nav = page.locator("nav[aria-label]").filter({ has: page.getByRole("link", { name: "Metodo", exact: true }) }).filter({ visible: true });
    // The two responsive navs share semantics; visibility selects the current one.
    assert.equal(await nav.getByRole("link", { name: /^(Oggi|Metodo|Diario)$/ }).count(), 3);
    await button("Altro").filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Risorse", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await widths("definition");
    mark("First use starts with the personal method; three primary destinations and one secondary menu, without audio autoplay or a decorative scene");

    await label("Mercati (separati da virgole)").fill("EURUSD");
    const rules = { "Finestre operative": "09–11 Europe/Rome (synthetic)", "Setup": "Synthetic level test", "Condizioni d’ingresso": "Observable confirmation", "Regole d’uscita": "Predefined exit", "Invalidazione": "Contrary close", "Quando aspettare": "No confirmation or event" };
    for (const [name, value] of Object.entries(rules)) await label(name).fill(value);
    await button("Continua").click();
    await label("Valuta degli importi (ISO, es. EUR)").fill("EUR");
    await label("Rischio massimo per trade").fill("10");
    await label("Perdita massima giornaliera").fill("100");
    await label("Numero massimo di trade al giorno").fill("3");
    await label("Criteri da confermare prima di operare (uno per riga)").fill("Setup conforme\nRischio controllato");
    await page.getByRole("status").filter({ hasText: "Bozza del metodo salvata." }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await label("Rischio massimo per trade").inputValue(), "10");
    assert.equal(await page.getByRole("checkbox").isChecked(), false);
    await page.getByRole("checkbox").check();
    await button("Salva il metodo").click();
    await label("Inizio del test").waitFor();
    assert.equal((await api("process")).activeMethod.protocol, null);
    mark("Method drafts survive reload and require fresh personal risk confirmation; protocol appears only after saving the rules");

    const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 3);
    for (const [name, value] of Object.entries({ "Inizio del test": today, "Fine del test": end.toISOString().slice(0, 10), "Campione minimo di validazione": "2", "Giorni di osservazione in Applica": "100", "Aspettativa netta minima (R)": "0", "Drawdown massimo (R)": "3", "Aderenza documentata minima (%)": "100" })) await label(name).fill(value);
    await button("Conferma protocollo e avvia verifica").click();
    await page.getByRole("link", { name: "Registra un risultato di test", exact: true }).waitFor();
    const method = (await api("process")).activeMethod;
    await page.getByRole("link", { name: "Registra un risultato di test", exact: true }).click();
    await label("Ambiente di esecuzione").selectOption("simulation");
    await label("Rischio monetario iniziale").fill("10");
    await label("Risultato monetario netto").fill("15");
    await label("Conto / campione di test").fill("Synthetic usability sample");
    await label("Costi").selectOption("included");
    await button("Salva l’evidenza").click();
    await page.getByRole("heading", { name: /Il mio metodo · Versione 1/ }).waitFor();
    const evidenceState = await api("process");
    assert.equal(evidenceState.progress.report.eligibleSamples, 1, "Immediate unchanged default timestamp must follow protocol start, including milliseconds");
    assert.equal(evidenceState.evidence[0].executionEnvironment, "simulation");
    mark("Verification requires an explicit environment and counts an immediately recorded complete simulated result without timestamp truncation");

    await visit("/");
    await button("Simulazione facoltativa").click();
    await page.getByRole("checkbox").first().waitFor();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await button("Leggi il pair").click();
    await page.locator('.session-pair-context[aria-busy="false"]').waitFor();
    assert.equal(await page.locator(".intelligence-probability").count(), 0);
    await draftSaved();
    assert.equal((await api("process")).session.mode, "validation");
    await widths("context");
    await page.locator("summary").filter({ hasText: "Strumenti del metodo" }).click();
    await page.getByRole("link", { name: "Calendario economico", exact: true }).click();
    await ready();
    assert.equal(new URL(page.url()).searchParams.get("processReturn"), "1");
    assert.equal(new URL(page.url()).searchParams.get("pair"), "EURUSD");
    assert.equal(await page.locator('[role="tablist"]').count(), 0, "Single tool must not open a competing workspace tab strip");
    await page.getByRole("link", { name: "Riprendi il lavoro in Oggi", exact: true }).click();
    await button("Definisci lo scenario").waitFor();
    assert.equal((await api("process")).session.preparedAt, null);
    assert.equal((await api("process")).session.draft.step, 1);
    mark("Selected context tools save before navigation and return to the same pair and unconfirmed draft, without competing tabs");

    await button("Definisci lo scenario").click();
    await label("Cosa ti aspetti da questo pair?").fill("Wait for a level confirmation (synthetic)");
    await label("Cosa invaliderebbe la tua aspettativa?").fill("A contrary close (synthetic)");
    await page.getByRole("radio", { name: "Attendo", exact: true }).check();
    await page.getByRole("radio", { name: "Oggi resto fuori", exact: true }).check();
    await page.getByRole("radio", { name: "Setup assente", exact: true }).check();
    await draftSaved();
    const second = await makeContext(375);
    const secondPage = await second.newPage();
    await secondPage.goto(base + "/", { waitUntil: "networkidle" });
    assert.equal(await secondPage.getByLabel("Cosa ti aspetti da questo pair?", { exact: true }).inputValue(), "Wait for a level confirmation (synthetic)");
    await second.close();
    await button("Conferma e inizia").click();
    await page.getByRole("heading", { name: "Operatività", exact: true }).waitFor();
    await button("Chiudi la sessione").click();
    assert.equal(await page.getByRole("group", { name: "Come è andata rispetto all’aspettativa?", exact: true }).locator("input:checked").count(), 0);
    await page.getByRole("radio", { name: "Non valutabile", exact: true }).check();
    await page.getByRole("radio", { name: "Piano rispettato", exact: true }).check();
    await label("Una correzione per la prossima sessione (facoltativa)").fill("Wait for the close before deciding");
    await button("Conferma esiti e chiudi").click();
    await page.getByRole("link", { name: "Registra un risultato di test", exact: true }).waitFor();
    const closed = (await api("process")).session;
    assert.equal(closed.state, "closed");
    assert.equal(closed.closure.noTrades, true);
    assert.equal((await api("process")).progress.report.eligibleSamples, 1);
    await visit(`/journal?t=sessioni&session=${closed.id}`);
    await page.locator(".session-journal-card").waitFor();
    assert.equal(await page.locator(".session-journal-card").count(), 1);
    await page.getByText("Wait for the close before deciding", { exact: true }).waitFor();
    mark("Scenario drafts resume on a second device; a no-trade decision closes one diary card and creates no economic evidence");

    // Continue the real daily UI with an already qualified synthetic method.
    await pool.query("UPDATE process_sessions SET day=$2 WHERE id=$1", [closed.id, prior]);
    await pool.query("UPDATE process_methods SET phase='apply',application_started_at=now(),phase_started_at=now() WHERE id=$1", [method.id]);
    await visit("/");
    await page.getByRole("checkbox").first().waitFor();
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await button("Leggi il pair").click();
    await page.locator('.session-pair-context[aria-busy="false"]').waitFor();
    await button("Definisci lo scenario").click();
    await label("Cosa ti aspetti da questo pair?").fill("No qualified opportunity (synthetic)");
    await label("Cosa invaliderebbe la tua aspettativa?").fill("A new qualified confirmation");
    await page.getByRole("radio", { name: "Attendo", exact: true }).check();
    await page.getByRole("radio", { name: "Oggi resto fuori", exact: true }).check();
    await page.getByRole("radio", { name: "Setup assente", exact: true }).check();
    await button("Conferma e inizia").click();
    await button("Chiudi la sessione").click();
    await page.getByRole("radio", { name: "Non valutabile", exact: true }).check();
    await page.getByRole("radio", { name: "Piano rispettato", exact: true }).check();
    await button("Conferma esiti e chiudi").click();
    await page.getByRole("heading", { name: "Sessione completata", exact: true }).waitFor();
    assert.equal((await api("process")).guidance.action, "done");
    assert.equal(await button("Conferma e inizia").count(), 0);
    await widths("day-complete");
    mark("A closed application day has an explicit completion and diary link, without reopening preparation");

    const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - 14);
    await pool.query("UPDATE process_methods SET application_started_at=$2,phase_started_at=$2,review_policy_started_at=$2,protocol=jsonb_set(protocol,'{minAdherencePct}','0'::jsonb) WHERE id=$1", [method.id, start.toISOString()]);
    for (const n of [0, 1]) {
      const at = new Date(start); at.setUTCDate(at.getUTCDate() + n);
      await api("process/evidence", { requestId: randomUUID(), methodVersionId: method.id, purpose: "live", source: "manual", executionEnvironment: "real", initialRisk: 10, netPnl: -20, costsStatus: "included", currency: "EUR", account: "synthetic-real", observedAt: at.toISOString(), adherence: "unknown", provenance: "declared" });
    }
    await visit("/");
    await label("Cosa confermano questi dati?").fill("The synthetic drawdown exceeds the personal protocol");
    await label("Una sola azione per il prossimo periodo").fill("Retest a revised rule before applying");
    await label("Come verificherai che ha funzionato?").fill("Document all qualified simulated entries");
    await widths("period-review");
    await button("Conferma revisione e miglioramento").click();
    await page.getByRole("link", { name: "Torna alla verifica", exact: true }).waitFor();
    const held = await api("process");
    assert.equal(held.guidance.applicationHold, true);
    assert.equal(held.activeMethod.phase, "apply");
    assert.equal(held.reviews[0].decision, "reverify");
    await visit("/journal?t=revisione");
    await page.getByText("The synthetic drawdown exceeds the personal protocol", { exact: true }).waitFor({ state: "attached" });
    mark("A recoverable review persists one improvement and suspends a deteriorated version without rewriting its historical phase");

    // Walk every entry with finished loading, instead of judging destinations from the catalog alone.
    for (const tool of WORKSPACE_TOOLS) {
      await visit(tool.href);
      const body = await page.locator("body").innerText();
      assert.ok(body.length > 60, `Empty tool ${tool.id}`);
      assert.doesNotMatch(body, /Application error|Unexpected Application Error/);
      toolAudit.push({ id: tool.id, group: tool.group, href: tool.href, headings: await page.locator("h1,h2").allTextContents(), excerpt: body.slice(-1000), externalSources: "fixture; not a live integration verification" });
    }
    await visit("/resources");
    await label("Cerca uno strumento o un’attività").fill("calcolatore");
    await page.getByRole("link", { name: /Calcolatore/ }).waitFor();
    await widths("resources");
    assert.equal(await page.getByRole("button", { name: "Attiva audio focus", exact: true }).count(), 1);
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => document.activeElement && document.activeElement !== document.body));
    mark(`${WORKSPACE_TOOLS.length} catalog destinations remain reachable; search, responsive layout, keyboard focus and manual-only audio are verified`);
    assert.deepEqual(errors, []);
    await writeFile(out + "tool-audit.json", JSON.stringify(toolAudit, null, 2));
    await writeFile(out + "browser.json", JSON.stringify({ checks, errors, auth: "Clerk alias; actual process/journal handlers; disposable database; auxiliary APIs mocked", timingScope: "Automated browser exercise, not a human profitability or speed study" }, null, 2));
    return checks.length;
  } catch (error) {
    console.error("Browser diagnostics", JSON.stringify(errors));
    if (page && !page.isClosed()) {
      console.error((await page.locator("body").innerText()).slice(-7000));
      await page.screenshot({ path: out + "failure.png", fullPage: true }).catch(() => undefined);
    }
    throw error;
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => undefined)));
    await browser.close();
    await server.close();
  }
}
