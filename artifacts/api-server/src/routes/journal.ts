import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { journalEntriesTable, journalImagesTable, missionsTable, profileTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
  UpdateJournalEntryParams,
  DeleteJournalEntryParams,
  GetJournalEntryParams,
  UploadJournalImageParams,
  DeleteJournalImageParams,
} from "@workspace/api-zod";
import { eq, desc, and, isNull } from "drizzle-orm";
import { getUserId, getOrCreateProfile, computeLevel } from "./profile.js";

const router: IRouter = Router();
const JOURNAL_XP_REWARD = 75;

type DailyMissionSeed = {
  title: string;
  description: string;
  xpReward: number;
};

const DAILY_MISSIONS: DailyMissionSeed[] = [];

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
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

function missionUserFilter(userId: string | null) {
  return userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
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
      tags: body.tags ?? null,
      userId,
    })
    .returning();

  await awardJournalXP(userId);

  const data = await getEntryWithImages(entry.id, userId);
  res.status(201).json(data);
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
      tags: body.tags ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(journalEntriesTable.id, id), entryUserFilter(userId)))
    .returning();

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

router.get("/journal/tags", async (req, res) => {
  const userId = getUserId(req);
  const entries = await db
    .select({ tags: journalEntriesTable.tags })
    .from(journalEntriesTable)
    .where(entryUserFilter(userId));

  const freq = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.tags) continue;
    for (const raw of entry.tags.split(",")) {
      const tag = raw.trim();
      if (tag) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }

  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));

  res.json(sorted);
});

router.get("/journal/image/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

export default router;
