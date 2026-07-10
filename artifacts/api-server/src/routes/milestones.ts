import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  db,
  levelMilestonesTable,
  levelMilestoneFilesTable,
  levelCertificatesTable,
  profileTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { getUserId, getLevelName, computeLevel } from "./profile.js";
import { resolveUploadPath } from "../lib/uploads.js";
import { isPlatformAdmin, requireAuth, requireAdmin } from "../lib/platformAdmin.js";

const router: IRouter = Router();

const MILESTONE_FILES_DIR = resolveUploadPath("milestone-files");
if (!fs.existsSync(MILESTONE_FILES_DIR)) fs.mkdirSync(MILESTONE_FILES_DIR, { recursive: true });

const milestoneFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MILESTONE_FILES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `ms-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip",
  "video/mp4", "video/webm",
]);
const milestoneFileUpload = multer({
  storage: milestoneFileStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo file non consentito"));
  },
});


// ─── GET all milestones (public, paginated) ───────────────────────────────────
router.get("/milestones", async (req, res) => {
  try {
    const milestones = await db
      .select()
      .from(levelMilestonesTable)
      .orderBy(asc(levelMilestonesTable.level));
    res.json(milestones);
  } catch (err) {
    console.error("GET /milestones error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── GET single milestone with files ─────────────────────────────────────────
router.get("/milestones/:level", async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    if (isNaN(level)) { res.status(400).json({ error: "Livello non valido" }); return; }
    const [milestone] = await db
      .select()
      .from(levelMilestonesTable)
      .where(eq(levelMilestonesTable.level, level))
      .limit(1);
    const files = await db
      .select()
      .from(levelMilestoneFilesTable)
      .where(eq(levelMilestoneFilesTable.level, level))
      .orderBy(asc(levelMilestoneFilesTable.createdAt));
    res.json({ milestone: milestone ?? null, files });
  } catch (err) {
    console.error("GET /milestones/:level error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── PUT upsert milestone content (admin only) ────────────────────────────────
router.put("/milestones/:level", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const level = parseInt(req.params.level);
    if (isNaN(level) || level < 1) { res.status(400).json({ error: "Livello non valido" }); return; }
    const { title, description, skills, badgeEmoji, badgeColor } = req.body;
    const existing = await db
      .select({ id: levelMilestonesTable.id })
      .from(levelMilestonesTable)
      .where(eq(levelMilestonesTable.level, level))
      .limit(1);
    let milestone;
    if (existing.length > 0) {
      [milestone] = await db
        .update(levelMilestonesTable)
        .set({
          title: title ?? "",
          description: description ?? "",
          skills: Array.isArray(skills) ? JSON.stringify(skills) : (skills ?? "[]"),
          badgeEmoji: badgeEmoji ?? "🏆",
          badgeColor: badgeColor ?? "#22c55e",
          updatedAt: new Date(),
        })
        .where(eq(levelMilestonesTable.level, level))
        .returning();
    } else {
      [milestone] = await db
        .insert(levelMilestonesTable)
        .values({
          level,
          title: title ?? "",
          description: description ?? "",
          skills: Array.isArray(skills) ? JSON.stringify(skills) : (skills ?? "[]"),
          badgeEmoji: badgeEmoji ?? "🏆",
          badgeColor: badgeColor ?? "#22c55e",
        })
        .returning();
    }
    res.json(milestone);
  } catch (err) {
    console.error("PUT /milestones/:level error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST upload file to milestone (admin only) ───────────────────────────────
router.post("/milestones/:level/files", (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId || !isPlatformAdmin(userId)) {
    res.status(403).json({ error: "Solo l'amministratore può caricare file" });
    return;
  }
  milestoneFileUpload.single("file")(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    const level = parseInt(String(req.params.level));
    if (isNaN(level)) { res.status(400).json({ error: "Livello non valido" }); return; }
    const fileUrl = `/api/uploads/milestone-files/${req.file.filename}`;
    const [fileRow] = await db.insert(levelMilestoneFilesTable).values({
      level,
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      downloadable: true,
    }).returning();
    res.status(201).json(fileRow);
  } catch (err) {
    console.error("POST /milestones/:level/files error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── PATCH toggle downloadable (admin only) ───────────────────────────────────
router.patch("/milestones/files/:fileId/downloadable", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const fileId = parseInt(req.params.fileId);
    const { downloadable } = req.body;
    const [updated] = await db
      .update(levelMilestoneFilesTable)
      .set({ downloadable: !!downloadable })
      .where(eq(levelMilestoneFilesTable.id, fileId))
      .returning();
    if (!updated) { res.status(404).json({ error: "File non trovato" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── DELETE milestone file (admin only) ───────────────────────────────────────
router.delete("/milestones/files/:fileId", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  try {
    const fileId = parseInt(req.params.fileId);
    const [file] = await db
      .select()
      .from(levelMilestoneFilesTable)
      .where(eq(levelMilestoneFilesTable.id, fileId))
      .limit(1);
    if (!file) { res.status(404).json({ error: "File non trovato" }); return; }
    const physicalPath = path.join(MILESTONE_FILES_DIR, path.basename(file.fileUrl));
    if (fs.existsSync(physicalPath)) fs.unlinkSync(physicalPath);
    await db.delete(levelMilestoneFilesTable).where(eq(levelMilestoneFilesTable.id, fileId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── GET my certificates ──────────────────────────────────────────────────────
router.get("/milestones/certificates/me", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    // Backfill: ensure a certificate exists for EVERY level the user has already
    // reached. The level-up trigger only fires the moment a mission completion
    // crosses a level, so users who leveled up earlier (or via other XP) had no
    // certificates and the gallery looked empty — this is why they "weren't created".
    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl, xp: profileTable.xp })
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    if (profile) {
      const currentLevel = computeLevel(profile.xp ?? 0).level;
      const existing = await db
        .select({ level: levelCertificatesTable.level })
        .from(levelCertificatesTable)
        .where(eq(levelCertificatesTable.userId, userId));
      const have = new Set(existing.map((c) => c.level));

      if (currentLevel >= 1 && have.size < currentLevel) {
        const milestones = await db
          .select({ level: levelMilestonesTable.level, title: levelMilestonesTable.title })
          .from(levelMilestonesTable);
        const titleByLevel = new Map(milestones.map((m) => [m.level, m.title]));

        const missing = [];
        for (let l = 1; l <= currentLevel; l++) {
          if (have.has(l)) continue;
          missing.push({
            userId,
            userName: profile.name ?? "Trader",
            avatarUrl: profile.avatarUrl ?? null,
            level: l,
            levelName: getLevelName(l),
            milestoneTitle: titleByLevel.get(l) ?? "",
          });
        }
        if (missing.length > 0) {
          await db.insert(levelCertificatesTable).values(missing).onConflictDoNothing();
        }
      }
    }

    const certs = await db
      .select()
      .from(levelCertificatesTable)
      .where(eq(levelCertificatesTable.userId, userId))
      .orderBy(asc(levelCertificatesTable.level));
    res.json(certs);
  } catch (err) {
    console.error("certificates/me error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── GET certificates by userId (for profile viewing) ─────────────────────────
router.get("/milestones/certificates/user/:userId", async (req, res) => {
  const requesterId = requireAuth(req, res);
  if (!requesterId) return;
  try {
    const certs = await db
      .select()
      .from(levelCertificatesTable)
      .where(eq(levelCertificatesTable.userId, req.params.userId))
      .orderBy(asc(levelCertificatesTable.level));
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Check admin status ───────────────────────────────────────────────────────
router.get("/milestones/admin/status", async (req, res) => {
  const userId = getUserId(req);
  res.json({ isAdmin: userId ? isPlatformAdmin(userId) : false });
});

// ─── Internal: award certificate for a level ─────────────────────────────────
export async function awardLevelCertificate(userId: string, level: number): Promise<void> {
  try {
    const existing = await db
      .select({ id: levelCertificatesTable.id, level: levelCertificatesTable.level })
      .from(levelCertificatesTable)
      .where(eq(levelCertificatesTable.userId, userId))
      .limit(100);
    const alreadyHas = existing.some((c) => c.level === level);
    if (alreadyHas) return;

    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    const [milestone] = await db
      .select({ title: levelMilestonesTable.title })
      .from(levelMilestonesTable)
      .where(eq(levelMilestonesTable.level, level))
      .limit(1);

    await db.insert(levelCertificatesTable).values({
      userId,
      userName: profile?.name ?? "Trader",
      avatarUrl: profile?.avatarUrl ?? null,
      level,
      levelName: getLevelName(level),
      milestoneTitle: milestone?.title ?? "",
    }).onConflictDoNothing();
  } catch (err) {
    console.error("awardLevelCertificate error:", err);
  }
}

export default router;
