import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { journalEntriesTable, journalImagesTable, journalRecapsTable, journalTagsTable, missionsTable, profileTable, accountTradesTable } from "@workspace/db";
import { buildManualTradeRow, buildTradeRow, hasTradeIntent, type ManualTradeInput } from "../services/manualTrade.js";
import { parseTradesCsv } from "../services/tradesCsv.js";
import {
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
  UpdateJournalEntryParams,
  DeleteJournalEntryParams,
  GetJournalEntryParams,
  UploadJournalImageParams,
  DeleteJournalImageParams,
} from "@workspace/api-zod";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { getUserId, getOrCreateProfile } from "./profile.js";
import {
  getJournalRecapPeriodForDate,
  isJournalRecapPeriodEditable,
  validateJournalRecapPeriod,
  type JournalRecapKind,
} from "../services/journalRecapPeriods.js";
import { computeEdgeReport, rMultiple } from "../services/tradeAnalytics.js";
import { computeDisciplineReport } from "../services/tradeDiscipline.js";
import { composeEdgeReport } from "../services/edgeReport.js";
import { bootstrapRiskOfRuin } from "../services/edgeStats.js";
import { parseRiskOfRuinParams } from "../services/riskOfRuinParams.js";
import {
  alignSeriesByTime,
  correlationMatrix,
  concentrationSignals,
} from "../services/correlationMatrix.js";
import { getCandles } from "../services/candles.js";
import { loadClosedEdgeTrades, loadGuardOverrides, loadOpenPositions } from "../services/edgeData.js";
import { buildRecapMessages, filterTradesByPeriod, parseRecapDraft } from "../services/journalRecapDraft.js";
import { getUserNotificationLanguage } from "./push.js";
import { getTextClient } from "../services/llmClient.js";
import logger from "../lib/logger.js";
import { getUploadsDir } from "../lib/uploads.js";
import { consumeQuota } from "../lib/userQuota.js";

const router: IRouter = Router();
const JOURNAL_XP_REWARD = 75;

type DailyMissionSeed = {
  title: string;
  description: string;
  xpReward: number;
};

