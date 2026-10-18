import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, libraryCollectionsTable, libraryContentsTable, profileTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { canPublishPlatformContent as isPlatformAdmin } from "../lib/adminAuth.js";
import { computeLevel } from "./profile.js";
import { resolveUploadPath } from "../lib/uploads.js";
import { imageMatchesType } from "../lib/imageValidation.js";
import { z } from "zod";

const router: IRouter = Router();

const LIBRARY_FILES_DIR = resolveUploadPath("library-files");
if (!fs.existsSync(LIBRARY_FILES_DIR)) fs.mkdirSync(LIBRARY_FILES_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown",
  "application/zip",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LIBRARY_FILES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `lib-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo file non consentito"));
  },
});

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}
async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!(await isPlatformAdmin(userId))) {
    res.status(403).json({ error: "Solo l'amministratore della piattaforma può eseguire questa azione" });
    return null;
  }
  return userId;
}

function parseTags(input: unknown): string {
  if (Array.isArray(input)) return JSON.stringify(input.map((t) => String(t)).filter(Boolean));
  if (typeof input === "string" && input.trim()) return input;
  return "[]";
}

const titleInput = z.string().trim().min(1);
const levelInput = z.number().int().min(0).max(2147483647);
const orderInput = z.number().int().min(-2147483648).max(2147483647);
const nullableText = z.string().nullable().optional();
const collectionFields = z.object({
  title: titleInput.optional(), description: z.string().optional(),
  coverImageUrl: nullableText, category: z.string().optional(),
  requiredLevel: levelInput.optional(), orderIndex: orderInput.optional(),
  published: z.boolean().optional(),
});
const contentFields = z.object({
  title: titleInput.optional(), collectionId: z.number().int().positive().max(2147483647).nullable().optional(),
  type: z.enum(["document", "mindmap", "video"]).optional(),
  description: z.string().optional(), bodyMarkdown: z.string().optional(),
  fileUrl: nullableText, fileName: nullableText, mimeType: nullableText, embedUrl: nullableText,
  fileSize: levelInput.optional(), mindmap: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  requiredLevel: levelInput.optional(), orderIndex: orderInput.optional(), published: z.boolean().optional(),
});
const collectionCreate = collectionFields.extend({ title: titleInput });
const contentCreate = contentFields.extend({ title: titleInput });
const collectionPatch = collectionFields.refine(body => Object.keys(body).length > 0);
const contentPatch = contentFields.refine(body => Object.keys(body).length > 0);
function parseBody<T>(schema: z.ZodType<T>, body: unknown, res: Response): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: "Campi biblioteca non validi" }); return null; }
  return parsed.data;
}
function parseId(value: unknown, res: Response): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) { res.status(400).json({ error: "ID non valido" }); return null; }
  const parsed = z.coerce.number().int().positive().max(2147483647).safeParse(value);
  if (!parsed.success) { res.status(400).json({ error: "ID non valido" }); return null; }
  return parsed.data;
}
class MissingCollectionError extends Error {}
async function requireCollection(connection: Pick<typeof db, "select">, id: number | null | undefined) {
  if (id == null) return;
  const [parent] = await connection.select({ id: libraryCollectionsTable.id }).from(libraryCollectionsTable)
    .where(eq(libraryCollectionsTable.id, id)).limit(1).for("key share");
  if (!parent) throw new MissingCollectionError("Collezione non trovata");
}
const libraryPrefix = "/api/uploads/library-files/";
async function removeUnreferencedFile(fileUrl: string | null | undefined) {
  if (!fileUrl?.startsWith(libraryPrefix)) return;
  const filename = fileUrl.slice(libraryPrefix.length);
  if (path.basename(filename) !== filename || !filename.startsWith("lib-") || filename.includes("?")) return;
  const [content, cover] = await Promise.all([
    db.select({ id: libraryContentsTable.id }).from(libraryContentsTable).where(eq(libraryContentsTable.fileUrl, fileUrl)).limit(1),
    db.select({ id: libraryCollectionsTable.id }).from(libraryCollectionsTable).where(eq(libraryCollectionsTable.coverImageUrl, fileUrl)).limit(1),
  ]);
  if (content.length || cover.length) return;
  await fs.promises.unlink(path.join(LIBRARY_FILES_DIR, filename)).catch(error => {
    if (error.code !== "ENOENT") console.error("Library file cleanup failed:", error);
  });
}

async function readerLevel(req: Request): Promise<number> {
  if (!req.user?.id) return 0;
  const [profile] = await db.select({ xp: profileTable.xp }).from(profileTable).where(eq(profileTable.userId, req.user.id)).limit(1);
  return profile ? computeLevel(profile.xp).level : 1;
}
function lockedPreview(row: typeof libraryContentsTable.$inferSelect) {
  return { ...row, bodyMarkdown: "", fileUrl: null, fileName: null, fileSize: 0, mimeType: null, embedUrl: null, mindmap: null };
}
async function visibleContents(req: Request, rows: (typeof libraryContentsTable.$inferSelect)[], admin: boolean) {
  // Old editor payloads incorrectly converted null to 0. Treat that impossible
  // collection ID as ungrouped without rewriting historical database rows.
  rows = rows.map(row => row.collectionId === 0 ? { ...row, collectionId: null } : row);
  if (admin) return rows;
  const level = await readerLevel(req);
  const collections = new Map((await db.select().from(libraryCollectionsTable)).map(c => [c.id, c]));
  return rows.filter(row => row.published && (row.collectionId === null || collections.get(row.collectionId)?.published))
    .map(row => {
      const requiredLevel = Math.max(row.requiredLevel, row.collectionId ? collections.get(row.collectionId)?.requiredLevel ?? 0 : 0);
      const content = { ...row, requiredLevel };
      return requiredLevel > level ? lockedPreview(content) : content;
    });
}
// Static aliases require the same entitlement as the API. An unreferenced file
// remains admin-only (e.g. during a new content draft).
router.get("/uploads/library-files/:filename", async (req, res, next) => {
  const filename = String(req.params.filename);
  if (path.basename(filename) !== filename || filename.startsWith(".")) { res.status(404).json({ error: "File non trovato" }); return; }
  const serve = () => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    if (!/\.(png|jpe?g|gif|webp|pdf)$/i.test(filename)) res.attachment(filename);
    res.sendFile(filename, { root: LIBRARY_FILES_DIR }, error => { if (error) next(error); });
  };
  if (req.user?.id && await isPlatformAdmin(req.user.id)) { serve(); return; }
  const fileUrl = `/api/uploads/library-files/${req.params.filename}`;
  const rows = await db.select().from(libraryContentsTable).where(eq(libraryContentsTable.fileUrl, fileUrl));
  const readable = await visibleContents(req, rows, false);
  const [cover] = await db.select({ id: libraryCollectionsTable.id }).from(libraryCollectionsTable)
    .where(and(eq(libraryCollectionsTable.coverImageUrl, fileUrl), eq(libraryCollectionsTable.published, true))).limit(1);
  if (!readable.some(row => row.fileUrl === fileUrl) && !cover) {
    res.status(404).json({ error: "File non trovato" }); return;
  }
  serve();
});

// ─── Admin status ─────────────────────────────────────────────────────────────
router.get("/library/admin/status", async (req, res) => {
  const userId = req.user?.id;
  res.json({ isAdmin: userId ? await isPlatformAdmin(userId) : false });
});

// ─── Consumer: list published collections ─────────────────────────────────────
router.get("/library/collections", async (req, res) => {
  try {
    const isAdmin = req.user?.id ? await isPlatformAdmin(req.user.id) : false;
    const rows = await db
      .select()
      .from(libraryCollectionsTable)
      .where(isAdmin ? undefined : eq(libraryCollectionsTable.published, true))
      .orderBy(asc(libraryCollectionsTable.orderIndex));
    res.json(rows);
  } catch (err) {
    console.error("GET /library/collections", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Consumer: collection + its contents ──────────────────────────────────────
router.get("/library/collections/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const [collection] = await db
      .select()
      .from(libraryCollectionsTable)
      .where(eq(libraryCollectionsTable.id, id))
      .limit(1);
    if (!collection) { res.status(404).json({ error: "Collezione non trovata" }); return; }
    const isAdmin = req.user?.id ? await isPlatformAdmin(req.user.id) : false;
    if (!collection.published && !isAdmin) { res.status(404).json({ error: "Collezione non trovata" }); return; }
    const contents = await db
      .select()
      .from(libraryContentsTable)
      .where(
        isAdmin
          ? eq(libraryContentsTable.collectionId, id)
          : and(eq(libraryContentsTable.collectionId, id), eq(libraryContentsTable.published, true)),
      )
      .orderBy(asc(libraryContentsTable.orderIndex));
    res.json({ collection, contents: await visibleContents(req, contents, isAdmin) });
  } catch (err) {
    console.error("GET /library/collections/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Consumer: flat list of contents (client groups by unlock level) ──────────
router.get("/library/contents", async (req, res) => {
  try {
    const isAdmin = req.user?.id ? await isPlatformAdmin(req.user.id) : false;
    const rows = await db
      .select()
      .from(libraryContentsTable)
      .where(isAdmin ? undefined : eq(libraryContentsTable.published, true))
      .orderBy(asc(libraryContentsTable.requiredLevel), asc(libraryContentsTable.orderIndex));
    res.json(await visibleContents(req, rows, isAdmin));
  } catch (err) {
    console.error("GET /library/contents", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Consumer: single content ─────────────────────────────────────────────────
router.get("/library/contents/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const [content] = await db
      .select()
      .from(libraryContentsTable)
      .where(eq(libraryContentsTable.id, id))
      .limit(1);
    const isAdmin = req.user?.id ? await isPlatformAdmin(req.user.id) : false;
    if (!content || (!content.published && !isAdmin)) {
      res.status(404).json({ error: "Contenuto non trovato" });
      return;
    }
    const readable = await visibleContents(req, [content], isAdmin);
    if (!readable.length) { res.status(404).json({ error: "Contenuto non trovato" }); return; }
    if (!isAdmin && readable[0].requiredLevel > await readerLevel(req)) {
      res.status(403).json({ error: "Livello insufficiente" }); return;
    }
    res.json(readable[0]);
  } catch (err) {
    console.error("GET /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Admin: upload a document/cover file ──────────────────────────────────────
router.post("/library/upload", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  upload.single("file")(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    try {
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (req.file.mimetype.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(extension) || req.file.mimetype === "application/pdf" || extension === ".pdf") {
      const handle = await fs.promises.open(req.file.path, "r");
      let valid: boolean;
      try {
        const header = Buffer.alloc(24);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const bytes = header.subarray(0, bytesRead);
        valid = extension === ".pdf"
          ? req.file.mimetype === "application/pdf" && bytes.toString("ascii", 0, 5) === "%PDF-"
          : imageMatchesType(bytes, req.file.mimetype, req.file.originalname);
      } finally { await handle.close(); }
      if (!valid) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        res.status(415).json({ error: "Il contenuto non corrisponde al formato del file" });
        return;
      }
    }
    res.json({
      fileUrl: `/api/uploads/library-files/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      console.error("Library upload failed:", error);
      if (!res.headersSent) res.status(500).json({ error: "Upload fallito" });
    }
  });
});

