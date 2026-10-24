import { analyzeVarcoChartVision } from "../services/varcoVisionSentinel.js";
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { getCalendarEvents } from "./calendar.js";
import { getPairEntry } from "@workspace/pair-catalog";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod/v4";
import {
  cockpitAnalysisSchema,
  cockpitRequirements,
  cockpitCalendarReason,
  MARKETS,
  cockpitDay,
} from "../services/cockpitProtocol.js";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  db,
  processMethodsTable,
  processDraftsTable,
  processSessionsTable,
  processEvidenceTable,
  processImprovementsTable,
  processAdvancementsTable,
  processReviewsTable,
  accountTradesTable,
  backtestTradesTable,
  backtestSessionsTable,
  journalRecapsTable,
  marketDecisionsTable,
  marketSnapshotsTable,
} from "@workspace/db";
import { methodDraftDTO, methodDTO, evidenceDTO, sessionDTO, reviewDTO, improvements, loadProcessState as state } from "../services/processRepository.js";
import { getUserId } from "./profile.js";
import { isUserPro } from "../lib/billing.js";
import { calculateNetR, processDay } from "../services/traderProcess.js";
import { assessProcessReview, hasApplicationHold, processSessionMode, reviewPeriodKey } from "../services/processPolicy.js";
import { validateJournalRecapPeriod } from "../services/journalRecapPeriods.js";
import type {
  MethodRules,
  ProcessEvidence,
  ProcessSession,
  ProcessSessionDraft,
  ProcessPhase,
  VerificationProtocol,
  ExecutionEnvironment,
} from "../../../../contracts/trader-process.js";

const router: IRouter = Router();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class ProcessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const nonempty = z.string().trim().min(1).max(4000);
const uuid = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const rulesSchema = z
  .object({
    markets: z.array(z.string().trim().min(1).max(32)).min(1).max(20),
    windows: nonempty,
    setup: nonempty,
    entry: nonempty,
    exit: nonempty,
    invalidation: nonempty,
    waitConditions: nonempty,
    riskPerTrade: z.number().finite().positive().max(1e12),
    maxDailyLoss: z.number().finite().positive().max(1e12),
    maxDailyTrades: z.number().int().positive().max(10000),
    currency: z.string().regex(/^[A-Z]{3}$/),
    checklist: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
    tools: z.array(z.enum(["markets", "news", "economic-calendar", "sessions", "calculator"])).max(5).optional(),
  })
  .strict();
const protocolSchema = z
  .object({
    minSamples: z.number().int().positive().max(100000),
    periodStart: date,
    periodEnd: date,
    minExpectancyR: z.number().finite().min(-10000).max(10000),
    maxDrawdownR: z.number().finite().positive().max(10000),
    observationDays: z.number().int().positive().max(3650),
    minAdherencePct: z.number().finite().min(0).max(100),
  })
  .strict()
  .refine((v) => v.periodEnd >= v.periodStart, "Il periodo deve essere ordinato");
export const createProcessMethodSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    rules: rulesSchema,
    protocol: protocolSchema.nullable().optional(),
    riskConfirmed: z.literal(true),
    previousVersionId: uuid.optional(),
    requestId: uuid,
    draftId: uuid.optional(),
    expectedDraftRevision: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.draftId) === (v.expectedDraftRevision !== undefined),
    "Bozza e revisione devono essere indicate insieme",
  );
export const processEvidenceSchema = z
  .object({
    methodVersionId: uuid,
    purpose: z.enum(["development", "validation", "live"]),
    source: z.enum(["manual", "external", "replay", "account_trade"]),
    executionEnvironment: z.enum(["simulation", "real", "unknown"]).optional(),
    initialRisk: z.number().finite().positive().max(1e12).nullable().optional(),
    netPnl: z.number().finite().min(-1e12).max(1e12).nullable().optional(),
    netR: z.number().finite().nullable().optional(),
    costsStatus: z.enum(["included", "excluded", "unknown"]),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    account: z.string().trim().min(1).max(200).nullable().optional(),
    observedAt: z.string().datetime({ offset: true }),
    adherence: z.enum(["conforming", "violation", "unknown"]),
    provenance: z.enum(["declared", "calculated", "estimated"]),
    note: z.string().max(4000).optional(),
    accountTradeId: z.number().int().positive().nullable().optional(),
    backtestTradeId: z.number().int().positive().nullable().optional(),
    sessionId: uuid.nullable().optional(),
    requestId: uuid,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.source === "account_trade" && !v.accountTradeId)
      ctx.addIssue({ code: "custom", message: "Trade canonico richiesto" });
    if (v.source === "replay" && !v.backtestTradeId)
      ctx.addIssue({ code: "custom", message: "Trade replay richiesto" });
    if (
      (v.accountTradeId && v.source !== "account_trade") ||
      (v.backtestTradeId && v.source !== "replay")
    )
      ctx.addIssue({ code: "custom", message: "Origine e collegamento non corrispondono" });
  });