const DAILY_MISSIONS: DailyMissionSeed[] = [];
const recapKinds = ["weekly", "four_week"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const JournalRecapQuery = z.object({
  kind: z.enum(recapKinds),
  periodStart: z.string().regex(ISO_DATE_RE),
  periodEnd: z.string().regex(ISO_DATE_RE),
});

const JournalRecapBody = JournalRecapQuery.extend({
  overallJudgment: z.string().max(4000).default(""),
  wentWell: z.string().max(4000).default(""),
  wentWrong: z.string().max(4000).default(""),
  improvements: z.string().max(4000).default(""),
  patterns: z.string().max(4000).default(""),
  focusAreas: z.string().max(4000).default(""),
  nextPeriodExpectations: z.string().max(4000).default(""),
  nextPeriodGoals: z.string().max(4000).default(""),
});

export type JournalTagSummary = {
  tag: string;
  count: number;
};

const UPLOADS_DIR = getUploadsDir();
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

function entryUserFilter(userId: string | null) {
  return userId ? eq(journalEntriesTable.userId, userId) : isNull(journalEntriesTable.userId);
}

function journalTagUserFilter(userId: string | null) {
  return userId ? eq(journalTagsTable.userId, userId) : isNull(journalTagsTable.userId);
}

function recapUserFilter(userId: string | null) {
  return userId ? eq(journalRecapsTable.userId, userId) : isNull(journalRecapsTable.userId);
}

function missionUserFilter(userId: string | null) {
  return userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
}

function journalTagKey(tag: string) {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeJournalTags(tags: string | null | undefined): string[] {
  if (!tags) return [];

  const normalized = new Map<string, string>();
  for (const raw of tags.split(",")) {
    const tag = raw.trim().replace(/\s+/g, " ");
    const key = journalTagKey(tag);
    if (key && !normalized.has(key)) normalized.set(key, tag);
  }

  return Array.from(normalized.values());
}

export function serializeJournalTags(tags: string | null | undefined): string | null {
  const normalized = normalizeJournalTags(tags);
  return normalized.length > 0 ? normalized.join(", ") : null;
}

export function mergeJournalTagSummaries(
  entryTags: JournalTagSummary[],
  savedTags: string[],
): JournalTagSummary[] {
  const summaries = new Map<string, JournalTagSummary>();

  for (const savedTag of savedTags) {
    const [normalized] = normalizeJournalTags(savedTag);
    if (!normalized) continue;
    const key = journalTagKey(normalized);
    if (!summaries.has(key)) summaries.set(key, { tag: normalized, count: 0 });
  }

  for (const entryTag of entryTags) {
    const [normalized] = normalizeJournalTags(entryTag.tag);
    if (!normalized) continue;
    const key = journalTagKey(normalized);
    const existing = summaries.get(key);
    summaries.set(key, {
      tag: existing?.tag ?? normalized,
      count: (existing?.count ?? 0) + entryTag.count,
    });
  }

  return Array.from(summaries.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

export function summarizeJournalEntryTags(tagsList: Array<string | null | undefined>): JournalTagSummary[] {
  const summaries = new Map<string, JournalTagSummary>();

  for (const tags of tagsList) {
    for (const tag of normalizeJournalTags(tags)) {
      const key = journalTagKey(tag);
      const existing = summaries.get(key);
      summaries.set(key, {
        tag: existing?.tag ?? tag,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return Array.from(summaries.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

async function saveJournalTags(userId: string | null, tags: string | null | undefined) {
  const normalizedTags = normalizeJournalTags(tags);
  if (normalizedTags.length === 0) return;

  const tagKeys = normalizedTags.map(journalTagKey);
  const existing = await db
    .select({ tagKey: journalTagsTable.tagKey })
    .from(journalTagsTable)
    .where(and(journalTagUserFilter(userId), inArray(journalTagsTable.tagKey, tagKeys)));

  const existingKeys = new Set(existing.map((tag) => tag.tagKey));
  const missingTags = normalizedTags.filter((tag) => !existingKeys.has(journalTagKey(tag)));
  if (missingTags.length === 0) return;

  await db
    .insert(journalTagsTable)
    .values(missingTags.map((tag) => ({
      tag,
      tagKey: journalTagKey(tag),
      userId,
    })))
    .onConflictDoNothing();
}

type JournalEntrySerializable = Pick<
  typeof journalEntriesTable.$inferSelect,
  "id" | "title" | "content" | "tradeDate" | "result" | "tags" | "createdAt" | "updatedAt"
>;
type JournalImageSerializable = Pick<typeof journalImagesTable.$inferSelect, "id" | "filePath">;

/**
 * Map a journal entry row plus its already-loaded images to the API response
 * shape. Kept pure so the list endpoint can batch-load images in one query and
 * the single-entry endpoints can pass a one-row image set — both share one shape.
 */
export function serializeJournalEntry(
  entry: JournalEntrySerializable,
  images: JournalImageSerializable[],
) {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    tradeDate: entry.tradeDate,
    result: entry.result,
    tags: entry.tags,
    images: images.map((img) => ({
      id: img.id,
      url: `/api/journal/image/${img.filePath}`,
    })),
    createdAt: entry.createdAt!.toISOString(),
    updatedAt: entry.updatedAt!.toISOString(),
  };
}

async function getEntryWithImages(id: number, userId: string | null) {
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
  if (!entry) return null;

  const images = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.entryId, id));

  return serializeJournalEntry(entry, images);
}

async function ensureTodayMissionsExist(userId: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), missionUserFilter(userId)));
  if (existing.length === 0) {
    await db.insert(missionsTable).values(
      DAILY_MISSIONS.map((m) => ({ ...m, completed: false, missionDate: today, userId }))
    );
  }
}

async function awardJournalXP(userId: string | null) {
  const profile = await getOrCreateProfile(userId);
  const newXp = profile.xp + JOURNAL_XP_REWARD;
  await db.update(profileTable).set({ xp: newXp }).where(eq(profileTable.id, profile.id));

  await ensureTodayMissionsExist(userId);

  const today = new Date().toISOString().slice(0, 10);
  const [journalingMission] = await db
    .select()
    .from(missionsTable)
    .where(and(
      eq(missionsTable.title, "Journaling del Trade"),
      eq(missionsTable.missionDate, today),
      eq(missionsTable.completed, false),
      missionUserFilter(userId),
    ));

  if (journalingMission) {
    await db.update(missionsTable)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(missionsTable.id, journalingMission.id));
  }
}

router.get("/journal", async (req, res) => {
  const userId = getUserId(req);
  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(entryUserFilter(userId))
    .orderBy(desc(journalEntriesTable.createdAt));

  if (entries.length === 0) {
    res.json([]);
    return;
  }

  // Load every entry's images in a single query and group them by entry id,
  // instead of re-fetching each entry + its images one row at a time (the old
  // 2N+1 pattern that scaled linearly with a user's journal size).
  const images = await db
    .select()
    .from(journalImagesTable)
    .where(inArray(journalImagesTable.entryId, entries.map((entry) => entry.id)));

  const imagesByEntry = new Map<number, typeof images>();
  for (const image of images) {
    const bucket = imagesByEntry.get(image.entryId);
    if (bucket) bucket.push(image);
    else imagesByEntry.set(image.entryId, [image]);
  }

  res.json(entries.map((entry) => serializeJournalEntry(entry, imagesByEntry.get(entry.id) ?? [])));
});

/** Keep a manual entry's structured trade (off-contract fields on the body) in sync
 *  with accountTrades so the coach/edge/equity see it (finding 3.5). Upserts on the
 *  entry-keyed ticket, or removes the row when the fields are cleared/insufficient. */
async function syncManualTrade(userId: string | null, entryId: number, tradeDate: string, rawBody: unknown): Promise<void> {
  if (!userId) return;
  // A body without any trade fields (a plain-text edit) leaves the linked trade
  // untouched — never let editing a note silently delete its coach trade.
  if (!hasTradeIntent(rawBody)) return;
  const ticket = `manual-${entryId}`;
  const row = buildManualTradeRow((rawBody ?? {}) as ManualTradeInput, { userId, journalEntryId: entryId, tradeDate });
  if (!row) {
    await db.delete(accountTradesTable).where(
      and(eq(accountTradesTable.source, "manual"), eq(accountTradesTable.ticket, ticket), eq(accountTradesTable.userId, userId)),
    );
    return;
  }
  const values = { ...row, journalEntryId: entryId, updatedAt: new Date() };
  await db
    .insert(accountTradesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [accountTradesTable.source, accountTradesTable.ticket, accountTradesTable.userId],
      set: values,
    });
}

router.post("/journal", async (req, res) => {
  const userId = getUserId(req);
  const body = CreateJournalEntryBody.parse(req.body);

  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      title: body.title,
      content: body.content,
      tradeDate: body.tradeDate,
      result: body.result,
      tags: serializeJournalTags(body.tags),
      userId,
    })
    .returning();

  await saveJournalTags(userId, body.tags);
  await awardJournalXP(userId);
  await syncManualTrade(userId, entry.id, body.tradeDate, req.body);

  const data = await getEntryWithImages(entry.id, userId);
  res.status(201).json(data);
});

