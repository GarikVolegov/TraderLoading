import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { journalEntriesTable, journalImagesTable, journalRecapsTable, journalTagsTable, missionsTable, profileTable } from "@workspace/db";
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
import { getUploadsDir } from "../lib/uploads.js";

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

  const results = await Promise.all(entries.map((e) => getEntryWithImages(e.id, userId)));
  res.json(results.filter(Boolean));
});

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

  const data = await getEntryWithImages(entry.id, userId);
  res.status(201).json(data);
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
