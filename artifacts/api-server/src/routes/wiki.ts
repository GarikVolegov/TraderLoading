import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  wikiIngestJobsTable,
  wikiSourcesTable,
} from "@workspace/db";
import { getUserId } from "./profile.js";
import { classifyWikiFile, fetchUrlText, validateWikiUploadContent } from "../services/wikiProcessor.js";
import { createWikiStorageFromEnv } from "../services/wikiStorage.js";
import { enqueueWikiSourceProcessing, processWikiSourceJob } from "../services/wikiIngest.js";
import { getWikiGraph, queryWiki } from "../services/wikiGraph.js";
import { requireProFeature } from "../lib/billing.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
});

async function requireWikiUser(req: Request, res: Response): Promise<string | null> {
  if (!(await requireProFeature(req, res, "wiki"))) return null;
  const userId = getUserId(req);
  return userId;
}

function parseTags(input: unknown): string {
  if (Array.isArray(input)) return JSON.stringify(input.map(String).filter(Boolean));
  if (typeof input === "string" && input.trim()) {
    return JSON.stringify(input.split(",").map((tag) => tag.trim()).filter(Boolean));
  }
  return "[]";
}

router.get("/wiki/sources", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const rows = await db.select().from(wikiSourcesTable)
    .where(eq(wikiSourcesTable.userId, userId))
    .orderBy(desc(wikiSourcesTable.createdAt));
  res.json(rows);
});

router.post("/wiki/sources/text", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const { title, content, tags } = req.body as { title?: string; content?: string; tags?: unknown };
  if (!content?.trim()) {
    res.status(400).json({ error: "content obbligatorio" });
    return;
  }
  const [source] = await db.insert(wikiSourcesTable).values({
    userId,
    kind: "text",
    title: title?.trim() || "Nota wiki",
    status: "queued",
    extractedText: content.trim(),
    tags: parseTags(tags),
  }).returning();
  await db.insert(wikiIngestJobsTable).values({ userId, sourceId: source.id, status: "queued", stage: "queued" });
  enqueueWikiSourceProcessing(source.id);
  res.status(202).json(source);
});

router.post("/wiki/sources/upload", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  upload.single("file")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message ?? "Upload fallito" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Nessun file caricato" });
      return;
    }
    try {
      const kind = classifyWikiFile(req.file.originalname, req.file.mimetype);
      const uploadError = validateWikiUploadContent({ kind, filename: req.file.originalname, buffer: req.file.buffer });
      if (uploadError) {
        res.status(400).json({ error: uploadError });
        return;
      }
      const storage = createWikiStorageFromEnv();
      const stored = await storage.put({
        userId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      });
      const [source] = await db.insert(wikiSourcesTable).values({
        userId,
        kind,
        title: String(req.body?.title || req.file.originalname).trim(),
        status: "queued",
        storageProvider: stored.provider,
        storageKey: stored.key,
        fileUrl: stored.url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        tags: parseTags(req.body?.tags),
      }).returning();
      await db.insert(wikiIngestJobsTable).values({ userId, sourceId: source.id, status: "queued", stage: "queued" });
      enqueueWikiSourceProcessing(source.id, req.file.buffer);
      res.status(202).json(source);
    } catch (storageErr) {
      const message = storageErr instanceof Error ? storageErr.message : String(storageErr);
      res.status(500).json({ error: message });
    }
  });
});

router.post("/wiki/sources/url", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const { url, title, tags } = req.body as { url?: string; title?: string; tags?: unknown };
  if (!url?.trim()) {
    res.status(400).json({ error: "url obbligatorio" });
    return;
  }
  try {
    const fetched = await fetchUrlText(url.trim());
    const [source] = await db.insert(wikiSourcesTable).values({
      userId,
      kind: "url",
      title: title?.trim() || fetched.title,
      status: "queued",
      originalUrl: url.trim(),
      extractedText: fetched.text,
      tags: parseTags(tags),
    }).returning();
    await db.insert(wikiIngestJobsTable).values({ userId, sourceId: source.id, status: "queued", stage: "queued" });
    enqueueWikiSourceProcessing(source.id);
    res.status(202).json(source);
  } catch (urlErr) {
    const message = urlErr instanceof Error ? urlErr.message : String(urlErr);
    res.status(400).json({ error: message });
  }
});

router.delete("/wiki/sources/:id", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  const [source] = await db.select().from(wikiSourcesTable)
    .where(and(eq(wikiSourcesTable.id, id), eq(wikiSourcesTable.userId, userId)))
    .limit(1);
  if (!source) {
    res.status(404).json({ error: "Sorgente non trovata" });
    return;
  }
  await db.delete(wikiSourcesTable).where(and(eq(wikiSourcesTable.id, id), eq(wikiSourcesTable.userId, userId)));
  if (source.storageKey) {
    await createWikiStorageFromEnv().delete(source.storageKey).catch(() => {});
  }
  res.json({ ok: true });
});

router.get("/wiki/graph", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  res.json(await getWikiGraph(userId));
});

router.get("/wiki/communities", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const graph = await getWikiGraph(userId);
  res.json(graph.communities);
});

router.post("/wiki/query", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const question = String(req.body?.question ?? "").trim();
  if (!question) {
    res.status(400).json({ error: "question obbligatoria" });
    return;
  }
  res.json(await queryWiki(userId, question));
});

router.post("/wiki/reindex", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const sources = await db.select().from(wikiSourcesTable).where(eq(wikiSourcesTable.userId, userId));
  for (const source of sources) {
    await db.insert(wikiIngestJobsTable).values({ userId, sourceId: source.id, status: "queued", stage: "queued" });
    enqueueWikiSourceProcessing(source.id);
  }
  res.json({ ok: true, reindexed: sources.length });
});

export { processWikiSourceJob };
export default router;