// Import a broker statement CSV → closed trades that feed the coach (idea 5D).
// Persisted as source="manual" (user-provided → excluded from tornei) with a
// csv-<ticket> key so re-importing the same statement updates instead of duplicating.
router.post("/journal/import-csv", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!csv.trim()) { res.status(400).json({ error: "CSV vuoto" }); return; }

  const { trades, skipped } = parseTradesCsv(csv);
  const today = new Date().toISOString().slice(0, 10);
  let imported = 0;
  let invalid = 0;
  for (let i = 0; i < trades.length; i += 1) {
    const t = trades[i];
    const ticket = `csv-${t.ticket && t.ticket.trim() ? t.ticket.trim() : String(i + 1)}`;
    const tradeDate = t.closeTime || t.openTime || today;
    const row = buildTradeRow(t, { userId, source: "manual", ticket, tradeDate });
    if (!row) { invalid += 1; continue; }
    const values = { ...row, updatedAt: new Date() };
    await db
      .insert(accountTradesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [accountTradesTable.source, accountTradesTable.ticket, accountTradesTable.userId],
        set: values,
      });
    imported += 1;
  }
  res.json({ imported, skipped: skipped + invalid });
});

router.get("/journal/tags", async (req, res) => {
  const userId = getUserId(req);
  const entries = await db
    .select({ tags: journalEntriesTable.tags })
    .from(journalEntriesTable)
    .where(entryUserFilter(userId));

  const entryTagSummaries = summarizeJournalEntryTags(entries.map((entry) => entry.tags));
  const savedTags = await db
    .select({ tag: journalTagsTable.tag })
    .from(journalTagsTable)
    .where(journalTagUserFilter(userId));

  res.json(mergeJournalTagSummaries(entryTagSummaries, savedTags.map((tag) => tag.tag)));
});

