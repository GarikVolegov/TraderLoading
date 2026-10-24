import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { journalEntriesTable, journalImagesTable, journalRecapsTable, journalTagsTable, missionsTable, profileTable, accountTradesTable, marketDecisionsTable } from "@workspace/db";
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
import { eq, desc, and, or, isNull, inArray, sql } from "drizzle-orm";
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
import { imageMatchesType } from "../lib/imageValidation.js";
import { tradingDay } from "../lib/tradingTime.js";
import { consumeQuota } from "../lib/userQuota.js";

const router: IRouter = Router();
const JOURNAL_XP_REWARD = 75;

type DailyMissionSeed = {
  title: string;
  description: string;
  xpReward: number;
};

const DAILY_MISSIONS: DailyMissionSeed[] = [];
type JournalConnection = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
const recapKinds = ["weekly", "four_week"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const recapDate = z.string().regex(ISO_DATE_RE).refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

const JournalRecapQuery = z.object({
  kind: z.enum(recapKinds),
  periodStart: recapDate,
  periodEnd: recapDate,
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
    if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
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

async function saveJournalTags(userId: string | null, tags: string | null | undefined, conn: JournalConnection = db) {
  const normalizedTags = normalizeJournalTags(tags);
  if (normalizedTags.length === 0) return;

  const tagKeys = normalizedTags.map(journalTagKey);
  const existing = await conn
    .select({ tagKey: journalTagsTable.tagKey })
    .from(journalTagsTable)
    .where(and(journalTagUserFilter(userId), inArray(journalTagsTable.tagKey, tagKeys)));

  const existingKeys = new Set(existing.map((tag) => tag.tagKey));
  const missingTags = normalizedTags.filter((tag) => !existingKeys.has(journalTagKey(tag)));
  if (missingTags.length === 0) return;

  await conn
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
  manualTrade?: typeof accountTradesTable.$inferSelect,
) {
  return {
    ...(manualTrade ? { manualTrade: {
      accountTradeId: manualTrade.id,
      executionEnvironment: manualTrade.executionEnvironment,
      symbol: manualTrade.symbol, direction: manualTrade.direction,
      entryPrice: Number(manualTrade.entryPrice), exitPrice: Number(manualTrade.exitPrice),
      stopLoss: manualTrade.stopLoss === null ? null : Number(manualTrade.stopLoss), profit: Number(manualTrade.profit),
    }} : {}),
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

  const [trade] = userId ? await db.select().from(accountTradesTable).where(and(
    eq(accountTradesTable.userId, userId), eq(accountTradesTable.ticket, `manual-${id}`), eq(accountTradesTable.source, "manual"),
  )).limit(1) : [];
  const [decision] = userId ? await db.select({id:marketDecisionsTable.id}).from(marketDecisionsTable).where(and(eq(marketDecisionsTable.userId,userId),eq(marketDecisionsTable.journalEntryId,id))).limit(1) : [];
  return {...serializeJournalEntry(entry, images, trade),marketDecisionId:decision?.id??null};
}

async function ensureTodayMissionsExist(userId: string | null, conn: JournalConnection) {
  if (DAILY_MISSIONS.length === 0) return;
  const today = tradingDay(new Date())!;
  const existing = await conn.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), missionUserFilter(userId)));
  if (existing.length === 0) {
    await conn.insert(missionsTable).values(
      DAILY_MISSIONS.map((m) => ({ ...m, completed: false, missionDate: today, userId }))
    );
  }
}

async function awardJournalXP(userId: string | null, profileId: number, conn: JournalConnection) {
  await conn.update(profileTable).set({ xp: sql`${profileTable.xp} + ${JOURNAL_XP_REWARD}` }).where(eq(profileTable.id, profileId));

  await ensureTodayMissionsExist(userId, conn);

  const today = tradingDay(new Date())!;
  const [journalingMission] = await conn
    .select()
    .from(missionsTable)
    .where(and(
      eq(missionsTable.title, "Journaling del Trade"),
      eq(missionsTable.missionDate, today),
      eq(missionsTable.completed, false),
      missionUserFilter(userId),
    ));

  if (journalingMission) {
    await conn.update(missionsTable)
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

  const trades = userId ? await db.select().from(accountTradesTable).where(and(
    eq(accountTradesTable.userId, userId), eq(accountTradesTable.source, "manual"),
    inArray(accountTradesTable.journalEntryId, entries.map(entry => entry.id)),
  )) : [];
  const tradesByEntry = new Map(trades.filter(trade => trade.ticket === `manual-${trade.journalEntryId}`).map(trade => [trade.journalEntryId, trade]));
  res.json(entries.map((entry) => serializeJournalEntry(entry, imagesByEntry.get(entry.id) ?? [], tradesByEntry.get(entry.id))));
});

/** Keep a manual entry's structured trade (off-contract fields on the body) in sync
 *  with accountTrades so the coach/edge/equity see it (finding 3.5). Upserts on the
 *  entry-keyed ticket, or removes the row when the fields are cleared/insufficient. */
async function syncManualTrade(userId: string | null, entryId: number, tradeDate: string, rawBody: unknown, conn: JournalConnection = db): Promise<void> {
  if (!userId) return;
  // A body without any trade fields (a plain-text edit) leaves the linked trade
  // untouched — never let editing a note silently delete its coach trade.
  if (!hasTradeIntent(rawBody)) return;
  const ticket = `manual-${entryId}`;
  const row = buildManualTradeRow((rawBody ?? {}) as ManualTradeInput, { userId, journalEntryId: entryId, tradeDate });
  if (!row) {
    await conn.delete(accountTradesTable).where(
      and(eq(accountTradesTable.source, "manual"), eq(accountTradesTable.ticket, ticket), eq(accountTradesTable.userId, userId)),
    );
    return;
  }
  const [existing] = await conn.select().from(accountTradesTable).where(and(
    eq(accountTradesTable.source, "manual"), eq(accountTradesTable.ticket, ticket), eq(accountTradesTable.userId, userId),
  )).limit(1);
  const values = { ...row, journalEntryId: entryId, updatedAt: new Date() };
  const raw = rawBody as Record<string, unknown>;
  if (!existing) {
    // Older clients can still record facts; an omitted declaration cannot
    // become qualifying simulation or live evidence.
    values.executionEnvironment = z.enum(["simulation", "real", "unknown"]).default("unknown").parse(raw.executionEnvironment);
  }
  if (existing) {
    if (existing.executionEnvironment !== "unknown" || !("executionEnvironment" in raw)) {
      values.executionEnvironment = existing.executionEnvironment;
    }
    // The edit form exposes price/risk/P&L, not fees, volume or exact timestamps.
    // Preserve those fields unless this request explicitly supplied them.
    if (!("volume" in raw)) values.volume = existing.volume ?? row.volume;
    for (const key of ["commission", "swap", "takeProfit"] as const) {
      if (!(key in raw)) values[key] = existing[key];
    }
    for (const key of ["openTime", "closeTime"] as const) {
      if (!(key in raw) && existing[key] && !/^\d{4}-\d{2}-\d{2}$/.test(existing[key]!)) values[key] = existing[key]!;
    }
  }
  await conn
    .insert(accountTradesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [accountTradesTable.source, accountTradesTable.ticket, accountTradesTable.userId],
      set: {
        ...values,
        executionEnvironment: sql`CASE WHEN ${accountTradesTable.executionEnvironment} = 'unknown' THEN excluded.execution_environment ELSE ${accountTradesTable.executionEnvironment} END`,
      },
    });
}