// ─── Admin: collections CRUD ──────────────────────────────────────────────────
router.post("/library/collections", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const b = parseBody(collectionCreate, req.body, res);
    if (!b) return;
    const [created] = await db
      .insert(libraryCollectionsTable)
      .values({
        title: b.title,
        description: b.description ?? "",
        coverImageUrl: b.coverImageUrl || null,
        category: b.category ?? "",
        requiredLevel: b.requiredLevel ?? 0,
        orderIndex: b.orderIndex ?? 0,
        published: b.published ?? false,
        createdBy: userId,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /library/collections", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/library/collections/:id", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const b = parseBody(collectionPatch, req.body, res);
    if (!b) return;
    const set = { ...b, updatedAt: new Date() };
    if (b.coverImageUrl !== undefined) set.coverImageUrl = b.coverImageUrl || null;
    const [updated] = await db
      .update(libraryCollectionsTable)
      .set(set)
      .where(eq(libraryCollectionsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Non trovata" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("PUT /library/collections/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/library/collections/:id", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const assets = await db.transaction(async tx => {
      const [collection] = await tx.select().from(libraryCollectionsTable).where(eq(libraryCollectionsTable.id, id)).limit(1).for("update");
      if (!collection) return [];
      const contents = await tx.delete(libraryContentsTable).where(eq(libraryContentsTable.collectionId, id)).returning({ fileUrl: libraryContentsTable.fileUrl });
      await tx.delete(libraryCollectionsTable).where(eq(libraryCollectionsTable.id, id));
      return [collection.coverImageUrl, ...contents.map(content => content.fileUrl)];
    });
    for (const file of new Set(assets)) await removeUnreferencedFile(file);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /library/collections/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Admin: contents CRUD ─────────────────────────────────────────────────────
router.post("/library/contents", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const b = parseBody(contentCreate, req.body, res);
    if (!b) return;
    const created = await db.transaction(async tx => {
      await requireCollection(tx, b.collectionId);
      const [row] = await tx
      .insert(libraryContentsTable)
      .values({
        collectionId: b.collectionId ?? null,
        type: b.type ?? "document",
        title: b.title,
        description: b.description ?? "",
        bodyMarkdown: b.bodyMarkdown ?? "",
        fileUrl: b.fileUrl || null,
        fileName: b.fileName || null,
        fileSize: b.fileSize ?? 0,
        mimeType: b.mimeType || null,
        embedUrl: b.embedUrl || null,
        mindmap: b.mindmap ?? null,
        tags: parseTags(b.tags),
        requiredLevel: b.requiredLevel ?? 0,
        orderIndex: b.orderIndex ?? 0,
        published: b.published ?? false,
        createdBy: userId,
      })
      .returning();
      return row;
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof MissingCollectionError) { res.status(400).json({ error: err.message }); return; }
    console.error("POST /library/contents", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/library/contents/:id", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const b = parseBody(contentPatch, req.body, res);
    if (!b) return;
    const { tags: _tags, ...fields } = b;
    const set = { ...fields, ...(b.tags !== undefined ? { tags: parseTags(b.tags) } : {}), updatedAt: new Date() };
    if (b.fileUrl !== undefined) set.fileUrl = b.fileUrl || null;
    if (b.fileName !== undefined) set.fileName = b.fileName || null;
    if (b.mimeType !== undefined) set.mimeType = b.mimeType || null;
    if (b.embedUrl !== undefined) set.embedUrl = b.embedUrl || null;
    const updated = await db.transaction(async tx => {
      await requireCollection(tx, b.collectionId);
      const [row] = await tx.update(libraryContentsTable).set(set).where(eq(libraryContentsTable.id, id)).returning();
      return row;
    });
    if (!updated) { res.status(404).json({ error: "Non trovato" }); return; }
    res.json(updated);
  } catch (err) {
    if (err instanceof MissingCollectionError) { res.status(400).json({ error: err.message }); return; }
    console.error("PUT /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/library/contents/:id", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = parseId(req.params.id, res);
    if (!id) return;
    const [content] = await db
      .select({ fileUrl: libraryContentsTable.fileUrl })
      .from(libraryContentsTable)
      .where(eq(libraryContentsTable.id, id))
      .limit(1);
    await db.delete(libraryContentsTable).where(eq(libraryContentsTable.id, id));
    if (content?.fileUrl?.startsWith("/api/uploads/library-files/")) {
      await removeUnreferencedFile(content.fileUrl);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
