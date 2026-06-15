import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  wikiFoldersTable,
  wikiIngestJobsTable,
  wikiSourcesTable,
  type WikiFolder,
} from "@workspace/db";
import { getUserId } from "./profile.js";
import {
  classifyWikiFile,
  fetchUrlText,
  getWikiUploadLimitBytes,
  validateWikiUploadContent,
} from "../services/wikiProcessor.js";
import { createWikiStorageFromEnv } from "../services/wikiStorage.js";
import { enqueueWikiSourceProcessing, processWikiSourceJob } from "../services/wikiIngest.js";
import { requireProFeature } from "../lib/billing.js";

const router: IRouter = Router();

const WIKI_UPLOAD_LIMIT_BYTES = getWikiUploadLimitBytes();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WIKI_UPLOAD_LIMIT_BYTES },
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
      const tooLarge = (err as { code?: string }).code === "LIMIT_FILE_SIZE";
      const limitMb = Math.floor(WIKI_UPLOAD_LIMIT_BYTES / (1024 * 1024));
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? `File troppo grande: il limite è ${limitMb} MB.`
          : err.message ?? "Upload fallito",
      });
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

// Move a source into a folder (or to the root with folderId: null).
router.patch("/wiki/sources/:id", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  const [source] = await db
    .select({ id: wikiSourcesTable.id })
    .from(wikiSourcesTable)
    .where(and(eq(wikiSourcesTable.id, id), eq(wikiSourcesTable.userId, userId)))
    .limit(1);
  if (!source) {
    res.status(404).json({ error: "Sorgente non trovata" });
    return;
  }
  const { folderId } = req.body as { folderId?: number | null };
  if (folderId != null) {
    const [folder] = await db
      .select({ id: wikiFoldersTable.id })
      .from(wikiFoldersTable)
      .where(and(eq(wikiFoldersTable.id, Number(folderId)), eq(wikiFoldersTable.userId, userId)))
      .limit(1);
    if (!folder) {
      res.status(400).json({ error: "Cartella non trovata" });
      return;
    }
  }
  const [updated] = await db
    .update(wikiSourcesTable)
    .set({ folderId: folderId == null ? null : Number(folderId), updatedAt: new Date() })
    .where(and(eq(wikiSourcesTable.id, id), eq(wikiSourcesTable.userId, userId)))
    .returning();
  res.json(updated);
});

// ─── Folders ──────────────────────────────────────────────────────────────────

async function loadUserFolders(userId: string): Promise<WikiFolder[]> {
  return db
    .select()
    .from(wikiFoldersTable)
    .where(eq(wikiFoldersTable.userId, userId))
    .orderBy(asc(wikiFoldersTable.position), asc(wikiFoldersTable.name));
}

// True if re-parenting `folderId` under `newParentId` would create a cycle
// (newParentId is the folder itself or one of its descendants).
function wouldCreateCycle(folders: WikiFolder[], folderId: number, newParentId: number): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const seen = new Set<number>();
  let cursor: number | null = newParentId;
  while (cursor !== null) {
    if (cursor === folderId) return true;
    if (seen.has(cursor)) break; // defensive against pre-existing data cycles
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

router.get("/wiki/folders", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  res.json(await loadUserFolders(userId));
});

router.post("/wiki/folders", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const { name, parentId, color } = req.body as {
    name?: string;
    parentId?: number | null;
    color?: string;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: "name obbligatorio" });
    return;
  }
  if (parentId != null) {
    const [parent] = await db
      .select({ id: wikiFoldersTable.id })
      .from(wikiFoldersTable)
      .where(and(eq(wikiFoldersTable.id, Number(parentId)), eq(wikiFoldersTable.userId, userId)))
      .limit(1);
    if (!parent) {
      res.status(400).json({ error: "Cartella padre non trovata" });
      return;
    }
  }
  const [folder] = await db
    .insert(wikiFoldersTable)
    .values({
      userId,
      name: name.trim().slice(0, 120),
      parentId: parentId != null ? Number(parentId) : null,
      color: color?.trim() || null,
    })
    .returning();
  res.status(201).json(folder);
});

router.patch("/wiki/folders/:id", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  const folders = await loadUserFolders(userId);
  const folder = folders.find((f) => f.id === id);
  if (!folder) {
    res.status(404).json({ error: "Cartella non trovata" });
    return;
  }
  const { name, parentId, color, position } = req.body as {
    name?: string;
    parentId?: number | null;
    color?: string | null;
    position?: number;
  };
  const patch: Partial<typeof wikiFoldersTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) patch.name = name.trim().slice(0, 120);
  if (color !== undefined) patch.color = color?.trim() || null;
  if (typeof position === "number") patch.position = position;
  if (parentId !== undefined) {
    const next = parentId == null ? null : Number(parentId);
    if (next !== null) {
      if (next === id) {
        res.status(400).json({ error: "Una cartella non può essere figlia di sé stessa" });
        return;
      }
      if (!folders.some((f) => f.id === next)) {
        res.status(400).json({ error: "Cartella padre non trovata" });
        return;
      }
      if (wouldCreateCycle(folders, id, next)) {
        res.status(400).json({ error: "Spostamento non valido: creerebbe un ciclo" });
        return;
      }
    }
    patch.parentId = next;
  }
  const [updated] = await db
    .update(wikiFoldersTable)
    .set(patch)
    .where(and(eq(wikiFoldersTable.id, id), eq(wikiFoldersTable.userId, userId)))
    .returning();
  res.json(updated);
});

router.delete("/wiki/folders/:id", async (req, res) => {
  const userId = await requireWikiUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  const deleted = await db
    .delete(wikiFoldersTable)
    .where(and(eq(wikiFoldersTable.id, id), eq(wikiFoldersTable.userId, userId)))
    .returning({ id: wikiFoldersTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Cartella non trovata" });
    return;
  }
  // FK ON DELETE set null re-homes child folders and contained sources to root.
  res.json({ ok: true });
});

export { processWikiSourceJob };
export default router;