const JournalCoreInput = z.object({
  title: z.string().trim().min(1).max(200),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
});
const ManualJournalInput = z.object({
  executionEnvironment: z.enum(["simulation", "real", "unknown"]).optional(),
  symbol: z.string().trim().min(1).max(32),
  direction: z.enum(["buy", "sell"]).optional(),
  entryPrice: z.number().finite().positive().lt(1e9),
  exitPrice: z.number().finite().positive().lt(1e9),
  profit: z.number().finite().gt(-1e12).lt(1e12),
  stopLoss: z.number().finite().positive().lt(1e9).nullable().optional(),
});
function validateJournalWrite(raw: unknown) {
  JournalCoreInput.parse(raw);
  if (hasTradeIntent(raw)) ManualJournalInput.parse(raw);
}

export async function linkMarketDecision(conn: JournalConnection, userId: string | null, entryId: number, raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>).marketDecisionId : undefined;
  if(value===undefined || value===null) return;
  const id=z.string().uuid().parse(value);
  if(!userId) throw Object.assign(new Error("Not found"),{status:404});
  const [entry]=await conn.select({id:journalEntriesTable.id}).from(journalEntriesTable).where(and(eq(journalEntriesTable.id,entryId),eq(journalEntriesTable.userId,userId))).limit(1);
  if(!entry)throw Object.assign(new Error("Not found"),{status:404});
  const [linked]=await conn.update(marketDecisionsTable).set({journalEntryId:entryId})
    .where(and(eq(marketDecisionsTable.id,id),eq(marketDecisionsTable.userId,userId),
      or(isNull(marketDecisionsTable.journalEntryId),eq(marketDecisionsTable.journalEntryId,entryId)))).returning();
  if(!linked) throw Object.assign(new Error("Not found"),{status:404});
}