router.post("/journal/tags", async (req, res) => {
  const userId = getUserId(req);
  const rawTag = typeof req.body?.tag === "string" ? req.body.tag : "";
  const [tag] = normalizeJournalTags(rawTag);

  if (!tag) {
    res.status(400).json({ error: "Tag is required" });
    return;
  }

  await saveJournalTags(userId, tag);
  res.status(201).json({ tag, count: 0 });
});

router.get("/journal/recaps", async (req, res) => {
  const userId = getUserId(req);
  const query = JournalRecapQuery.parse(req.query);
  const [recap] = await db
    .select()
    .from(journalRecapsTable)
    .where(and(
      eq(journalRecapsTable.kind, query.kind),
      eq(journalRecapsTable.periodStart, query.periodStart),
      eq(journalRecapsTable.periodEnd, query.periodEnd),
      recapUserFilter(userId),
    ));

  res.json(recap ?? null);
});

router.put("/journal/recaps", async (req, res) => {
  const userId = getUserId(req);
  const body = JournalRecapBody.parse(req.body);
  const kind = body.kind as JournalRecapKind;

  if (!validateJournalRecapPeriod(kind, body.periodStart, body.periodEnd)) {
    res.status(400).json({ error: "Invalid recap period" });
    return;
  }

  const period = getJournalRecapPeriodForDate(kind, new Date(`${body.periodEnd}T00:00:00.000Z`));
  if (!isJournalRecapPeriodEditable(period, new Date())) {
    res.status(403).json({ error: "Recap editing window is closed" });
    return;
  }

  const values = {
    kind: body.kind,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    overallJudgment: body.overallJudgment.trim(),
    wentWell: body.wentWell.trim(),
    wentWrong: body.wentWrong.trim(),
    improvements: body.improvements.trim(),
    patterns: body.patterns.trim(),
    focusAreas: body.focusAreas.trim(),
    nextPeriodExpectations: body.nextPeriodExpectations.trim(),
    nextPeriodGoals: body.nextPeriodGoals.trim(),
    userId,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: journalRecapsTable.id })
    .from(journalRecapsTable)
    .where(and(
      eq(journalRecapsTable.kind, body.kind),
      eq(journalRecapsTable.periodStart, body.periodStart),
      eq(journalRecapsTable.periodEnd, body.periodEnd),
      recapUserFilter(userId),
    ));

  const [saved] = existing
    ? await db.update(journalRecapsTable).set(values).where(eq(journalRecapsTable.id, existing.id)).returning()
    : await db.insert(journalRecapsTable).values(values).returning();

  res.json(saved);
});

