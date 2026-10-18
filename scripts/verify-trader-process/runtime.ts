import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { Server } from "node:http";
import { processDay } from "../../contracts/trader-process.js";

const require = createRequire(new URL("../package.json", import.meta.url));
const { Client } = require("pg") as typeof import("pg");
// This fixture connection is the existing local development PostgreSQL launcher.
// Only schema is read from the source database; every write targets the new database.
const origin =
  process.env.PROCESS_AUDIT_DATABASE_URL ??
  "postgres://trader:trader@127.0.0.1:55432/traderloadings";
const original = new URL(origin);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(original.hostname));
const name = `tl_process_${Date.now()}`;
const admin = new Client({ connectionString: origin });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
const target = new URL(original);
target.pathname = `/${name}`;
process.env.DATABASE_URL = target.toString();
const bin =
  process.env.AUDIT_PG_BIN ?? "/Users/gazz/Applications/Postgres.app/Contents/Versions/16/bin";
const dump = spawnSync(
  `${bin}/pg_dump`,
  ["--dbname", origin, "--schema-only", "--no-owner", "--no-privileges"],
  { encoding: "utf8" },
);
let server: Server | undefined, closeDb: (() => Promise<void>) | undefined;
const checks: string[] = [];
const check = (name: string) => {
  checks.push(name);
  console.log("PASS", name);
};
try {
  if (dump.status !== 0)
    throw new Error("Cannot read the local schema for the disposable database");
  const restore = spawnSync(
    `${bin}/psql`,
    ["--dbname", target.toString(), "-v", "ON_ERROR_STOP=1"],
    { input: dump.stdout, encoding: "utf8" },
  );
  if (restore.status !== 0) throw new Error(restore.stderr);
  const { pool, closeDbPool } = await import("../../lib/db/src/index.js");
  closeDb = closeDbPool;
  if (!(await pool.query("SELECT to_regclass('market_decisions') AS table")).rows[0].table)
    await pool.query(
      await readFile(
        new URL("../../lib/db/drizzle/0036_market_intelligence.sql", import.meta.url),
        "utf8",
      ),
    );
  for (const migration of [
    "0037_trader_process.sql",
    "0038_backtest_economics.sql",
    "0039_process_session_drafts.sql",
    "0040_process_method_draft_revisions.sql",
    "0041_process_quick_check.sql",
    "0042_process_guidance_reviews.sql",
    "0043_account_trade_environment.sql",
  ])
    await pool.query(
      await readFile(new URL(`../../lib/db/drizzle/${migration}`, import.meta.url), "utf8"),
    );
  const apiRequire = createRequire(
    new URL("../../artifacts/api-server/package.json", import.meta.url),
  );
  const { default: express } = await import(apiRequire.resolve("express"));
  const { default: router } =
    await import("../../artifacts/api-server/src/routes/trader-process.js");
  const { default: backtest } = await import("../../artifacts/api-server/src/routes/backtest.js");
  const { default: journal } = await import("../../artifacts/api-server/src/routes/journal.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.headers["x-fixture-user"];
    if (typeof id === "string") req.user = { id } as typeof req.user;
    next();
  });
  app.use("/api", router);
  app.use("/api", backtest);
  app.use("/api", journal);
  app.use(
    "/api",
    (await import("../../artifacts/api-server/src/routes/market-decisions.js")).default,
  );
  app.use((error: unknown, _req: unknown, res: import("express").Response, _next: unknown) => {
    console.error(error);
    res.status(500).json({ error: "fixture handler error" });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  const call = async (
    path: string,
    user = "A",
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ) => {
    // Existing scenarios use the current revision. Conflict scenarios pass an explicit stale one.
    if (
      method === "PATCH" &&
      /^process\/sessions\/[^/]+$/.test(path) &&
      body &&
      typeof body === "object" &&
      "action" in body &&
      ["preparation", "plan", "close", "check_in"].includes(String(body.action)) &&
      !("expectedRevision" in body)
    ) {
      const current = await pool.query(
        "SELECT revision FROM process_sessions WHERE id=$1 AND user_id=$2",
        [path.split("/").at(-1), user],
      );
      body = { ...body, expectedRevision: current.rows[0]?.revision ?? 0 };
    }
    const r = await fetch(`http://127.0.0.1:${port}/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { "x-fixture-user": user } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: r.status === 204 ? null : await r.json() };
  };
  const today = processDay(),
    prior = processDay(new Date(Date.now() - 86400000)),
    twoDaysAgo = processDay(new Date(Date.now() - 2 * 86400000));
  const methodBody = () => ({
    requestId: randomUUID(),
    name: "Fixture method",
    riskConfirmed: true,
    rules: {
      markets: ["EURUSD"],
      windows: "London",
      setup: "Only documented setup",
      entry: "Entry rule",
      exit: "Exit rule",
      invalidation: "Invalidation rule",
      waitConditions: "No setup",
      currency: "EUR",
      riskPerTrade: 10,
      maxDailyLoss: 100,
      maxDailyTrades: 10,
      checklist: ["Setup conforms", "Risk checked"],
    },
    protocol: {
      minSamples: 2,
      periodStart: today,
      periodEnd: today,
      minExpectancyR: 0,
      maxDrawdownR: 3,
      observationDays: 1,
      minAdherencePct: 100,
    },
  });
  // First-use journey confirms rules, preparation and scenario in one transaction.
  const firstMethod = methodBody();
  const { protocol: _firstProtocol, ...firstRules } = firstMethod;
  const snapshotId = "a".repeat(64);
  await pool.query(
    "INSERT INTO market_snapshots(id,pair,kind,cutoff_at,target_end,payload) VALUES($1,'EURUSD','context',now(),now()+interval '4 hours',$2)",
    [
      snapshotId,
      JSON.stringify({
        pair: "EURUSD",
        generatedAt: new Date().toISOString(),
        score: 18,
        components: [],
        news: [],
        events: [],
      }),
    ],
  );
  const firstInput = {
    method: firstRules,
    preparation: { checklist: [true, true] },
    plan: {
      decision: "wait",
      market: "EURUSD",
      waitReason: "Setup assente",
      guidance: {
        expectation: "Attendo la tenuta del livello",
        invalidation: "Chiusura sotto il livello",
        response: "reassess",
        contextSnapshotId: snapshotId,
      },
    },
  };
  assert.equal(
    (
      await call("process/guided-start", "first-invalid", {
        ...firstInput,
        method: { ...firstRules, riskConfirmed: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("process/guided-start", "first-invalid", {
        ...firstInput,
        preparation: { checklist: [true, false] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("process/guided-start", "first-invalid", {
        ...firstInput,
        plan: { ...firstInput.plan, market: "GBPUSD" },
      })
    ).status,
    400,
  );
  assert.equal((await call("process", "first-invalid")).data.methods.length, 0);
  assert.equal(
    (
      await call("process/guided-start", "first-invalid", {
        ...firstInput,
        plan: {
          ...firstInput.plan,
          guidance: { ...firstInput.plan.guidance, response: "custom", responseNote: "   " },
        },
      })
    ).status,
    400,
  );
  const staleSnapshotId = "b".repeat(64);
  await pool.query(
    "INSERT INTO market_snapshots(id,pair,kind,cutoff_at,target_end,created_at,payload) VALUES($1,'EURUSD','context',now()-interval '1 hour',now()+interval '3 hours',now()-interval '1 hour','{}')",
    [staleSnapshotId],
  );
  assert.equal(
    (
      await call("process/guided-start", "first-invalid", {
        ...firstInput,
        plan: {
          ...firstInput.plan,
          guidance: { ...firstInput.plan.guidance, contextSnapshotId: staleSnapshotId },
        },
      })
    ).status,
    400,
  );
  const firstResults = await Promise.all([
    call("process/guided-start", "first-guided", firstInput),
    call("process/guided-start", "first-guided", firstInput),
  ]);
  assert.ok(
    firstResults.every((result) => result.status === 201),
    JSON.stringify(firstResults),
  );
  const firstSession = firstResults[0].data;
  assert.equal(firstResults[1].data.id, firstSession.id);
  assert.equal(firstSession.mode, "practice");
  assert.equal(firstSession.state, "operation");
  assert.ok(firstSession.preparedAt);
  const firstState = (await call("process", "first-guided")).data;
  assert.equal(firstState.methods[0].protocol, null);
  assert.equal(firstState.sessions.length, 1);
  assert.ok(firstState.contextSnapshots[snapshotId]);
  const decisionId = firstSession.plan.marketDecisionId;
  assert.equal((await call(`market-decisions/${decisionId}`, "first-guided")).status, 200);
  assert.equal((await call(`market-decisions/${decisionId}`, "first-invalid")).status, 404);
  assert.deepEqual((await call("process", "first-invalid")).data.contextSnapshots, {});
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM market_decisions WHERE user_id='first-guided'",
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await call("process/guided-start", "first-guided", {
        ...firstInput,
        plan: {
          ...firstInput.plan,
          guidance: { ...firstInput.plan.guidance, expectation: "Diversa" },
        },
      })
    ).status,
    409,
  );
  const firstClosure = {
    notes: "",
    violations: [],
    reconciled: true,
    noTrades: true,
    assessment: "unknown",
    outcome: "invalidated",
    correction: "Attendere la chiusura prima di valutare il livello",
  };
  assert.equal(
    (
      await call(
        `process/sessions/${firstSession.id}`,
        "first-guided",
        { action: "close", closure: { ...firstClosure, outcome: undefined } },
        "PATCH",
      )
    ).status,
    400,
  );
  const firstClosed = await call(
    `process/sessions/${firstSession.id}`,
    "first-guided",
    { action: "close", closure: firstClosure },
    "PATCH",
  );
  assert.equal(firstClosed.status, 200, JSON.stringify(firstClosed));
  assert.equal(firstClosed.data.closure.correction, firstClosure.correction);
  assert.equal((await call("process", "first-guided")).data.sessions.length, 1);
  assert.equal(
    (
      await call(
        `process/sessions/${firstSession.id}`,
        "first-guided",
        { action: "close", expectedRevision: 0, closure: firstClosure },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM journal_entries WHERE user_id='first-guided'",
      )
    ).rows[0].count,
    0,
    "A planned session never fabricates an execution",
  );
  check(
    "Checklist-first bootstrap is atomic, idempotent and owned; quantitative snapshot and post-trade correction stay on one session without fabricated trades",
  );
  assert.equal((await call("process", "")).status, 401);
  assert.equal((await call("process/methods", "", {})).status, 401);
  check("Authenticated process has no anonymous fallback");
  const body = methodBody();
  const created = await Promise.all([
    call("process/methods", "A", body),
    call("process/methods", "A", body),
  ]);
  assert.equal(created[0].status, 201, JSON.stringify(created[0]));
  assert.equal(created[0].data.id, created[1].data.id);
  const id = created[0].data.id;
  assert.equal((await call("process", "B")).data.methods.length, 0);
  assert.equal((await call(`process/methods/${id}/activate`, "B", {})).status, 404);
  assert.equal(
    (
      await call(
        "process/method-draft",
        "B",
        {
          id: randomUUID(),
          expectedRevision: 0,
          step: 0,
          draft: { name: "foreign" },
          previousVersionId: id,
        },
        "PUT",
      )
    ).status,
    404,
  );
  check("Method ownership and concurrent create retries");
  const definition = {
    id: randomUUID(),
    expectedRevision: 0,
    step: 0,
    draft: { name: "Partial method", riskConfirmed: true },
    previousVersionId: null,
  };
  const firstDefinition = await call("process/method-draft", "M", definition, "PUT");
  assert.equal(firstDefinition.status, 200, JSON.stringify(firstDefinition));
  assert.equal(firstDefinition.data.revision, 1);
  assert.equal(firstDefinition.data.draft.riskConfirmed, false);
  assert.equal((await call("process", "M")).data.methods.length, 0);
  assert.equal((await call("process", "N")).data.methodDraft, null);
  assert.equal((await call("process/method-draft", "M", definition, "PUT")).data.revision, 1);
  const definitionRace = await Promise.all(
    ["Device A", "Device B"].map((name) =>
      call(
        "process/method-draft",
        "M",
        { ...definition, expectedRevision: 1, step: 1, draft: { name } },
        "PUT",
      ),
    ),
  );
  assert.deepEqual(definitionRace.map((r) => r.status).sort(), [200, 409]);
  const currentDefinition = (await call("process", "M")).data.methodDraft;
  assert.equal(currentDefinition.revision, 2);
  assert.equal(
    (
      await call("process/methods", "M", {
        ...methodBody(),
        draftId: definition.id,
        expectedDraftRevision: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("process/methods", "N", {
        ...methodBody(),
        draftId: definition.id,
        expectedDraftRevision: 2,
      })
    ).status,
    409,
  );
  assert.equal((await call("process", "M")).data.methodDraft.revision, 2);
  assert.equal((await call("process/methods", "M", methodBody())).status, 201);
  assert.equal(
    (await call("process", "M")).data.methodDraft.id,
    definition.id,
    "Unrelated method creation must not delete a draft",
  );
  const finishDefinition = { ...methodBody(), draftId: definition.id, expectedDraftRevision: 2 };
  const finishedDefinition = await call("process/methods", "M", finishDefinition);
  assert.equal(finishedDefinition.status, 201, JSON.stringify(finishedDefinition));
  assert.equal((await call("process", "M")).data.methodDraft, null);
  const replacement = { ...definition, id: randomUUID(), draft: { name: "New draft" }, step: 0 };
  assert.equal((await call("process/method-draft", "M", replacement, "PUT")).status, 200);
  assert.equal(
    (await call("process/methods", "M", finishDefinition)).data.id,
    finishedDefinition.data.id,
  );
  assert.equal(
    (await call("process", "M")).data.methodDraft.id,
    replacement.id,
    "Retry cannot delete a newer draft",
  );
  assert.equal(
    (await call("process/method-draft", "M", { ...definition, expectedRevision: 1 }, "PUT")).status,
    409,
    "Identity prevents revision reuse across drafts",
  );
  check(
    "Method drafts persist incomplete definitions without confirmation; ownership, concurrent edits, stale creation and newer-draft preservation",
  );
  assert.equal((await call("process", "A")).data.dailyNextAction, "check_in");
  const quickBody = { ...methodBody(), protocol: undefined };
  const quickMethod = await call("process/methods", "Q", quickBody);
  assert.equal(quickMethod.status, 201, JSON.stringify(quickMethod));
  const qid = quickMethod.data.id;
  assert.equal(quickMethod.data.protocol, null);
  assert.equal((await call("process", "Q")).data.progress.canAdvance, false);
  assert.equal(
    (
      await call(`process/methods/${qid}/advance`, "Q", {
        expectedPhase: "define",
        review: "Missing protocol",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`process/methods/${qid}/advance`, "Q", {
        expectedPhase: "define",
        review: "Invalid",
        protocol: { ...methodBody().protocol, periodStart: prior },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("process", "Q")).data.activeMethod.protocol,
    null,
    "Failed confirmation rolls back the protocol",
  );
  const quickSession = (await call("process/sessions", "Q", { methodVersionId: qid })).data;
  assert.equal(quickSession.mode, "practice");
  assert.equal((await call("process/sessions", "Q", { methodVersionId: id })).status, 409);
  const quickDraft = {
    stage: "check_in",
    checklist: [true, true],
    mood: "",
    focus: "",
    decision: "trade",
    market: "EURUSD",
    entry: "Entry rule",
    stop: "1.09",
    risk: "10",
    reason: "",
    reasonCode: "",
  };
  const quickSaved = await call(
    `process/sessions/${quickSession.id}`,
    "Q",
    { action: "draft", expectedRevision: 0, draft: quickDraft },
    "PATCH",
  );
  assert.equal(quickSaved.status, 200, JSON.stringify(quickSaved));
  assert.equal(quickSaved.data.preparedAt, null);
  assert.equal(quickSaved.data.plan, null);
  const quickCheck = {
    action: "check_in",
    expectedRevision: quickSaved.data.revision,
    preparation: { checklist: [true, true], mood: "", focus: "" },
    plan: {
      decision: "trade",
      market: "EURUSD",
      setup: quickBody.rules.setup,
      entry: quickBody.rules.entry,
      stop: "1.09",
      invalidation: quickBody.rules.invalidation,
      initialRisk: 10,
    },
  };
  assert.equal(
    (await call(`process/sessions/${quickSession.id}`, "B", quickCheck, "PATCH")).status,
    404,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${quickSession.id}`,
        "Q",
        { ...quickCheck, plan: { ...quickCheck.plan, initialRisk: 11 } },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("process", "Q")).data.session.preparedAt,
    null,
    "Invalid plan never confirms preparation",
  );
  assert.equal(
    (
      await call(
        `process/sessions/${quickSession.id}`,
        "Q",
        { ...quickCheck, expectedRevision: 0 },
        "PATCH",
      )
    ).status,
    409,
  );
  const quickConfirmed = await Promise.all([
    call(`process/sessions/${quickSession.id}`, "Q", quickCheck, "PATCH"),
    call(`process/sessions/${quickSession.id}`, "Q", quickCheck, "PATCH"),
  ]);
  assert.equal(quickConfirmed[0].status, 200, JSON.stringify(quickConfirmed));
  assert.equal(quickConfirmed[0].data.revision, quickSaved.data.revision + 1);
  assert.equal(quickConfirmed[0].data.preparedAt, quickConfirmed[1].data.preparedAt);
  assert.equal(quickConfirmed[0].data.state, "operation");
  const startTest = {
    expectedPhase: "define",
    review: "I confirm this protocol",
    protocol: methodBody().protocol,
  };
  const qadvance = await Promise.all([
    call(`process/methods/${qid}/advance`, "Q", startTest),
    call(`process/methods/${qid}/advance`, "Q", startTest),
  ]);
  assert.equal(qadvance[0].status, 200, JSON.stringify(qadvance));
  assert.equal(qadvance[0].data.phase, "verify");
  assert.equal(
    (
      await call(`process/methods/${qid}/advance`, "Q", {
        ...startTest,
        protocol: { ...startTest.protocol, minSamples: 3 },
      })
    ).status,
    409,
  );
  const qEvidence = {
    requestId: randomUUID(),
    methodVersionId: qid,
    sessionId: quickSession.id,
    purpose: "live",
    source: "manual",
    executionEnvironment: "real",
    initialRisk: 10,
    netPnl: 20,
    costsStatus: "included",
    currency: "EUR",
    account: "practice",
    observedAt: new Date().toISOString(),
    adherence: "conforming",
    provenance: "declared",
    note: "",
  };
  assert.equal(
    (
      await call("process/evidence", "Q", {
        ...qEvidence,
        requestId: randomUUID(),
        purpose: "validation",
      })
    ).status,
    400,
  );
  await pool.query(
    "UPDATE process_methods SET phase='apply',application_started_at=now() WHERE id=$1",
    [qid],
  );
  const qresult = await call("process/evidence", "Q", qEvidence);
  assert.equal(qresult.status, 201, JSON.stringify(qresult));
  assert.equal(
    qresult.data.purpose,
    "development",
    "Practice remains development after method advancement",
  );
  const qclose = await call(
    `process/sessions/${quickSession.id}`,
    "Q",
    {
      action: "close",
      closure: {
        notes: "",
        assessment: "unknown",
        violations: [],
        reconciled: true,
        noTrades: false,
      },
    },
    "PATCH",
  );
  assert.equal(qclose.status, 200, JSON.stringify(qclose));
  assert.equal(qclose.data.mode, "practice");
  const qprogress = (await call("process", "Q")).data.progress.report;
  assert.equal(qprogress.eligibleSamples, 0);
  assert.equal(qprogress.closedSessions, 0);
  assert.equal(qprogress.adherencePct, null);
  check(
    "Essential method, deferred immutable protocol, daily practice, atomic check-in, revision conflicts and retry coalescing",
  );
  check(
    "Practice cannot become validation or application retrospectively; structured review can close without invented notes",
  );
  const legacyMethod = (await call("process/methods", "L", methodBody())).data;
  await pool.query(
    "UPDATE process_methods SET phase='apply',application_started_at=now() WHERE id=$1",
    [legacyMethod.id],
  );
  const legacySession = (await call("process/sessions", "L", {})).data;
  assert.equal(legacySession.mode, "application");
  const legacyPrepared = (
    await call(
      `process/sessions/${legacySession.id}`,
      "L",
      {
        action: "preparation",
        checklist: [true, true],
        mood: "Existing mood",
        focus: "Existing focus",
      },
      "PATCH",
    )
  ).data;
  const legacyCombined = await call(
    `process/sessions/${legacySession.id}`,
    "L",
    {
      action: "check_in",
      preparation: {
        checklist: [true, true],
        mood: legacyPrepared.mood,
        focus: legacyPrepared.focus,
      },
      plan: { decision: "wait", waitReason: "No setup" },
    },
    "PATCH",
  );
  assert.equal(legacyCombined.status, 200, JSON.stringify(legacyCombined));
  assert.equal(legacyCombined.data.preparedAt, legacyPrepared.preparedAt);
  assert.equal(legacyCombined.data.focus, legacyPrepared.focus);
  assert.equal(
    (
      await call(
        `process/sessions/${legacySession.id}`,
        "L",
        {
          action: "close",
          closure: {
            assessment: "deviation",
            notes: "",
            violations: ["Late"],
            reconciled: true,
            noTrades: true,
          },
        },
        "PATCH",
      )
    ).status,
    400,
  );
  const unknownClose = await call(
    `process/sessions/${legacySession.id}`,
    "L",
    {
      action: "close",
      closure: {
        assessment: "unknown",
        notes: "",
        violations: [],
        reconciled: true,
        noTrades: true,
      },
    },
    "PATCH",
  );
  assert.equal(unknownClose.status, 200, JSON.stringify(unknownClose));
  assert.equal((await call("process", "L")).data.progress.report.adherencePct, 0);
  check(
    "Previously prepared sessions retain confirmations in the combined check; deviations require explanation and unsure recap never attests adherence",
  );
  // A recap deviation is already structured; its explanation is not a duplicate violation.
  const deviationMethod = (await call("process/methods", "V", methodBody())).data;
  await pool.query(
    "UPDATE process_methods SET phase='apply',application_started_at=now() WHERE id=$1",
    [deviationMethod.id],
  );
  const deviationSession = (await call("process/sessions", "V", {})).data;
  const deviationReady = await call(
    `process/sessions/${deviationSession.id}`,
    "V",
    {
      action: "check_in",
      preparation: { checklist: [true, true], mood: "", focus: "" },
      plan: { decision: "wait", waitReason: "Pause planned" },
    },
    "PATCH",
  );
  assert.equal(deviationReady.status, 200, JSON.stringify(deviationReady));
  const longExplanation = "I changed the planned window and must review this decision. "
    .repeat(12)
    .trim();
  assert.ok(longExplanation.length > 500 && longExplanation.length < 4000);
  const deviationClosure = {
    assessment: "deviation",
    notes: longExplanation,
    violations: ["Previously documented risk violation"],
    reconciled: true,
    noTrades: true,
  };
  assert.equal(
    (
      await call(
        `process/sessions/${deviationSession.id}`,
        "V",
        { action: "close", closure: { ...deviationClosure, notes: "   " } },
        "PATCH",
      )
    ).status,
    400,
  );
  const recapBefore = (await call("process", "V")).data.session;
  assert.equal(recapBefore.closedAt, null);
  const deviationClosed = await call(
    `process/sessions/${deviationSession.id}`,
    "V",
    { action: "close", closure: { ...deviationClosure, violations: [] } },
    "PATCH",
  );
  assert.equal(deviationClosed.status, 200, JSON.stringify(deviationClosed));
  assert.equal(deviationClosed.data.closure.notes, longExplanation);
  assert.deepEqual(deviationClosed.data.closure.violations, []);
  assert.equal((await call("process", "V")).data.progress.report.adherencePct, 0);
  const deviationRetry = await call(
    `process/sessions/${deviationSession.id}`,
    "V",
    {
      action: "close",
      expectedRevision: recapBefore.revision,
      closure: { ...deviationClosure, violations: [] },
    },
    "PATCH",
  );
  assert.equal(deviationRetry.status, 200);
  assert.equal(deviationRetry.data.revision, deviationClosed.data.revision);
  check(
    "Deviation recap stores its explanation once, accepts full-length notes, rejects blank explanations and never attests adherence",
  );
  const freeJournal = await call("journal", "A", {
    title: "Outside process",
    content: "",
    tradeDate: today,
    result: "win",
    symbol: "EURUSD",
    direction: "buy",
    executionEnvironment: "real",
    entryPrice: 1.1,
    exitPrice: 1.2,
    profit: 20,
    openTime: new Date().toISOString(),
    closeTime: new Date().toISOString(),
  });
  assert.equal(freeJournal.status, 201, JSON.stringify(freeJournal));
  check("Free journal registration remains available before prerequisites");
  assert.equal(
    (
      await call(`process/methods/${id}/advance`, "A", {
        expectedPhase: "verify",
        review: "No skipping",
      })
    ).status,
    409,
  );
  const confirmed = await call(`process/methods/${id}/advance`, "A", {
    expectedPhase: "define",
    review: "Rules and protocol checked",
  });
  assert.equal(confirmed.data.phase, "verify", JSON.stringify(confirmed));
  assert.equal(
    (await call(`process/methods/${id}/advance`, "A", { expectedPhase: "define", review: "Retry" }))
      .data.phase,
    "verify",
  );
  const evidenceBody = (pnl: number, costs = "included") => ({
    requestId: randomUUID(),
    methodVersionId: id,
    purpose: "validation",
    source: "external",
    executionEnvironment: "simulation",
    initialRisk: 10,
    netPnl: pnl,
    costsStatus: costs,
    currency: "EUR",
    account: "external-test",
    observedAt: new Date().toISOString(),
    adherence: "unknown",
    provenance: "declared",
    note: "Synthetic test",
  });
  const missing = await call("process/evidence", "A", evidenceBody(20, "unknown"));
  assert.equal(missing.status, 201);
  assert.equal((await call("process", "A")).data.progress.report.eligibleSamples, 0);
  assert.equal((await call("process", "A")).data.progress.report.incompleteSamples, 1);
  check("Unknown costs cannot satisfy economic criteria");
  const ebody = evidenceBody(20);
  const eretry = await Promise.all([
    call("process/evidence", "A", ebody),
    call("process/evidence", "A", ebody),
  ]);
  assert.equal(eretry[0].status, 201, JSON.stringify(eretry[0]));
  assert.equal(eretry[0].data.id, eretry[1].data.id);
  assert.equal((await call("process/evidence", "A", evidenceBody(-10))).status, 201);
  assert.equal(
    (
      await call(`process/methods/${id}/advance`, "A", {
        expectedPhase: "verify",
        review: "Period not yet finished",
      })
    ).status,
    409,
  );
  check("Evidence retries and test-period prerequisite");
  // Advance the synthetic fixture clock in SQL; no production endpoint can alter a protocol.
  await pool.query(
    "UPDATE process_methods SET protocol=jsonb_set(jsonb_set(protocol,'{periodStart}',to_jsonb($2::text)),'{periodEnd}',to_jsonb($3::text)), verification_started_at=$4,phase_started_at=$4 WHERE id=$1",
    [id, twoDaysAgo, prior, `${twoDaysAgo}T00:00:00Z`],
  );
  await pool.query(
    "UPDATE process_evidence SET observed_at=$2,created_at=$2 WHERE method_version_id=$1",
    [id, `${prior}T12:00:00Z`],
  );
  assert.equal(
    (
      await call(`process/methods/${id}/advance`, "A", {
        expectedPhase: "verify",
        review: "Complete synthetic sample reviewed",
      })
    ).data.phase,
    "apply",
  );
  check("Complete Free evidence and explicit review advance to Apply");
  const sessions = await Promise.all([
    call("process/sessions", "A", {}),
    call("process/sessions", "A", {}),
  ]);
  assert.equal(sessions[0].data.id, sessions[1].data.id);
  const sid = sessions[0].data.id;
  const prepDraft = {
    stage: "preparation",
    checklist: [true, false],
    mood: "Draft mood",
    focus: "Draft focus",
  };
  const draftSaved = await call(
    `process/sessions/${sid}`,
    "A",
    { action: "draft", expectedRevision: 0, draft: prepDraft },
    "PATCH",
  );
  assert.equal(draftSaved.status, 200, JSON.stringify(draftSaved));
  assert.equal(draftSaved.data.state, "preparation");
  assert.equal(draftSaved.data.preparedAt, null);
  assert.deepEqual(draftSaved.data.checklist, [false, false]);
  assert.equal(draftSaved.data.revision, 1);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "B",
        { action: "draft", expectedRevision: 0, draft: prepDraft },
        "PATCH",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: 0, draft: prepDraft },
        "PATCH",
      )
    ).data.revision,
    1,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: 0, draft: { ...prepDraft, focus: "Stale overwrite" } },
        "PATCH",
      )
    ).status,
    409,
  );
  const races = await Promise.all(
    ["Device one", "Device two"].map((focus) =>
      call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: 1, draft: { ...prepDraft, focus } },
        "PATCH",
      ),
    ),
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await call("process", "A")).data.session.revision, 2);
  check(
    "Drafts persist without attesting preparation; ownership, retries and concurrent revisions are enforced",
  );

  const stalePreparation = await call(
    `process/sessions/${sid}`,
    "A",
    {
      action: "preparation",
      expectedRevision: 1,
      checklist: [true, true],
      mood: "Ready",
      focus: "Stale preparation",
    },
    "PATCH",
  );
  assert.equal(stalePreparation.status, 409);
  const stillPreparing = (await call("process", "A")).data.session;
  assert.equal(stillPreparing.preparedAt, null);
  assert.equal(stillPreparing.revision, 2);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        {
          action: "preparation",
          expectedRevision: undefined,
          checklist: [true, true],
          mood: "Ready",
          focus: "Missing revision",
        },
        "PATCH",
      )
    ).status,
    400,
  );

  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "B",
        { action: "preparation", checklist: [true, true], mood: "Ready", focus: "Rules" },
        "PATCH",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "preparation", checklist: [true, false], mood: "Ready", focus: "Rules" },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "plan", plan: { decision: "wait", waitReason: "Skip prep" } },
        "PATCH",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "preparation", checklist: [true, true], mood: "Ready", focus: "One improvement" },
        "PATCH",
      )
    ).data.state,
    "plan",
  );
  check("Daily session concurrency, isolation and mandatory preparation");
  const confirmedPrep = (await call("process", "A")).data.session;
  assert.equal(confirmedPrep.draft, null);
  const planDraft = {
    stage: "plan",
    decision: "trade",
    market: "EURUSD",
    entry: "Partial plan",
    stop: "",
    risk: "",
    reason: "",
  };
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: confirmedPrep.revision, draft: planDraft },
        "PATCH",
      )
    ).status,
    200,
  );
  const draftedPlan = (await call("process", "A")).data.session;
  assert.equal(draftedPlan.state, "plan");
  assert.equal(draftedPlan.plan, null);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        {
          action: "plan",
          expectedRevision: confirmedPrep.revision,
          plan: { decision: "wait", waitReason: "Confirming stale plan without editing it" },
        },
        "PATCH",
      )
    ).status,
    409,
  );
  assert.deepEqual((await call("process", "A")).data.session.draft, planDraft);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: draftedPlan.revision, draft: prepDraft },
        "PATCH",
      )
    ).status,
    409,
  );

  const plan = {
    decision: "trade",
    market: "EURUSD",
    setup: "Only documented setup",
    entry: "Confirmed entry",
    stop: "Initial stop",
    initialRisk: 10,
    invalidation: "Invalidation rule",
  };
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "plan", plan: { ...plan, initialRisk: 11 } },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (await call(`process/sessions/${sid}`, "A", { action: "plan", plan }, "PATCH")).data.state,
    "operation",
  );
  const confirmedOperation = (await call("process", "A")).data.session;
  const planRetry = await call(
    `process/sessions/${sid}`,
    "A",
    {
      action: "plan",
      expectedRevision: draftedPlan.revision,
      plan,
    },
    "PATCH",
  );
  assert.equal(planRetry.status, 200);
  assert.equal(planRetry.data.revision, confirmedOperation.revision);
  for (const pnl of [20, -5]) {
    const closedAt = new Date().toISOString();
    const entry = await call("journal", "A", {
      title: "Guided trade",
      content: "",
      tradeDate: today,
      result: pnl > 0 ? "win" : "loss",
      symbol: "EURUSD",
      direction: "buy",
    executionEnvironment: "real",
      entryPrice: 1.1,
      exitPrice: 1.2,
      profit: pnl,
      commission: -2,
      swap: 0,
      openTime: closedAt,
      closeTime: closedAt,
    });
    assert.equal(entry.status, 201, JSON.stringify(entry));
    const eid = entry.data.manualTrade.accountTradeId;
    const link = {
      requestId: randomUUID(),
      methodVersionId: id,
      sessionId: sid,
      purpose: "live",
      source: "account_trade",
      executionEnvironment: "real",
      accountTradeId: eid,
      initialRisk: 10,
      netPnl: 999,
      costsStatus: "included",
      currency: "EUR",
      observedAt: closedAt,
      adherence: "conforming",
      provenance: "calculated",
    };
    assert.equal((await call("process/evidence", "B", link)).status, 404);
    const outcome = await call("process/evidence", "A", link);
    assert.equal(outcome.status, 201, JSON.stringify(outcome));
    assert.equal(outcome.data.netR, (pnl - 2) / 10);
    assert.equal(outcome.data.provenance, "declared");
    assert.equal(
      (await call("process/evidence", "A", { ...link, requestId: randomUUID() })).data.id,
      outcome.data.id,
    );
  }
  const snapshot = (await call("process", "A")).data.session.rulesSnapshot;
  const operationState = (await call("process", "A")).data.session;
  assert.equal(operationState.draft, null);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: operationState.revision, draft: planDraft },
        "PATCH",
      )
    ).status,
    409,
  );
  const closeDraft = {
    stage: "closure",
    open: true,
    notes: "Draft reconciliation",
    violations: "",
    reconciled: true,
    noTrades: false,
  };
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: operationState.revision, draft: closeDraft },
        "PATCH",
      )
    ).status,
    200,
  );
  const draftedClose = (await call("process", "A")).data.session;
  assert.equal(draftedClose.state, "operation");
  assert.equal(draftedClose.closedAt, null);
  assert.equal(draftedClose.closure, null);
  check("Plan and closure drafts do not confirm stages or rewrite completed preparation");
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        {
          action: "close",
          expectedRevision: operationState.revision,
          closure: { notes: "Stale close", violations: [], reconciled: true, noTrades: false },
        },
        "PATCH",
      )
    ).status,
    409,
  );
  assert.deepEqual((await call("process", "A")).data.session.draft, closeDraft);
  check(
    "Stale preparation, plan and closure confirmations cannot consume newer device drafts; revision is required",
  );

  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        {
          action: "close",
          closure: { notes: "Reviewed outcomes", violations: [], reconciled: true, noTrades: true },
        },
        "PATCH",
      )
    ).status,
    400,
  );
  const closure = {
    notes: "Reconciled both trades and fees",
    violations: [],
    reconciled: true,
    noTrades: false,
  };
  assert.equal(
    (await call(`process/sessions/${sid}`, "A", { action: "close", closure }, "PATCH")).data.state,
    "closed",
  );
  const closedSnapshot = (await call("process", "A")).data.session;
  const closeRetry = await call(
    `process/sessions/${sid}`,
    "A",
    {
      action: "close",
      expectedRevision: draftedClose.revision,
      closure,
    },
    "PATCH",
  );
  assert.equal(closeRetry.status, 200);
  assert.equal(closeRetry.data.revision, closedSnapshot.revision);
  assert.equal(closeRetry.data.closedAt, closedSnapshot.closedAt);
  assert.equal(
    (await call(`process/sessions/${sid}`, "A", { action: "close", closure }, "PATCH")).data.state,
    "closed",
  );
  check("Canonical net P&L, durable links and idempotent closure");
  const frozen = (await call("process", "A")).data.session;
  assert.equal(frozen.draft, null);
  assert.equal(
    (
      await call(
        `process/sessions/${sid}`,
        "A",
        { action: "draft", expectedRevision: frozen.revision, draft: closeDraft },
        "PATCH",
      )
    ).status,
    409,
  );

  await pool.query(
    "UPDATE process_methods SET application_started_at=$2,phase_started_at=$2 WHERE id=$1",
    [id, `${prior}T00:00:00Z`],
  );
  assert.equal(
    (
      await call(`process/methods/${id}/advance`, "A", {
        expectedPhase: "apply",
        review: "Application data and adherence checked",
      })
    ).data.phase,
    "consolidate",
  );
  assert.equal((await call("process", "A")).data.progress.report.eligibleSamples, 2);
  check("Consolidation retains live economic and adherence evidence");
  const revised = await call("process/methods", "A", {
    ...methodBody(),
    previousVersionId: id,
    name: "Revised method",
    rules: { ...methodBody().rules, riskPerTrade: 7, setup: "New setup" },
    protocol: { ...methodBody().protocol, minSamples: 3 },
  });
  assert.equal(revised.data.version, 2);
  assert.equal(revised.data.active, false);
  assert.equal((await call(`process/methods/${revised.data.id}/activate`, "A", {})).status, 409);
  const versionState = (await call("process", "A")).data;
  assert.deepEqual(versionState.session.rulesSnapshot, snapshot);
  assert.equal(versionState.progressByVersion[id].report.eligibleSamples, 2);
  assert.equal(versionState.progressByVersion[revised.data.id].report.eligibleSamples, 0);
  check("New version cannot rewrite today's method snapshot");
  const c = await call("process/methods", "C", methodBody());
  await pool.query(
    "UPDATE process_methods SET phase='apply',application_started_at=$2,phase_started_at=$2 WHERE id=$1",
    [c.data.id, `${prior}T00:00:00Z`],
  );
  const recap = (
    await pool.query(
      "INSERT INTO journal_recaps(user_id,kind,period_start,period_end,overall_judgment,improvements) VALUES('C','weekly',$1,$2,'Review','One improvement') RETURNING id",
      [twoDaysAgo, prior],
    )
  ).rows[0];
  const improvement = {
    requestId: randomUUID(),
    methodVersionId: c.data.id,
    recapId: recap.id,
    action: "Wait for all setup conditions",
    criterion: "Review every decision",
  };
  assert.equal((await call("process/improvements", "A", improvement)).status, 404);
  const impr = await call("process/improvements", "C", improvement);
  assert.equal(impr.status, 201);
  assert.equal(impr.data.recapKind, "weekly");
  const cs = (await call("process/sessions", "C", {})).data;
  assert.equal(cs.improvementId, impr.data.id);
  await call(
    `process/sessions/${cs.id}`,
    "C",
    { action: "preparation", checklist: [true, true], mood: "Ready", focus: improvement.action },
    "PATCH",
  );
  await call(
    `process/sessions/${cs.id}`,
    "C",
    { action: "plan", plan: { decision: "wait", waitReason: "No setup" } },
    "PATCH",
  );
  assert.equal(
    (
      await call(
        `process/sessions/${cs.id}`,
        "C",
        {
          action: "close",
          closure: {
            notes: "Waited according to plan",
            violations: [],
            reconciled: true,
            noTrades: true,
          },
        },
        "PATCH",
      )
    ).data.state,
    "closed",
  );
  const waitReport = (await call("process", "C")).data.progress;
  assert.equal(waitReport.report.adherencePct, 100);
  assert.equal(waitReport.canAdvance, false);
  check(
    "Review focus carries into sessions; no-trade completion stays distinct from profitability",
  );
  await pool.query(
    "INSERT INTO admin_user_subscriptions(user_id,plan,status) VALUES('P','pro','active')",
  );
  const pm = (await call("process/methods", "P", methodBody())).data;
  assert.equal(
    (await call("backtest/sessions", "A", { name: "Free replay", pair: "EURUSD" })).status,
    402,
  );
  const bt = await call("backtest/sessions", "P", {
    name: "Pro replay",
    pair: "EURUSD",
    timeframe: "H1",
  });
  assert.equal(bt.status, 200, JSON.stringify(bt));
  const btrade = await call(`backtest/sessions/${bt.data.id}/trades`, "P", {
    clientRequestId: "fixture:complete",
    direction: "buy",
    executionEnvironment: "real",
    entryPrice: "1.1",
    exitPrice: "1.2",
    stopLoss: "1.1",
    lotSize: "0.01",
    result: "win",
    tradeDate: today,
    initialRisk: "10",
    cost: "2",
    netPnl: "18",
    currency: "EUR",
    economicsProvenance: "calculated",
    openTime: new Date().toISOString(),
    closeTime: new Date().toISOString(),
  });
  assert.equal(btrade.status, 200, JSON.stringify(btrade));
  assert.equal(Number(btrade.data.netR), 1.8);
  const replayEvidence = {
    ...evidenceBody(0),
    methodVersionId: pm.id,
    source: "replay",
    purpose: "development",
    backtestTradeId: btrade.data.id,
  };
  assert.equal(
    (await call("process/evidence", "A", { ...replayEvidence, methodVersionId: id })).status,
    403,
  );
  const recovered = await call("process/evidence", "P", replayEvidence);
  assert.equal(recovered.status, 201, JSON.stringify(recovered));
  assert.equal(recovered.data.initialRisk, 10);
  assert.equal(recovered.data.netR, 1.8);
  check("Replay retains entry risk after stop changes and preserves Pro ownership gates");
  assert.equal((await call("process/history", "A")).data.replays.length, 0);
  assert.equal((await call("process/history", "P")).data.replays.length, 1);
  check("History recovery respects Free and Pro access");
  const dm = (await call("process/methods", "D", methodBody())).data;
  await pool.query(
    "UPDATE process_methods SET phase='apply',application_started_at=now(),phase_started_at=now() WHERE id=$1",
    [dm.id],
  );
  const ds = (await call("process/sessions", "D", {})).data;
  await call(
    `process/sessions/${ds.id}`,
    "D",
    { action: "preparation", checklist: [true, true], mood: "Ready", focus: "Rules" },
    "PATCH",
  );
  const currentPreparation = (await call("process", "D")).data.session;
  const competingPlans = await Promise.all(
    ["First device entry", "Second device entry"].map((entry) =>
      call(
        `process/sessions/${ds.id}`,
        "D",
        {
          action: "plan",
          expectedRevision: currentPreparation.revision,
          plan: { ...plan, entry },
        },
        "PATCH",
      ),
    ),
  );
  assert.deepEqual(competingPlans.map((result) => result.status).sort(), [200, 409]);
  const winner = competingPlans.find((result) => result.status === 200)!.data;
  const retained = (await call("process", "D")).data.session;
  assert.deepEqual(retained.plan, winner.plan);
  assert.equal(retained.revision, currentPreparation.revision + 1);
  assert.equal(retained.preparedAt, currentPreparation.preparedAt);
  check(
    "Concurrent different confirmations commit one plan and preserve the confirmed preparation",
  );
  for (const [symbol, initialRisk, opened, expected] of [
    ["GBPUSD", 12, new Date().toISOString(), "violation"],
    ["EURUSD", 10, `${prior}T12:00:00Z`, "unknown"],
  ] as const) {
    const trade = (
      await call("journal", "D", {
        title: "Off-plan history",
        content: "",
        tradeDate: today,
        result: "win",
        symbol,
        direction: "buy",
    executionEnvironment: "real",
        entryPrice: 1.1,
        exitPrice: 1.2,
        profit: 20,
        openTime: opened,
        closeTime: new Date().toISOString(),
      })
    ).data;
    const linked = await call("process/evidence", "D", {
      ...evidenceBody(0),
      methodVersionId: dm.id,
      purpose: "live",
      source: "account_trade",
      executionEnvironment: "real",
      sessionId: ds.id,
      accountTradeId: trade.manualTrade.accountTradeId,
      initialRisk,
      adherence: "conforming",
    });
    assert.equal(linked.status, 201, JSON.stringify(linked));
    assert.equal(linked.data.adherence, expected);
  }
  check("Off-plan markets and risk are violations; historical entry cannot attest preparation");
  const { verifyGuidedPolicy } = await import("./guided-policy.js");
  await verifyGuidedPolicy({ pool, call, methodBody, today, check });
  const { exportAccountData } =
    await import("../../artifacts/api-server/src/services/accountExport.js");
  const exported = await exportAccountData("A");
  const processExport = exported.data.process as {
    methods: Array<{ userId: string }>;
    evidence: Array<{ userId: string }>;
  };
  assert.ok(processExport.methods.length === 2);
  assert.ok(processExport.evidence.length > 0);
  assert.ok(
    [...processExport.methods, ...processExport.evidence].every((row) => row.userId === "A"),
  );
  assert.ok(exported.categories.includes("trader-process"));
  check("Account export includes owned process data and versions");
  const rehearsal = new URL(
    `../../.local-logs/process-integration-rehearsal/${name}/`,
    import.meta.url,
  );
  await mkdir(rehearsal, { recursive: true, mode: 0o700 });
  await chmod(rehearsal, 0o700);
  const rehearsalBackup = new URL("database.dump", rehearsal);
  const dumped = spawnSync(
    `${bin}/pg_dump`,
    [
      "--dbname",
      target.toString(),
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      fileURLToPath(rehearsalBackup),
    ],
    { encoding: "utf8" },
  );
  assert.equal(dumped.status, 0, dumped.stderr);
  await chmod(rehearsalBackup, 0o600);
  const integrated = spawnSync(
    process.execPath,
    [
      "--import",
      require.resolve("tsx"),
      fileURLToPath(new URL("../local/integrateTraderProcess.ts", import.meta.url)),
      "--apply",
      "--backup",
      fileURLToPath(rehearsalBackup),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        LOCAL_DATABASE_URL: target.toString(),
        DATABASE_URL: target.toString(),
      },
    },
  );
  assert.equal(integrated.status, 0, integrated.stdout + "\n" + integrated.stderr);
  const integrationReport = JSON.parse(
    await readFile(new URL("integration.json", rehearsal), "utf8"),
  );
  assert.equal(integrationReport.existingRowsUnchanged, true);
  assert.equal((await call("process", "A")).data.methods.length, 2);
  assert.equal((await call("process", "A")).data.session.state, "closed");
  check(
    "Explicit local integration validates a full backup and preserves existing rows and snapshots in a disposable database",
  );
  await mkdir(new URL("../../artifacts.local/trader-process/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../../artifacts.local/trader-process/runtime.json", import.meta.url),
    JSON.stringify(
      {
        checks,
        database: name,
        auth: "synthetic handler identity; no Clerk or external providers exercised",
      },
      null,
      2,
    ),
  );
  if (process.env.PROCESS_AUDIT_BROWSER === "1") {
    const browserRunner = new URL("./browser.mjs", import.meta.url).href;
    const { verifyProcessBrowser } = await import(browserRunner);
    await verifyProcessBrowser({ port, pool, today, prior, twoDaysAgo });
  }
  console.log(
    `Trader process runtime: ${checks.length} scenario groups passed on disposable PostgreSQL`,
  );
} finally {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  await closeDb?.();
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [name],
  );
  await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}
