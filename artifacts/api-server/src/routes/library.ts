import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, libraryCollectionsTable, libraryContentsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router: IRouter = Router();

const LIBRARY_FILES_DIR = path.join(process.cwd(), "uploads", "library-files");
if (!fs.existsSync(LIBRARY_FILES_DIR)) fs.mkdirSync(LIBRARY_FILES_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
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

function requireAuth(req: any, res: any): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}
function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}
function requireAdmin(req: any, res: any): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!isPlatformAdmin(userId)) {
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

const CONTENT_TYPES = new Set(["document", "mindmap", "video"]);

// ─── Admin status ─────────────────────────────────────────────────────────────
router.get("/library/admin/status", (req: any, res) => {
  const userId = req.user?.id;
  res.json({ isAdmin: userId ? isPlatformAdmin(userId) : false });
});

// ─── Consumer: list published collections ─────────────────────────────────────
router.get("/library/collections", async (req: any, res) => {
  try {
    const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;
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
router.get("/library/collections/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const [collection] = await db
      .select()
      .from(libraryCollectionsTable)
      .where(eq(libraryCollectionsTable.id, id))
      .limit(1);
    if (!collection) { res.status(404).json({ error: "Collezione non trovata" }); return; }
    const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;
    const contents = await db
      .select()
      .from(libraryContentsTable)
      .where(
        isAdmin
          ? eq(libraryContentsTable.collectionId, id)
          : and(eq(libraryContentsTable.collectionId, id), eq(libraryContentsTable.published, true)),
      )
      .orderBy(asc(libraryContentsTable.orderIndex));
    res.json({ collection, contents });
  } catch (err) {
    console.error("GET /library/collections/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Consumer: flat list of contents (client groups by unlock level) ──────────
router.get("/library/contents", async (req: any, res) => {
  try {
    const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;
    const rows = await db
      .select()
      .from(libraryContentsTable)
      .where(isAdmin ? undefined : eq(libraryContentsTable.published, true))
      .orderBy(asc(libraryContentsTable.requiredLevel), asc(libraryContentsTable.orderIndex));
    res.json(rows);
  } catch (err) {
    console.error("GET /library/contents", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Consumer: single content ─────────────────────────────────────────────────
router.get("/library/contents/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const [content] = await db
      .select()
      .from(libraryContentsTable)
      .where(eq(libraryContentsTable.id, id))
      .limit(1);
    const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;
    if (!content || (!content.published && !isAdmin)) {
      res.status(404).json({ error: "Contenuto non trovato" });
      return;
    }
    res.json(content);
  } catch (err) {
    console.error("GET /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Admin: upload a document/cover file ──────────────────────────────────────
router.post("/library/upload", (req: any, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  upload.single("file")(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    res.json({
      fileUrl: `/api/uploads/library-files/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

// ─── Admin: collections CRUD ──────────────────────────────────────────────────
router.post("/library/collections", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const b = req.body ?? {};
    if (!b.title?.trim()) { res.status(400).json({ error: "Titolo richiesto" }); return; }
    const [created] = await db
      .insert(libraryCollectionsTable)
      .values({
        title: b.title.trim(),
        description: b.description ?? "",
        coverImageUrl: b.coverImageUrl || null,
        category: b.category ?? "",
        requiredLevel: Number.isFinite(Number(b.requiredLevel)) ? Number(b.requiredLevel) : 0,
        orderIndex: Number.isFinite(Number(b.orderIndex)) ? Number(b.orderIndex) : 0,
        published: Boolean(b.published),
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
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.title !== undefined) set.title = String(b.title);
    if (b.description !== undefined) set.description = String(b.description);
    if (b.coverImageUrl !== undefined) set.coverImageUrl = b.coverImageUrl || null;
    if (b.category !== undefined) set.category = String(b.category);
    if (b.requiredLevel !== undefined) set.requiredLevel = Number(b.requiredLevel) || 0;
    if (b.orderIndex !== undefined) set.orderIndex = Number(b.orderIndex) || 0;
    if (b.published !== undefined) set.published = Boolean(b.published);
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
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = Number(req.params.id);
    await db.delete(libraryContentsTable).where(eq(libraryContentsTable.collectionId, id));
    await db.delete(libraryCollectionsTable).where(eq(libraryCollectionsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /library/collections/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Admin: contents CRUD ─────────────────────────────────────────────────────
router.post("/library/contents", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const b = req.body ?? {};
    if (!b.title?.trim()) { res.status(400).json({ error: "Titolo richiesto" }); return; }
    const type = CONTENT_TYPES.has(b.type) ? b.type : "document";
    const [created] = await db
      .insert(libraryContentsTable)
      .values({
        collectionId: Number.isFinite(Number(b.collectionId)) ? Number(b.collectionId) : null,
        type,
        title: b.title.trim(),
        description: b.description ?? "",
        bodyMarkdown: b.bodyMarkdown ?? "",
        fileUrl: b.fileUrl || null,
        fileName: b.fileName || null,
        fileSize: Number(b.fileSize) || 0,
        mimeType: b.mimeType || null,
        embedUrl: b.embedUrl || null,
        mindmap: b.mindmap ?? null,
        tags: parseTags(b.tags),
        requiredLevel: Number(b.requiredLevel) || 0,
        orderIndex: Number(b.orderIndex) || 0,
        published: Boolean(b.published),
        createdBy: userId,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /library/contents", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/library/contents/:id", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.collectionId !== undefined) set.collectionId = b.collectionId === null ? null : Number(b.collectionId);
    if (b.type !== undefined && CONTENT_TYPES.has(b.type)) set.type = b.type;
    if (b.title !== undefined) set.title = String(b.title);
    if (b.description !== undefined) set.description = String(b.description);
    if (b.bodyMarkdown !== undefined) set.bodyMarkdown = String(b.bodyMarkdown);
    if (b.fileUrl !== undefined) set.fileUrl = b.fileUrl || null;
    if (b.fileName !== undefined) set.fileName = b.fileName || null;
    if (b.fileSize !== undefined) set.fileSize = Number(b.fileSize) || 0;
    if (b.mimeType !== undefined) set.mimeType = b.mimeType || null;
    if (b.embedUrl !== undefined) set.embedUrl = b.embedUrl || null;
    if (b.mindmap !== undefined) set.mindmap = b.mindmap;
    if (b.tags !== undefined) set.tags = parseTags(b.tags);
    if (b.requiredLevel !== undefined) set.requiredLevel = Number(b.requiredLevel) || 0;
    if (b.orderIndex !== undefined) set.orderIndex = Number(b.orderIndex) || 0;
    if (b.published !== undefined) set.published = Boolean(b.published);
    const [updated] = await db
      .update(libraryContentsTable)
      .set(set)
      .where(eq(libraryContentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Non trovato" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("PUT /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/library/contents/:id", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const id = Number(req.params.id);
    const [content] = await db
      .select({ fileUrl: libraryContentsTable.fileUrl })
      .from(libraryContentsTable)
      .where(eq(libraryContentsTable.id, id))
      .limit(1);
    await db.delete(libraryContentsTable).where(eq(libraryContentsTable.id, id));
    if (content?.fileUrl?.startsWith("/api/uploads/library-files/")) {
      fs.promises.unlink(path.join(LIBRARY_FILES_DIR, path.basename(content.fileUrl))).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /library/contents/:id", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