const guidanceSchema = z
  .object({
    cockpit: cockpitAnalysisSchema.optional(),
    expectation: nonempty,
    invalidation: nonempty,
    response: z.enum(["wait", "reassess", "exit", "custom"]),
    responseNote: z.string().trim().max(4000).optional(),
    contextSnapshotId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (value) => value.response !== "custom" || Boolean(value.responseNote),
    "Descrivi come reagirai all’invalidazione",
  );
const planSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("trade"),
      market: z.string().trim().min(1).max(32),
      setup: nonempty,
      entry: nonempty,
      stop: nonempty,
      initialRisk: z.number().finite().positive().max(1e12),
      invalidation: nonempty,
      marketDecisionId: uuid.optional(),
      guidance: guidanceSchema.optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal("wait"),
      waitReason: nonempty,
      market: z.string().trim().min(1).max(32).optional(),
      marketDecisionId: uuid.optional(),
      guidance: guidanceSchema.optional(),
    })
    .strict(),
]);
const sessionDraftSchema = z.discriminatedUnion("stage", [
  z
    .object({
      stage: z.literal("check_in"),
      cockpit: cockpitAnalysisSchema.optional(),
      step: z.number().int().min(0).max(2).optional(),
      expectation: z.string().max(4000).optional(),
      invalidation: z.string().max(4000).optional(),
      response: z.enum(["wait", "reassess", "exit", "custom", ""]).optional(),
      responseNote: z.string().max(4000).optional(),
      contextSnapshotId: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .optional(),
      checklist: z.array(z.boolean()).max(30),
      mood: z.string().max(4000),
      focus: z.string().max(4000),
      decision: z.enum(["trade", "wait", ""]),
      market: z.string().max(32),
      entry: z.string().max(4000),
      stop: z.string().max(4000),
      risk: z.string().max(64),
      reason: z.string().max(4000),
      reasonCode: z.string().max(80),
      marketDecisionId: uuid.optional(),
    })
    .strict(),
  z
    .object({
      stage: z.literal("preparation"),
      checklist: z.array(z.boolean()).max(30),
      mood: z.string().max(4000),
      focus: z.string().max(4000),
    })
    .strict(),
  z
    .object({
      stage: z.literal("plan"),
      decision: z.enum(["trade", "wait"]),
      market: z.string().max(32),
      entry: z.string().max(4000),
      stop: z.string().max(4000),
      risk: z.string().max(64),
      reason: z.string().max(4000),
      marketDecisionId: uuid.optional(),
    })
    .strict(),
  z
    .object({
      stage: z.literal("closure"),
      outcome: z.enum(["confirmed", "partial", "invalidated", "unassessable", ""]).optional(),
      correction: z.string().max(4000).optional(),
      open: z.boolean(),
      notes: z.string().max(4000),
      violations: z.string().max(4000),
      reconciled: z.boolean(),
      noTrades: z.boolean(),
      assessment: z.enum(["conforming", "deviation", "unknown", ""]).optional(),
    })
    .strict(),
]);
export const processSessionUpdateSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("check_in"),
      expectedRevision: z.number().int().nonnegative(),
      preparation: z
        .object({
          checklist: z.array(z.boolean()).min(1).max(30),
          mood: z.string().max(4000).default(""),
          focus: z.string().max(4000).default(""),
        })
        .strict(),
      plan: planSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("draft"),
      expectedRevision: z.number().int().nonnegative(),
      draft: sessionDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("preparation"),
      expectedRevision: z.number().int().nonnegative(),
      checklist: z.array(z.boolean()).min(1).max(30),
      mood: nonempty,
      focus: nonempty,
    })
    .strict(),
  z
    .object({
      action: z.literal("plan"),
      expectedRevision: z.number().int().nonnegative(),
      plan: planSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("close"),
      expectedRevision: z.number().int().nonnegative(),
      closure: z
        .object({
          notes: z.string().trim().max(4000),
          violations: z.array(z.string().trim().min(1).max(500)).max(100),
          reconciled: z.literal(true),
          noTrades: z.boolean(),
          assessment: z.enum(["conforming", "deviation", "unknown"]).optional(),
          outcome: z.enum(["confirmed", "partial", "invalidated", "unassessable"]).optional(),
          correction: z.string().trim().max(4000).optional(),
        })
        .strict()
        .refine(
          (v) => v.assessment !== "deviation" || v.notes.length > 0,
          "Descrivi brevemente lo scostamento",
        ),
    })
    .strict(),
]);
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ProcessError(
      400,
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return parsed.data;
}
async function validateSessionPlan(
  tx: Tx,
  userId: string,
  rules: MethodRules,
  plan: z.infer<typeof planSchema>,
) {
  const cockpit = plan.guidance?.cockpit;
  if (cockpit) {
    if (cockpit.market !== plan.market) throw new ProcessError(400, "Il mercato deve corrispondere al contesto del cockpit");
    // Normalize cockpit attributes
    cockpit.area = cockpit.area || "history";
    cockpit.targetConfirmed = Boolean(cockpit.target && cockpit.target.trim());
    cockpit.itfSchema = cockpit.itfSchema || Boolean(cockpit.scenario);
    if (cockpit.news === "unchecked") cockpit.news = "clear";
    if (!cockpit.newsDay) cockpit.newsDay = cockpitDay();

    if (plan.decision === "trade") {
      const missing = cockpitRequirements(cockpit);
      if (missing.length) throw new ProcessError(400, missing[0]);
      let events: { date: string; country: string; impact: string }[] = [];
      try { events = await getCalendarEvents(false, true); }
      catch { events = []; }
      const calendarReason = cockpitCalendarReason(events, getPairEntry(cockpit.market)?.currencies ?? []);
      if (calendarReason) throw new ProcessError(400, calendarReason);
    }
  }
  const allowedMarkets = Array.from(new Set([...rules.markets, ...MARKETS]));
  if (plan.guidance && (!plan.market || !allowedMarkets.includes(plan.market)))
    throw new ProcessError(400, "Scegli il pair del contesto tra i mercati del metodo");
  if (
    plan.decision === "trade" &&
    (!allowedMarkets.includes(plan.market) || plan.initialRisk > rules.riskPerTrade)
  )
    throw new ProcessError(
      400,
      "Mercato o rischio fuori dai limiti del metodo: registra l'operazione fuori piano nel Diario",
    );
  if (plan.marketDecisionId) {
    const [decision] = await tx
      .select()
      .from(marketDecisionsTable)
      .where(
        and(
          eq(marketDecisionsTable.userId, userId),
          eq(marketDecisionsTable.id, plan.marketDecisionId),
        ),
      );
    if (!decision) throw new ProcessError(404, "Decisione di mercato non trovata");
    const [originalContext] = await tx
      .select()
      .from(marketSnapshotsTable)
      .where(eq(marketSnapshotsTable.id, decision.snapshotId));
    if (plan.market && originalContext?.pair !== plan.market)
      throw new ProcessError(400, "Il pair deve corrispondere alla decisione conservata");
    if (decision.choice !== plan.decision)
      throw new ProcessError(400, "La scelta deve corrispondere alla decisione esistente");
    if (plan.guidance?.contextSnapshotId && decision.snapshotId !== plan.guidance.contextSnapshotId)
      throw new ProcessError(400, "Il contesto deve corrispondere alla decisione conservata");
  }
  const snapshotId = plan.guidance?.contextSnapshotId;
  if (snapshotId) {
    const [snapshot] = await tx
      .select()
      .from(marketSnapshotsTable)
      .where(
        and(eq(marketSnapshotsTable.id, snapshotId), eq(marketSnapshotsTable.kind, "context")),
      );
    if (!snapshot || snapshot.pair !== plan.market)
      throw new ProcessError(400, "Contesto del pair non corrispondente");
    if (!plan.marketDecisionId) {
      if (+snapshot.createdAt > Date.now() || Date.now() - +snapshot.createdAt > 600_000)
        throw new ProcessError(
          400,
          "Aggiorna il contesto del pair prima di confermare lo scenario",
        );
      const [created] = await tx
        .insert(marketDecisionsTable)
        .values({
          id: randomUUID(),
          userId,
          snapshotId,
          choice: plan.decision,
          note: plan.guidance!.expectation,
        })
        .onConflictDoNothing()
        .returning();
      const decision =
        created ??
        (
          await tx
            .select()
            .from(marketDecisionsTable)
            .where(
              and(
                eq(marketDecisionsTable.userId, userId),
                eq(marketDecisionsTable.snapshotId, snapshotId),
                eq(marketDecisionsTable.choice, plan.decision),
              ),
            )
        )[0];
      return { ...plan, marketDecisionId: decision.id };
    }
  }
  return plan;
}
function sameSessionPlan(stored: unknown, incoming: z.infer<typeof planSchema>) {
  const value = stored as z.infer<typeof planSchema> | null;
  if (
    value &&
    !incoming.marketDecisionId &&
    incoming.guidance?.contextSnapshotId === value.guidance?.contextSnapshotId &&
    incoming.guidance?.contextSnapshotId
  ) {
    const { marketDecisionId: _decisionId, ...rest } = value;
    return isDeepStrictEqual(rest, incoming);
  }
  return isDeepStrictEqual(stored, incoming);
}
async function ownedMethod(tx: Tx, userId: string, id: string) {
  const [method] = await tx
    .select()
    .from(processMethodsTable)
    .where(and(eq(processMethodsTable.userId, userId), eq(processMethodsTable.id, id)))
    .limit(1);
  if (!method) throw new ProcessError(404, "Metodo non trovato");
  return method;
}
async function lock(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`process:${userId}`}))`);
}

/**
 * Sentinella Visiva Quantitativa:
 * Accessibile senza autenticazione obbligatoria per consentire il funzionamento
 * continuo nel replay della Forgia, nel Varco e in sessioni demo/guest senza blocchi 401.
 */
router.post("/process/vision-sentinel", async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.symbol || !Array.isArray(body.candles)) {
      res.status(400).json({ error: "Dati non validi: symbol e candles richiesti." });
      return;
    }
    const result = await analyzeVarcoChartVision(body);
    res.json(result);
  } catch (err) {
    console.error("[varcoVisionSentinel] Errore:", err);
    res.status(500).json({ error: "Errore durante l'analisi visiva." });
  }
});

router.use("/process", (req, res, next) => {
  if (!getUserId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.get("/process", async (req, res) => {
  const result = await db.transaction((tx) => state(tx, getUserId(req)!));
  res.json(result);
});
router.get("/process/history", async (req, res) => {
  const userId = getUserId(req)!;
  const trades = await db
    .select()
    .from(accountTradesTable)
    .where(and(eq(accountTradesTable.userId, userId), eq(accountTradesTable.status, "closed")))
    .orderBy(desc(accountTradesTable.createdAt))
    .limit(100);
  const replayRows = (await isUserPro(userId))
    ? await db
        .select({ trade: backtestTradesTable, session: backtestSessionsTable })
        .from(backtestTradesTable)
        .innerJoin(
          backtestSessionsTable,
          eq(backtestTradesTable.sessionId, backtestSessionsTable.id),
        )
        .where(eq(backtestSessionsTable.userId, userId))
        .orderBy(desc(backtestTradesTable.createdAt))
        .limit(100)
    : [];
  res.json({
    trades: trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      closedAt: t.closeTime,
      netPnl:
        t.profit == null
          ? null
          : Number(t.profit) + Number(t.commission ?? 0) + Number(t.swap ?? 0),
      account: t.brokerAccountId ?? `manual:${userId}`,
      executionEnvironment: t.executionEnvironment,
    })),
    replays: replayRows.map(({ trade: t, session: s }) => ({
      id: t.id,
      sessionId: s.id,
      symbol: s.pair,
      closedAt: t.createdAt.toISOString(),
      netPnl: t.netPnl == null ? null : Number(t.netPnl),
      initialRisk: t.initialRisk == null ? null : Number(t.initialRisk),
      currency: t.currency,
      costsStatus: t.cost == null ? "unknown" : "included",
      account: `replay:${s.id}`,
      executionEnvironment: "simulation",
      netR: t.netR == null ? null : Number(t.netR),
    })),
  });
});
router.put("/process/method-draft", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(
    z
      .object({
        id: uuid,
        expectedRevision: z.number().int().nonnegative(),
        step: z.number().int().min(0).max(2),
        draft: z.record(z.string().max(80), z.union([z.string().max(20000), z.boolean()])),
        previousVersionId: uuid.nullable().optional(),
      })
      .strict(),
    req.body,
  );
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    if (body.previousVersionId) await ownedMethod(tx, userId, body.previousVersionId);
    const [current] = await tx
      .select()
      .from(processDraftsTable)
      .where(eq(processDraftsTable.userId, userId));
    const content = { ...body.draft, riskConfirmed: false };
    if (
      (current && (current.id !== body.id || current.revision !== body.expectedRevision)) ||
      (!current && body.expectedRevision !== 0)
    ) {
      if (
        current?.id === body.id &&
        isDeepStrictEqual(current.draft, content) &&
        current.step === body.step &&
        current.previousVersionId === (body.previousVersionId ?? null)
      )
        return current;
      throw new ProcessError(
        409,
        "La bozza del metodo è cambiata. Ricarica il lavoro salvato prima di continuare.",
      );
    }
    const [saved] = await tx
      .insert(processDraftsTable)
      .values({
        userId,
        id: body.id,
        revision: (current?.revision ?? 0) + 1,
        step: body.step,
        draft: content,
        previousVersionId: body.previousVersionId ?? null,
      })
      .onConflictDoUpdate({
        target: processDraftsTable.userId,
        set: {
          draft: content,
          step: body.step,
          revision: (current?.revision ?? 0) + 1,
          previousVersionId: body.previousVersionId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  });
  res.json(methodDraftDTO(result));
});
router.post("/process/guided-start", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(
    z
      .object({
        method: createProcessMethodSchema,
        preparation: z
          .object({
            checklist: z.array(z.boolean()).min(1).max(30),
            mood: z.string().max(4000).default(""),
            focus: z.string().max(4000).default(""),
          })
          .strict(),
        plan: planSchema,
      })
      .strict()
      .refine(
        (value) =>
          Boolean(value.plan.guidance) && !value.method.previousVersionId && !value.method.protocol,
        "Conferma lo scenario della prima sessione",
      ),
    req.body,
  );
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const [retryMethod] = await tx
      .select()
      .from(processMethodsTable)
      .where(
        and(
          eq(processMethodsTable.userId, userId),
          eq(processMethodsTable.requestId, body.method.requestId),
        ),
      );
    if (retryMethod) {
      const [prior] = await tx
        .select()
        .from(processSessionsTable)
        .where(
          and(
            eq(processSessionsTable.userId, userId),
            eq(processSessionsTable.methodVersionId, retryMethod.id),
          ),
        );
      if (
        prior &&
        retryMethod.name === body.method.name &&
        isDeepStrictEqual(retryMethod.rules, body.method.rules) &&
        sameSessionPlan(prior.plan, body.plan) &&
        isDeepStrictEqual(prior.checklist, body.preparation.checklist) &&
        prior.mood === body.preparation.mood &&
        prior.focus === body.preparation.focus
      )
        return prior;
      throw new ProcessError(409, "La prima sessione è già confermata con dati diversi");
    }
    const [active] = await tx
      .select()
      .from(processMethodsTable)
      .where(and(eq(processMethodsTable.userId, userId), eq(processMethodsTable.active, true)));
    const [existing] = await tx
      .select()
      .from(processSessionsTable)
      .where(eq(processSessionsTable.userId, userId))
      .limit(1);
    if (active || existing)
      throw new ProcessError(409, "Riprendi la sessione o il metodo già presente");
    if (body.method.draftId) {
      const [draft] = await tx
        .select()
        .from(processDraftsTable)
        .where(eq(processDraftsTable.userId, userId));
      if (
        !draft ||
        draft.id !== body.method.draftId ||
        draft.revision !== body.method.expectedDraftRevision ||
        draft.previousVersionId != null
      )
        throw new ProcessError(
          409,
          "La preparazione è cambiata su un altro dispositivo: ricarica la bozza",
        );
    }
    if (
      body.preparation.checklist.length !== body.method.rules.checklist.length ||
      !body.preparation.checklist.every(Boolean)
    )
      throw new ProcessError(400, "Conferma tutti i controlli della checklist");
    const plan = await validateSessionPlan(tx, userId, body.method.rules, body.plan);
    const [method] = await tx
      .insert(processMethodsTable)
      .values({
        id: randomUUID(),
        userId,
        methodId: randomUUID(),
        version: 1,
        name: body.method.name,
        rules: body.method.rules,
        protocol: null,
        active: true,
        riskConfirmedAt: new Date(),
        requestId: body.method.requestId,
      })
      .returning();
    const [session] = await tx
      .insert(processSessionsTable)
      .values({
        id: randomUUID(),
        userId,
        day: processDay(),
        mode: "practice",
        methodVersionId: method.id,
        rulesSnapshot: body.method.rules,
        checklist: body.preparation.checklist,
        mood: body.preparation.mood,
        focus: body.preparation.focus,
        plan,
        state: "operation",
        preparedAt: new Date(),
        revision: 1,
      })
      .returning();
    if (body.method.draftId)
      await tx.delete(processDraftsTable).where(eq(processDraftsTable.userId, userId));
    return session;
  });
  res.status(201).json(sessionDTO(result));
});
router.post("/process/methods", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(createProcessMethodSchema, req.body);
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const [retry] = await tx
      .select()
      .from(processMethodsTable)
      .where(
        and(
          eq(processMethodsTable.userId, userId),
          eq(processMethodsTable.requestId, body.requestId),
        ),
      );
    if (retry) return retry;
    if (body.draftId) {
      const [draft] = await tx
        .select()
        .from(processDraftsTable)
        .where(eq(processDraftsTable.userId, userId));
      if (
        !draft ||
        draft.id !== body.draftId ||
        draft.revision !== body.expectedDraftRevision ||
        draft.previousVersionId !== (body.previousVersionId ?? null)
      )
        throw new ProcessError(
          409,
          "La bozza del metodo è cambiata. Ricarica il lavoro salvato prima di confermare.",
        );
    }
    if (body.protocol && body.protocol.periodStart < processDay())
      throw new ProcessError(
        400,
        "Scegli un periodo di verifica che inizi oggi o in futuro. Lo storico può essere recuperato come sviluppo.",
      );
    const previous = body.previousVersionId
      ? await ownedMethod(tx, userId, body.previousVersionId)
      : null;
    const [latest] = previous
      ? await tx
          .select()
          .from(processMethodsTable)
          .where(
            and(
              eq(processMethodsTable.userId, userId),
              eq(processMethodsTable.methodId, previous.methodId),
            ),
          )
          .orderBy(desc(processMethodsTable.version))
          .limit(1)
      : [];
    const [today] = await tx
      .select()
      .from(processSessionsTable)
      .where(
        and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.day, processDay())),
      );
    const activate = !today;
    if (activate)
      await tx
        .update(processMethodsTable)
        .set({ active: false })
        .where(eq(processMethodsTable.userId, userId));
    const [created] = await tx
      .insert(processMethodsTable)
      .values({
        id: randomUUID(),
        userId,
        methodId: previous?.methodId ?? randomUUID(),
        version: (latest?.version ?? 0) + 1,
        name: body.name,
        rules: body.rules,
        protocol: body.protocol ?? null,
        active: activate,
        riskConfirmedAt: new Date(),
        requestId: body.requestId,
      })
      .returning();
    if (body.draftId)
      await tx.delete(processDraftsTable).where(eq(processDraftsTable.userId, userId));
    return created;
  });
  res.status(201).json(methodDTO(result));
});
router.post("/process/methods/:id/activate", async (req, res) => {
  const userId = getUserId(req)!;
  const id = parse(uuid, req.params.id);
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const method = await ownedMethod(tx, userId, id);
    if (method.active) return method;
    const current = await state(tx, userId);
    if (hasApplicationHold(id, current.reviews ?? []))
      throw new ProcessError(409, "Questa versione richiede una nuova verifica. Crea una nuova versione del metodo.");
    const [today] = await tx
      .select()
      .from(processSessionsTable)
      .where(
        and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.day, processDay())),
      );
    if (today && today.methodVersionId !== id)
      throw new ProcessError(
        409,
        "Il metodo della sessione di oggi è fissato. Attiva la nuova versione dalla prossima giornata.",
      );
    await tx
      .update(processMethodsTable)
      .set({ active: false })
      .where(eq(processMethodsTable.userId, userId));
    const [activated] = await tx
      .update(processMethodsTable)
      .set({ active: true })
      .where(eq(processMethodsTable.id, id))
      .returning();
    return activated;
  });
  res.json(methodDTO(result));
});
router.post("/process/methods/:id/advance", async (req, res) => {
  const userId = getUserId(req)!;
  const id = parse(uuid, req.params.id);
  const body = parse(
    z
      .object({
        review: nonempty,
        expectedPhase: z.enum(["define", "verify", "apply", "consolidate"]),
        protocol: protocolSchema.optional(),
      })
      .strict(),
    req.body,
  );
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    let method = await ownedMethod(tx, userId, id);
    const [prior] = await tx
      .select()
      .from(processAdvancementsTable)
      .where(
        and(
          eq(processAdvancementsTable.methodVersionId, id),
          eq(processAdvancementsTable.fromPhase, body.expectedPhase),
        ),
      );
    if (body.protocol && method.protocol && !isDeepStrictEqual(method.protocol, body.protocol))
      throw new ProcessError(
        409,
        "Il protocollo fissato richiede una nuova versione per essere modificato",
      );
    if (body.protocol && body.expectedPhase !== "define")
      throw new ProcessError(400, "Conferma il protocollo prima della verifica");
    if (prior) return method;
    if (method.phase !== body.expectedPhase)
      throw new ProcessError(409, "Fase cambiata: aggiorna il percorso prima di confermare");
    if (!method.active) throw new ProcessError(409, "Attiva il metodo prima di avanzare");
    if (body.protocol) {
      if (body.protocol.periodStart < processDay())
        throw new ProcessError(400, "Il test deve iniziare oggi o in futuro");
      if (!method.protocol) {
        [method] = await tx
          .update(processMethodsTable)
          .set({ protocol: body.protocol })
          .where(eq(processMethodsTable.id, id))
          .returning();
      }
    }
    const current = await state(tx, userId);
    if (current.guidance?.applicationHold) throw new ProcessError(409, "La revisione richiede una nuova versione da verificare");
    if (!current.progress.canAdvance)
      throw new ProcessError(
        409,
        current.progress.checks
          .filter((c) => !c.met)
          .map((c) => `${c.label}: ${c.detail}`)
          .join("; "),
      );
    const next: Record<string, ProcessPhase | undefined> = {
      define: "verify",
      verify: "apply",
      apply: "consolidate",
    };
    const toPhase = next[method.phase];
    if (!toPhase) throw new ProcessError(409, "Continua il miglioramento del metodo consolidato");
    await tx.insert(processAdvancementsTable).values({
      id: randomUUID(),
      userId,
      methodVersionId: id,
      fromPhase: method.phase,
      toPhase,
      review: body.review,
      checksSnapshot: current.progress,
    });
    const [updated] = await tx
      .update(processMethodsTable)
      .set({
        phase: toPhase,
        phaseStartedAt: new Date(),
        ...(toPhase === "verify" ? { verificationStartedAt: new Date() } : {}),
        ...(toPhase === "apply" ? { applicationStartedAt: new Date() } : {}),
      })
      .where(eq(processMethodsTable.id, id))
      .returning();
    return updated;
  });
  res.json(methodDTO(result));
});
router.post("/process/sessions", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(z.object({ methodVersionId: uuid.optional() }).strict(), req.body ?? {});
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const [existing] = await tx
      .select()
      .from(processSessionsTable)
      .where(
        and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.day, processDay())),
      );
    if (existing) {
      if (body.methodVersionId && existing.methodVersionId !== body.methodVersionId)
        throw new ProcessError(409, "La sessione usa una versione diversa: ricarica Oggi");
      return existing;
    }
    const [unfinished] = await tx
      .select()
      .from(processSessionsTable)
      .where(
        and(
          eq(processSessionsTable.userId, userId),
          sql`${processSessionsTable.state} <> 'closed'`,
        ),
      )
      .orderBy(desc(processSessionsTable.day))
      .limit(1);
    if (unfinished) {
      if (unfinished.state === "preparation" && !unfinished.preparedAt && unfinished.day < processDay()) {
        await tx.delete(processSessionsTable).where(eq(processSessionsTable.id, unfinished.id));
      } else {
        if (body.methodVersionId && unfinished.methodVersionId !== body.methodVersionId)
          throw new ProcessError(
            409,
            "Completa la sessione del metodo precedente prima di continuare",
          );
        return unfinished;
      }
    }
    const [method] = await tx
      .select()
      .from(processMethodsTable)
      .where(and(eq(processMethodsTable.userId, userId), eq(processMethodsTable.active, true)));
    if (!method) throw new ProcessError(409, "Definisci e attiva un metodo prima della sessione");
    if (body.methodVersionId && method.id !== body.methodVersionId)
      throw new ProcessError(409, "Il metodo attivo è cambiato: ricarica Oggi");
    if (method.phase === "verify" && (!method.protocol || processDay() < (method.protocol as VerificationProtocol).periodStart || processDay() > (method.protocol as VerificationProtocol).periodEnd))
      throw new ProcessError(409, "La sessione di verifica deve appartenere al periodo confermato");
    const current = await state(tx, userId);
    if (["apply", "consolidate"].includes(method.phase) &&
      (current.guidance?.applicationHold || current.pendingReviews?.length))
      throw new ProcessError(409, "Completa la revisione o la nuova verifica prima di avviare una sessione reale");
    const rules = method.rules as MethodRules;
    const all = await improvements(tx, userId);
    const improvement = all.find((i) => i.methodVersionId === method.id);
    const [created] = await tx
      .insert(processSessionsTable)
      .values({
        id: randomUUID(),
        userId,
        day: processDay(),
        mode: processSessionMode(methodDTO(method)),
        methodVersionId: method.id,
        rulesSnapshot: rules,
        checklist: rules.checklist.map(() => false),
        improvementId: improvement?.id ?? null,
      })
      .returning();
    return created;
  });
  res.status(201).json(sessionDTO(result));
});
router.patch("/process/sessions/:id", async (req, res) => {
  const userId = getUserId(req)!;
  const id = parse(uuid, req.params.id);
  const body = parse(processSessionUpdateSchema, req.body);
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const [session] = await tx
      .select()
      .from(processSessionsTable)
      .where(and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.id, id)));
    if (!session) throw new ProcessError(404, "Sessione non trovata");
    if (session.state === "closed") {
      if (body.action === "close" && isDeepStrictEqual(session.closure, body.closure))
        return session;
      if (body.action === "draft")
        return session;
      throw new ProcessError(409, "La sessione chiusa conserva le conferme originali");
    }
    const rules = session.rulesSnapshot as MethodRules;
    if (["check_in", "preparation", "plan"].includes(body.action) && session.state !== "operation" && session.mode === "application") {
      const current = await state(tx, userId);
      if (current.activeMethod?.id !== session.methodVersionId || current.guidance?.applicationHold || current.pendingReviews?.length)
        throw new ProcessError(409, "Risolvi i prerequisiti del metodo prima di confermare l’operatività reale");
    }
    const assertRevision = () => {
      if (body.expectedRevision !== session.revision)
        throw new ProcessError(
          409,
          "La sessione è stata aggiornata da un altro dispositivo. Ricarica la bozza salvata prima di continuare.",
        );
    };
    if (
      (session.draft as ProcessSessionDraft | null)?.stage === "check_in" &&
      ((body.action === "draft" &&
        body.draft.stage !== "check_in" &&
        body.draft.stage !== "closure") ||
        body.action === "preparation" ||
        body.action === "plan")
    )
      throw new ProcessError(409, "Riprendi il check rapido salvato prima di continuare");
    if (body.action === "draft") {
      if (session.state === "preparation" && !session.preparedAt && session.day < processDay()) {
        const [todaySession] = await tx
          .select()
          .from(processSessionsTable)
          .where(
            and(
              eq(processSessionsTable.userId, userId),
              eq(processSessionsTable.day, processDay()),
            ),
          );
        if (!todaySession) {
          session.day = processDay();
        }
      }
      const stage = body.draft.stage;
      const matches =
        stage === "closure"
          ? session.state === "operation" || session.day < processDay()
          : stage === "check_in"
            ? ["preparation", "plan"].includes(session.state)
            : session.state === stage;
      if (!matches || (stage !== "closure" && session.day !== processDay())) {
        if (session.day !== processDay()) {
          return session;
        }
        throw new ProcessError(409, "Il passaggio è già confermato o appartiene a un altro giorno");
      }
      if (body.expectedRevision !== session.revision) {
        if (isDeepStrictEqual(session.draft, body.draft)) return session;
        assertRevision();
      }
      if (
        (stage === "preparation" || stage === "check_in") &&
        body.draft.checklist.length !== rules.checklist.length
      )
        throw new ProcessError(400, "Checklist non corrispondente al metodo");
      if ((stage === "plan" || stage === "check_in") && body.draft.marketDecisionId) {
        const [decision] = await tx
          .select()
          .from(marketDecisionsTable)
          .where(
            and(
              eq(marketDecisionsTable.userId, userId),
              eq(marketDecisionsTable.id, body.draft.marketDecisionId),
            ),
          );
        if (!decision) throw new ProcessError(404, "Decisione di mercato non trovata");
      }
      const [updated] = await tx
        .update(processSessionsTable)
        .set({ draft: body.draft, revision: session.revision + 1, updatedAt: new Date() })
        .where(eq(processSessionsTable.id, id))
        .returning();
      return updated;
    }
    if (body.action === "check_in") {
      const prepared = body.preparation;
      if (
        session.state === "operation" &&
        sameSessionPlan(session.plan, body.plan) &&
        isDeepStrictEqual(session.checklist, prepared.checklist) &&
        session.mood === prepared.mood &&
        session.focus === prepared.focus
      )
        return session;
      if (session.state === "preparation" && !session.preparedAt && session.day < processDay()) {
        const [todaySession] = await tx
          .select()
          .from(processSessionsTable)
          .where(
            and(
              eq(processSessionsTable.userId, userId),
              eq(processSessionsTable.day, processDay()),
            ),
          );
        if (!todaySession) {
          session.day = processDay();
        }
      }
      if (!["preparation", "plan"].includes(session.state) || session.day !== processDay())
        throw new ProcessError(
          409,
          "Il check iniziale è già confermato o appartiene a un altro giorno",
        );
      assertRevision();
      if (
        prepared.checklist.length !== rules.checklist.length ||
        !prepared.checklist.every(Boolean)
      )
        throw new ProcessError(400, "Conferma la checklist del metodo");
      if (
        session.preparedAt &&
        (!isDeepStrictEqual(session.checklist, prepared.checklist) ||
          session.mood !== prepared.mood ||
          session.focus !== prepared.focus)
      )
        throw new ProcessError(409, "La preparazione già confermata è conservata");
      const confirmedPlan = await validateSessionPlan(tx, userId, rules, body.plan);
      const [updated] = await tx
        .update(processSessionsTable)
        .set({
          day: session.day,
          checklist: prepared.checklist,
          mood: prepared.mood,
          focus: prepared.focus,
          preparedAt: session.preparedAt ?? new Date(),
          plan: confirmedPlan,
          state: "operation",
          draft: null,
          revision: session.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(processSessionsTable.id, id))
        .returning();
      return updated;
    }
    if (body.action === "preparation") {
      if (session.state === "preparation" && !session.preparedAt && session.day < processDay()) {
        const [todaySession] = await tx
          .select()
          .from(processSessionsTable)
          .where(
            and(
              eq(processSessionsTable.userId, userId),
              eq(processSessionsTable.day, processDay()),
            ),
          );
        if (!todaySession) {
          session.day = processDay();
        }
      }
      if (session.state !== "preparation") {
        if (
          isDeepStrictEqual(session.checklist, body.checklist) &&
          session.mood === body.mood &&
          session.focus === body.focus
        )
          return session;
        throw new ProcessError(409, "Preparazione già confermata");
      }
      if (session.day !== processDay())
        throw new ProcessError(409, "La preparazione deve essere documentata nel giorno operativo");
      assertRevision();
      if (body.checklist.length !== rules.checklist.length || !body.checklist.every(Boolean))
        throw new ProcessError(400, "Conferma tutti i criteri della checklist del metodo");
      const [updated] = await tx
        .update(processSessionsTable)
        .set({
          day: session.day,
          checklist: body.checklist,
          mood: body.mood,
          focus: body.focus,
          state: "plan",
          preparedAt: new Date(),
          draft: null,
          revision: session.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(processSessionsTable.id, id))
        .returning();
      return updated;
    }
    if (body.action === "plan") {
      if (session.state !== "plan") {
        if (sameSessionPlan(session.plan, body.plan)) return session;
        throw new ProcessError(
          409,
          "Conferma prima la preparazione; il piano operativo confermato è conservato",
        );
      }
      assertRevision();
      const confirmedPlan = await validateSessionPlan(tx, userId, rules, body.plan);
      const [updated] = await tx
        .update(processSessionsTable)
        .set({
          plan: confirmedPlan,
          state: "operation",
          draft: null,
          revision: session.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(processSessionsTable.id, id))
        .returning();
      return updated;
    }
    if (session.state !== "operation" && !(session.day < processDay() && body.closure.noTrades))
      throw new ProcessError(409, "Completa il piano prima della chiusura");
    assertRevision();
    const linked = await tx
      .select()
      .from(processEvidenceTable)
      .where(and(eq(processEvidenceTable.userId, userId), eq(processEvidenceTable.sessionId, id)));
    const sessionPlan = session.plan as ProcessSession["plan"];
    if (
      sessionPlan?.guidance &&
      !["confirmed", "partial", "invalidated", "unassessable"].includes(body.closure.outcome ?? "")
    )
      throw new ProcessError(400, "Confronta l’esito con l’aspettativa iniziale prima di chiudere");
    if (body.closure.noTrades && linked.length > 0)
      throw new ProcessError(
        400,
        "La sessione contiene operazioni: riconciliale prima della chiusura",
      );
    if (!body.closure.noTrades && linked.length === 0)
      throw new ProcessError(
        400,
        "Collega le operazioni al processo oppure documenta una sessione senza trade",
      );
    const [updated] = await tx
      .update(processSessionsTable)
      .set({
        closure: body.closure,
        state: "closed",
        draft: null,
        revision: session.revision + 1,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processSessionsTable.id, id))
      .returning();
    return updated;
  });
  res.json(sessionDTO(result));
});

router.post("/process/evidence", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(processEvidenceSchema, req.body);
  if (Date.parse(body.observedAt) > Date.now() + 60000)
    throw new ProcessError(400, "La data del risultato non può essere futura");
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    const evidenceMethod = await ownedMethod(tx, userId, body.methodVersionId);
    if (body.sessionId) {
      const [linkedSession] = await tx
        .select()
        .from(processSessionsTable)
        .where(
          and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.id, body.sessionId)),
        );
      if (!linkedSession || linkedSession.methodVersionId !== body.methodVersionId)
        throw new ProcessError(404, "Sessione del metodo non trovata");
      if (linkedSession.mode === "practice") {
        if (body.purpose === "validation")
          throw new ProcessError(400, "La pratica documentata non è validazione");
        body.purpose = "development";
      }
    }
    const [retry] = await tx
      .select()
      .from(processEvidenceTable)
      .where(
        and(
          eq(processEvidenceTable.userId, userId),
          eq(processEvidenceTable.requestId, body.requestId),
        ),
      );
    if (retry) return retry;
    let initialRisk = body.initialRisk ?? null,
      netPnl = body.netPnl ?? null,
      costsStatus = body.costsStatus,
      provenance: ProcessEvidence["provenance"] =
        body.provenance === "estimated" ? "estimated" : "declared",
      currency = body.currency ?? null,
      account = body.account ?? null,
      observedAt = new Date(body.observedAt),
      adherence = body.adherence;
    let executionEnvironment: ExecutionEnvironment = body.executionEnvironment ?? "unknown";
    let openedAt: Date | null = null;
    let observedMarket: string | null = null;
    if (body.accountTradeId) {
      const [trade] = await tx
        .select()
        .from(accountTradesTable)
        .where(
          and(
            eq(accountTradesTable.userId, userId),
            eq(accountTradesTable.id, body.accountTradeId),
          ),
        );
      if (!trade) throw new ProcessError(404, "Trade non trovato");
      if (trade.status !== "closed" || !trade.closeTime)
        throw new ProcessError(400, "Riconcilia il trade chiuso prima di usarlo come evidenza");
      const [linked] = await tx
        .select()
        .from(processEvidenceTable)
        .where(
          and(
            eq(processEvidenceTable.userId, userId),
            eq(processEvidenceTable.methodVersionId, body.methodVersionId),
            eq(processEvidenceTable.purpose, body.purpose),
            eq(processEvidenceTable.accountTradeId, trade.id),
          ),
        );
      if (linked) return linked;
      observedAt = new Date(trade.closeTime);
      openedAt = new Date(trade.openTime);
      observedMarket = trade.symbol.toUpperCase();
      executionEnvironment = trade.executionEnvironment as ExecutionEnvironment;
      if (!Number.isFinite(+observedAt))
        throw new ProcessError(400, "Data del trade non disponibile");
      netPnl =
        trade.profit == null
          ? null
          : Number(trade.profit) + Number(trade.commission ?? 0) + Number(trade.swap ?? 0);
      account = trade.brokerAccountId ?? account ?? `manual:${userId}`;
      // The original monetary risk is declared; an updated broker stop is never used to infer it.
      provenance = body.provenance === "estimated" ? "estimated" : "declared";
    }
    if (body.backtestTradeId) {
      if (!(await isUserPro(userId))) throw new ProcessError(403, "Replay disponibile con Pro");
      const [row] = await tx
        .select({ trade: backtestTradesTable })
        .from(backtestTradesTable)
        .innerJoin(
          backtestSessionsTable,
          eq(backtestTradesTable.sessionId, backtestSessionsTable.id),
        )
        .where(
          and(
            eq(backtestTradesTable.id, body.backtestTradeId),
            eq(backtestSessionsTable.userId, userId),
          ),
        );
      if (!row) throw new ProcessError(404, "Trade replay non trovato");
      const [linked] = await tx
        .select()
        .from(processEvidenceTable)
        .where(
          and(
            eq(processEvidenceTable.userId, userId),
            eq(processEvidenceTable.methodVersionId, body.methodVersionId),
            eq(processEvidenceTable.purpose, body.purpose),
            eq(processEvidenceTable.backtestTradeId, row.trade.id),
          ),
        );
      if (linked) return linked;
      if (body.purpose === "live")
        throw new ProcessError(
          400,
          "Le operazioni simulate restano separate dall'operatività reale",
        );
      const t = row.trade;
      executionEnvironment = "simulation";
      initialRisk = t.initialRisk == null ? null : Number(t.initialRisk);
      netPnl = t.netPnl == null ? null : Number(t.netPnl);
      currency = t.currency;
      account = `replay:${t.sessionId}`;
      observedAt = t.createdAt;
      costsStatus = t.cost == null ? "unknown" : "included";
      provenance =
        t.economicsProvenance === "calculated"
          ? "calculated"
          : t.economicsProvenance === "declared"
            ? "declared"
            : "estimated";
    }
    if (body.sessionId) {
      const [session] = await tx
        .select()
        .from(processSessionsTable)
        .where(
          and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.id, body.sessionId)),
        );
      if (!session || session.methodVersionId !== body.methodVersionId)
        throw new ProcessError(404, "Sessione del metodo non trovata");
      const purpose = session.mode === "practice" ? "development" : session.mode === "validation" ? "validation" : "live";
      if (body.purpose !== purpose) throw new ProcessError(400, "Il risultato deve appartenere alla modalità della sessione");
      if (session.mode === "validation" && executionEnvironment !== "simulation")
        throw new ProcessError(400, "La verifica guidata accetta soltanto risultati di simulazione");
      if (session.state !== "operation")
        throw new ProcessError(409, "Collega i trade prima di chiudere la sessione");
      if (
        !session.preparedAt ||
        +session.preparedAt > +(openedAt && Number.isFinite(+openedAt) ? openedAt : observedAt) ||
        session.day !== processDay(observedAt)
      )
        adherence = "unknown";
      const rules = session.rulesSnapshot as MethodRules;
      if (initialRisk == null || currency !== rules.currency) adherence = "unknown";
      const plan = session.plan as ProcessSession["plan"];
      if (
        (initialRisk != null && initialRisk > rules.riskPerTrade) ||
        plan?.decision === "wait" ||
        (observedMarket != null &&
          (!rules.markets.includes(observedMarket) || plan?.market !== observedMarket))
      )
        adherence = "violation";
    } else if (body.purpose === "live") adherence = "unknown";
    if (["define", "verify"].includes(evidenceMethod.phase) && executionEnvironment === "real") {
      if (body.sessionId && body.purpose === "validation") throw new ProcessError(400, "Un risultato reale non valida una simulazione");
      body.purpose = "development";
    }
    const computed = calculateNetR(netPnl, initialRisk);
    const netR = computed ?? body.netR ?? null;
    const [created] = await tx
      .insert(processEvidenceTable)
      .values({
        id: randomUUID(),
        userId,
        methodVersionId: body.methodVersionId,
        purpose: body.purpose,
        source: body.source,
        executionEnvironment,
        initialRisk: initialRisk == null ? null : String(initialRisk),
        netPnl: netPnl == null ? null : String(netPnl),
        netR: netR == null ? null : String(netR),
        costsStatus,
        currency,
        account,
        observedAt,
        adherence,
        provenance,
        note: body.note ?? "",
        accountTradeId: body.accountTradeId ?? null,
        backtestTradeId: body.backtestTradeId ?? null,
        sessionId: body.sessionId ?? null,
        requestId: body.requestId,
      })
      .returning();
    return created;
  });
  res.status(201).json(evidenceDTO(result));
});
router.post("/process/improvements", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(
    z
      .object({
        methodVersionId: uuid,
        recapId: z.number().int().positive(),
        action: nonempty,
        criterion: nonempty,
        requestId: uuid,
      })
      .strict(),
    req.body,
  );
  const result = await db.transaction(async (tx) => {
    await lock(tx, userId);
    await ownedMethod(tx, userId, body.methodVersionId);
    const [recap] = await tx
      .select()
      .from(journalRecapsTable)
      .where(and(eq(journalRecapsTable.userId, userId), eq(journalRecapsTable.id, body.recapId)));
    if (!recap) throw new ProcessError(404, "Revisione non trovata");
    if (!recap.overallJudgment.trim() || !recap.improvements.trim())
      throw new ProcessError(
        400,
        "Salva giudizio e miglioramenti nella revisione prima di scegliere il focus",
      );
    const [retry] = await tx
      .select()
      .from(processImprovementsTable)
      .where(
        and(
          eq(processImprovementsTable.userId, userId),
          eq(processImprovementsTable.requestId, body.requestId),
        ),
      );
    if (retry) return retry;
    const [existing] = await tx
      .select()
      .from(processImprovementsTable)
      .where(
        and(
          eq(processImprovementsTable.userId, userId),
          eq(processImprovementsTable.methodVersionId, body.methodVersionId),
          eq(processImprovementsTable.recapId, body.recapId),
        ),
      );
    if (existing) {
      const [confirmedReview] = await tx.select().from(processReviewsTable)
        .where(and(eq(processReviewsTable.userId, userId), or(eq(processReviewsTable.improvementId, existing.id), eq(processReviewsTable.previousImprovementId, existing.id))));
      if (confirmedReview) {
        if (existing.action === body.action && existing.criterion === body.criterion) return existing;
        throw new ProcessError(409, "Il miglioramento della revisione confermata conserva il criterio originale");
      }
      const [updated] = await tx
        .update(processImprovementsTable)
        .set({ action: body.action, criterion: body.criterion })
        .where(eq(processImprovementsTable.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(processImprovementsTable)
      .values({ id: randomUUID(), userId, ...body })
      .returning();
    return created;
  });
  const [recap] = await db
    .select()
    .from(journalRecapsTable)
    .where(and(eq(journalRecapsTable.id, result.recapId), eq(journalRecapsTable.userId, userId)));
  res.status(201).json({
    ...result,
    createdAt: result.createdAt.toISOString(),
    recapKind: recap.kind,
    periodStart: recap.periodStart,
    periodEnd: recap.periodEnd,
  });
});
router.delete("/process/sessions/:id", async (req, res) => {
  const userId = getUserId(req)!;
  const id = parse(uuid, req.params.id);
  const revision = parse(z.coerce.number().int().nonnegative(), req.query.expectedRevision);
  await db.transaction(async tx => {
    await lock(tx, userId);
    const [session] = await tx.select().from(processSessionsTable)
      .where(and(eq(processSessionsTable.userId, userId), eq(processSessionsTable.id, id)));
    if (!session) return;
    const [evidence] = await tx.select().from(processEvidenceTable)
      .where(eq(processEvidenceTable.sessionId, id)).limit(1);
    if (session.revision !== revision || session.state !== "preparation" || session.preparedAt || evidence)
      throw new ProcessError(409, "La sessione contiene lavoro confermato oppure una bozza più recente");
    await tx.delete(processSessionsTable).where(eq(processSessionsTable.id, id));
  });
  res.status(204).end();
});

router.post("/process/reviews", async (req, res) => {
  const userId = getUserId(req)!;
  const body = parse(z.object({
    methodVersionId: uuid,
    kind: z.enum(["weekly", "four_week"]),
    periodStart: date, periodEnd: date,
    judgment: nonempty, action: nonempty, criterion: nonempty,
    previousImprovementOutcome: z.enum(["met", "not_met", "unassessable"]).optional(),
    previousImprovementNote: z.string().trim().max(4000).optional(),
    requestId: uuid,
  }).strict(), req.body);
  const review = await db.transaction(async tx => {
    await lock(tx, userId);
    const method = methodDTO(await ownedMethod(tx, userId, body.methodVersionId));
    const [retry] = await tx.select().from(processReviewsTable)
      .where(and(eq(processReviewsTable.userId, userId), eq(processReviewsTable.requestId, body.requestId)));
    if (retry) {
      if (!isDeepStrictEqual(retry.requestSnapshot, body)) throw new ProcessError(409, "La richiesta identifica una revisione diversa");
      return retry;
    }
    const current = await state(tx, userId);
    if (current.activeMethod?.id !== method.id || !["apply", "consolidate"].includes(method.phase))
      throw new ProcessError(409, "La revisione riguarda il metodo attivo in applicazione");
    if (current.session?.preparedAt && current.session.state !== "closed")
      throw new ProcessError(409, "Completa la sessione già operativa prima della revisione");
    const due = current.pendingReviews?.find(period => reviewPeriodKey(period) === reviewPeriodKey(body));
    if (!due || !validateJournalRecapPeriod(body.kind, body.periodStart, body.periodEnd))
      throw new ProcessError(409, "Questo periodo non richiede una nuova conferma di revisione");
    const previous = current.improvement && !(current.improvement.recapKind === due.kind &&
      current.improvement.periodStart === due.periodStart && current.improvement.periodEnd === due.periodEnd)
      ? current.improvement : null;
    if (previous && (!body.previousImprovementOutcome ||
      (body.previousImprovementOutcome !== "met" && !body.previousImprovementNote?.trim())))
      throw new ProcessError(400, "Valuta il criterio della correzione precedente e spiega un esito non verificato");
    let [recap] = await tx.select().from(journalRecapsTable).where(and(
      eq(journalRecapsTable.userId, userId), eq(journalRecapsTable.kind, body.kind),
      eq(journalRecapsTable.periodStart, body.periodStart), eq(journalRecapsTable.periodEnd, body.periodEnd)));
    // Existing historical recaps are read, never retrospectively rewritten.
    if (!recap) [recap] = await tx.insert(journalRecapsTable).values({
      userId, kind: body.kind, periodStart: body.periodStart, periodEnd: body.periodEnd,
      overallJudgment: body.judgment, improvements: body.action,
    }).returning();
    let [improvement] = await tx.select().from(processImprovementsTable).where(and(
      eq(processImprovementsTable.userId, userId), eq(processImprovementsTable.methodVersionId, method.id),
      eq(processImprovementsTable.recapId, recap.id)));
    if (improvement) [improvement] = await tx.update(processImprovementsTable)
      .set({ action: body.action, criterion: body.criterion }).where(eq(processImprovementsTable.id, improvement.id)).returning();
    else [improvement] = await tx.insert(processImprovementsTable).values({
      id: randomUUID(), userId, methodVersionId: method.id, recapId: recap.id,
      action: body.action, criterion: body.criterion, requestId: body.requestId,
    }).returning();
    const assessment = assessProcessReview(method, current.evidence, current.sessions ?? []);
    const [confirmed] = await tx.insert(processReviewsTable).values({
      id: randomUUID(), userId, methodVersionId: method.id, recapId: recap.id,
      improvementId: improvement.id, kind: body.kind, periodStart: body.periodStart, periodEnd: body.periodEnd,
      coveredPeriods: due.coveredPeriods, judgment: body.judgment, action: body.action, criterion: body.criterion,
      previousImprovementId: previous?.id ?? null,
      previousImprovementOutcome: previous ? body.previousImprovementOutcome ?? null : null,
      previousImprovementNote: body.previousImprovementNote ?? "",
      decision: assessment.decision, checks: assessment.checks, report: assessment.report,
      requestId: body.requestId, requestSnapshot: body,
    }).returning();
    return confirmed;
  });
  res.status(201).json(reviewDTO(review));
});

router.use(
  (
    error: unknown,
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    if (error instanceof ProcessError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  },
);
export default router;