// Edge analytics: turns closed broker trades into a verdict (expectancy in R,
// win rate, net P&L by symbol/direction/session/day, post-loss revenge,
// behavioural discipline, and the risk-guard breakers). Read-only. Declared
// before "/journal/:id" so the literal path isn't captured as an id.
router.get("/journal/edge", async (req, res) => {
  const userId = getUserId(req);
  const [trades, guardOverrides] = await Promise.all([
    loadClosedEdgeTrades(userId),
    loadGuardOverrides(userId),
  ]);
  res.json(composeEdgeReport(trades, new Date(), guardOverrides));
});

// Monte Carlo risk-of-ruin bootstrapped from the user's OWN closed-trade R-multiples
// (idea 5B). Off-contract (direct apiJSON, like the recap endpoints). Params are
// clamped (parseRiskOfRuinParams) so the simulation can't be driven into a DoS.
router.post("/journal/risk-of-ruin", async (req, res) => {
  const userId = getUserId(req);
  const params = parseRiskOfRuinParams(req.body);
  const trades = await loadClosedEdgeTrades(userId);
  const rValues = trades
    .map((trade) => rMultiple(trade))
    .filter((r): r is number => r !== null);
  const result = bootstrapRiskOfRuin(rValues, params);
  if (!result) {
    res.status(422).json({ error: "Servono trade chiusi con R calcolabile (entry, stop ed exit)." });
    return;
  }
  res.json({ ...result, tradesWithR: rValues.length, params });
});

// Portfolio correlation & concentration risk over the user's OPEN positions (idea
// 5B). Off-contract. Pulls each symbol's D1 closes (SWR/cached via getCandles),
// aligns them by shared timestamp, then flags position pairs that compound into one
// bigger bet. Degrades gracefully: <2 symbols or missing candles → empty result.
router.get("/journal/correlation", async (req, res) => {
  const userId = getUserId(req);
  const positions = await loadOpenPositions(userId);
  const symbols = positions.map((p) => p.symbol).slice(0, 12); // cap the candle fan-out
  if (symbols.length < 2) {
    res.json({ symbols: [], matrix: [], window: 0, concentration: [], positions });
    return;
  }
  const series = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const result = await getCandles(symbol, "D1");
        return { symbol, bars: result.candles.map((c) => ({ time: c.time, close: c.close })) };
      } catch {
        return { symbol, bars: [] };
      }
    }),
  );
  const matrix = correlationMatrix(alignSeriesByTime(series));
  const active = positions.filter((p) => symbols.includes(p.symbol));
  res.json({ ...matrix, concentration: concentrationSignals(active, matrix), positions: active });
});