router.post("/journal", async (req, res) => {
  const userId = getUserId(req);
  const body = CreateJournalEntryBody.parse(req.body);
  validateJournalWrite(req.body);
  const profile = await getOrCreateProfile(userId);
  const entry = await db.transaction(async (tx) => {
    const [created] = await tx.insert(journalEntriesTable).values({
      title: body.title, content: body.content, tradeDate: body.tradeDate,
      result: body.result, tags: serializeJournalTags(body.tags), userId,
    }).returning();
    await saveJournalTags(userId, body.tags, tx);
    await syncManualTrade(userId, created.id, body.tradeDate, req.body, tx);
    await linkMarketDecision(tx,userId,created.id,req.body);
    await awardJournalXP(userId, profile.id, tx);
    return created;
  });
  res.status(201).json(await getEntryWithImages(entry.id, userId));
});

// Adversarial-review finding: unbounded rows + one sequential awaited DB round-trip
// per row let a single large CSV drive tens of thousands of blocking queries against
// the shared Postgres pool. Reject oversized imports outright and batch the rest.
const MAX_IMPORT_ROWS = 2000;
const IMPORT_UPSERT_CHUNK = 500;

// Import a broker statement CSV → closed trades that feed the coach (idea 5D).
// Persisted as source="manual" (user-provided → excluded from tornei) with a
// csv-<ticket> key so re-importing the same statement updates instead of duplicating.
router.post("/journal/import-csv", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  if (!csv.trim()) { res.status(400).json({ error: "CSV vuoto" }); return; }
  const executionEnvironment = z.enum(["simulation", "real", "unknown"]).default("unknown").parse(req.body?.executionEnvironment);

  const { trades, skipped } = parseTradesCsv(csv);
  if (trades.length > MAX_IMPORT_ROWS) {
    res.status(413).json({ error: `CSV troppo grande: massimo ${MAX_IMPORT_ROWS} righe per import` });
    return;
  }
  const today = tradingDay(new Date())!;
  let invalid = 0;
  const rows: (typeof accountTradesTable.$inferInsert)[] = [];
  for (let i = 0; i < trades.length; i += 1) {
    const t = trades[i];
    const ticket = `csv-${t.ticket && t.ticket.trim() ? t.ticket.trim() : String(i + 1)}`;
    const tradeDate = t.closeTime || t.openTime || today;
    const row = buildTradeRow({ ...t, executionEnvironment }, { userId, source: "manual", ticket, tradeDate });
    if (!row) { invalid += 1; continue; }
    rows.push({ ...row, updatedAt: new Date() });
  }

  // A statement may repeat a ticket; keep its last row, as a later re-import would.
  const uniqueRows = [...new Map(rows.map(row => [row.ticket, row])).values()];
  let imported = 0;
  await db.transaction(async tx => {
  for (let i = 0; i < uniqueRows.length; i += IMPORT_UPSERT_CHUNK) {
    const slice = uniqueRows.slice(i, i + IMPORT_UPSERT_CHUNK);
    await tx
      .insert(accountTradesTable)
      .values(slice)
      .onConflictDoUpdate({
        target: [accountTradesTable.source, accountTradesTable.ticket, accountTradesTable.userId],
        set: {
          symbol: sql`excluded.symbol`,
          direction: sql`excluded.direction`,
          volume: sql`excluded.volume`,
          openTime: sql`excluded.open_time`,
          closeTime: sql`excluded.close_time`,
          entryPrice: sql`excluded.entry_price`,
          exitPrice: sql`excluded.exit_price`,
          stopLoss: sql`excluded.stop_loss`,
          takeProfit: sql`excluded.take_profit`,
          profit: sql`excluded.profit`,
          commission: sql`excluded.commission`,
          swap: sql`excluded.swap`,
          status: sql`excluded.status`,
          executionEnvironment: sql`CASE WHEN ${accountTradesTable.executionEnvironment} = 'unknown' THEN excluded.execution_environment ELSE ${accountTradesTable.executionEnvironment} END`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    imported += slice.length;
  }
  });
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

  // The unique period key also arbitrates concurrent first saves. A preceding
  // SELECT cannot prevent two requests from both attempting the initial INSERT.
  const [saved] = await db.insert(journalRecapsTable).values(values)
    .onConflictDoUpdate({
      target: [journalRecapsTable.userId, journalRecapsTable.kind, journalRecapsTable.periodStart, journalRecapsTable.periodEnd],
      set: values,
    }).returning();

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

  validateJournalWrite(req.body);
  const updated = await db.transaction(async (tx) => {
  const [row] = await tx
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

  if (!row) return null;
  await saveJournalTags(userId, body.tags, tx);
  await syncManualTrade(userId, id, body.tradeDate, req.body, tx);
  await linkMarketDecision(tx,userId,id,req.body);
  return row;
  });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
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

  await db.transaction(async tx => {
    if (userId) {
      await tx.delete(accountTradesTable).where(and(
        eq(accountTradesTable.source, "manual"), eq(accountTradesTable.ticket, `manual-${id}`), eq(accountTradesTable.userId, userId),
      ));
    }
    await tx.delete(journalEntriesTable).where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
  });
  for (const img of images) {
    await fs.promises.unlink(path.join(UPLOADS_DIR, img.filePath)).catch(error => {
      if (error.code !== "ENOENT") logger.warn({ error }, "Journal file cleanup failed");
    });
  }
  res.json({ success: true });
});

router.post(
  "/journal/:id/images",
  async (req, res, next) => {
    const { id } = UploadJournalImageParams.parse({ id: Number(req.params.id) });
    const [owned] = await db.select({ id: journalEntriesTable.id }).from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), entryUserFilter(getUserId(req))));
    if (!owned) { res.status(404).json({ error: "Entry not found" }); return; }
    next();
  },
  upload.single("image"),
  async (req, res) => {
    const userId = getUserId(req);
    const { id } = UploadJournalImageParams.parse({ id: Number(req.params.id) });

    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)));
    if (!entry) {
      if (req.file) await fs.promises.unlink(req.file.path);
      res.status(404).json({ error: "Entry not found" }); return;
    }

    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const bytes = await fs.promises.readFile(req.file.path);
    if (!imageMatchesType(bytes, req.file.mimetype, req.file.originalname)) {
      await fs.promises.unlink(req.file.path);
      res.status(415).json({ error: "Upload a PNG, JPEG, GIF or WebP image" }); return;
    }
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

const serveJournalImage: RequestHandler = async (req, res, next) => {
  const filename = String(req.params.filename);
  if (filename !== path.basename(filename) || filename.startsWith(".")) {
    res.status(404).json({ error: "Not found" }); return;
  }
  const [image] = await db.select({ userId: journalEntriesTable.userId })
    .from(journalImagesTable).innerJoin(journalEntriesTable, eq(journalImagesTable.entryId, journalEntriesTable.id))
    .where(eq(journalImagesTable.filePath, filename)).limit(1);
  if (!image && req.path.startsWith("/uploads/")) { next(); return; }
  if (!image) {
    res.status(404).json({ error: "Not found" }); return;
  }
  const currentUserId = getUserId(req);
  if (image.userId && currentUserId && image.userId !== currentUserId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=86400");
  // Older uploads may contain active formats: never execute them inline.
  if (!/\.(png|jpe?g|gif|webp)$/i.test(filename)) res.attachment(filename);
  res.sendFile(filename, { root: UPLOADS_DIR }, error => {
    if (error) next(error);
  });
};
router.get("/journal/image/:filename", serveJournalImage);
// Guard the legacy static alias too; knowing the filename grants no access.
router.get("/uploads/:filename", serveJournalImage);

export default router;