// Generates an AI recap draft from the period's edge + discipline stats. Returns
// the eight recap fields for the user to review/edit before saving via PUT.
// Degrades gracefully: 503 when no LLM provider is configured.
router.post("/journal/recaps/generate", async (req, res) => {
  const userId = getUserId(req);
  const body = JournalRecapQuery.parse(req.body);
  const kind = body.kind as JournalRecapKind;

  if (!validateJournalRecapPeriod(kind, body.periodStart, body.periodEnd)) {
    res.status(400).json({ error: "Invalid recap period" });
    return;
  }

  const trades = filterTradesByPeriod(await loadClosedEdgeTrades(userId), body.periodStart, body.periodEnd);
  if (trades.length === 0) {
    res.status(422).json({ error: "Nessun trade chiuso nel periodo selezionato." });
    return;
  }

  const textClient = getTextClient();
  if (!textClient) {
    res.status(503).json({ error: "Generazione AI non configurata." });
    return;
  }

  // Per-user daily cap on the (paid, billable) LLM call so a single user cannot
  // run up unbounded provider cost by looping the endpoint. Consumed only once we
  // are about to actually call the model. RECAP_DAILY_LIMIT overrides the default.
  const recapLimit = Number(process.env.RECAP_DAILY_LIMIT) || 10;
  const quota = await consumeQuota(`quota:recap:${userId ?? "guest"}`, recapLimit, 86_400);
  if (!quota.allowed) {
    res.status(429).json({
      error: `Limite giornaliero di recap AI raggiunto (${quota.limit}). Riprova domani.`,
    });
    return;
  }

  const recapLanguage = await getUserNotificationLanguage(userId);
  const { system, user } = buildRecapMessages(
    computeEdgeReport(trades),
    computeDisciplineReport(trades),
    { kind: body.kind, periodStart: body.periodStart, periodEnd: body.periodEnd },
    recapLanguage,
  );

  try {
    const completion = await textClient.client.chat.completions.create({
      model: textClient.model,
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "";
    if (!content.trim()) {
      res.status(502).json({ error: "Risposta AI vuota." });
      return;
    }
    res.json(parseRecapDraft(content));
  } catch (error) {
    logger.error({ err: error, userId }, "Recap generation failed");
    res.status(502).json({ error: "Generazione del recap non riuscita." });
  }
});

router.get("/journal/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = GetJournalEntryParams.parse({ id: Number(req.params.id) });
  const data = await getEntryWithImages(id, userId);
  if (!data) { res.status(404).json({ error: "Not found" }); return; }
  res.json(data);
});

router.put("/journal/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = UpdateJournalEntryParams.parse({ id: Number(req.params.id) });
  const body = UpdateJournalEntryBody.parse(req.body);

  const [updated] = await db
    .update(journalEntriesTable)
    .set({
      title: body.title,
      content: body.content,
      tradeDate: body.tradeDate,
      result: body.result,
      tags: serializeJournalTags(body.tags),
      updatedAt: new Date(),
    })
    .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await saveJournalTags(userId, body.tags);
  await syncManualTrade(userId, id, body.tradeDate, req.body);
  const data = await getEntryWithImages(id, userId);
  res.json(data);
});

router.delete("/journal/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = DeleteJournalEntryParams.parse({ id: Number(req.params.id) });

  const [entry] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  const images = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.entryId, id));

  for (const img of images) {
    const filePath = path.join(UPLOADS_DIR, img.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  // Drop the linked manual trade too, so the coach doesn't keep a deleted entry's trade.
  if (userId) {
    await db.delete(accountTradesTable).where(
      and(eq(accountTradesTable.source, "manual"), eq(accountTradesTable.ticket, `manual-${id}`), eq(accountTradesTable.userId, userId)),
    );
  }
  res.json({ success: true });
});

router.post(
  "/journal/:id/images",
  upload.single("image"),
  async (req, res) => {
    const userId = getUserId(req);
    const { id } = UploadJournalImageParams.parse({ id: Number(req.params.id) });

    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
    if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }

    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const [img] = await db
      .insert(journalImagesTable)
      .values({ entryId: id, filePath: req.file.filename })
      .returning();

    res.json({ image: { id: img.id, url: `/api/journal/image/${img.filePath}` } });
  }
);

router.delete("/journal/:id/images/:imageId", async (req, res) => {
  const userId = getUserId(req);
  const { id, imageId } = DeleteJournalImageParams.parse({
    id: Number(req.params.id),
    imageId: Number(req.params.imageId),
  });

  const [entry] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  const [img] = await db
    .select()
    .from(journalImagesTable)
    .where(eq(journalImagesTable.id, imageId));

  if (!img || img.entryId !== id) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, img.filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.delete(journalImagesTable).where(eq(journalImagesTable.id, imageId));
  res.json({ success: true });
});

router.get("/journal/image/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

export default router;
