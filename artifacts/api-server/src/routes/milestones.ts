import { canPublishPlatformContent as isPlatformAdmin } from "../lib/adminAuth.js";
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
import { imageMatchesType } from "../lib/imageValidation.js";
import { z } from "zod";
import {
  certificateIdFromParam,
  renderMilestoneCertificateSvg,
} from "../services/milestones/milestoneCertificateImage.js";

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

function positiveId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}
const skillsInput = z.union([
  z.array(z.string()),
  z.string().refine(value => {
    try { return z.array(z.string()).safeParse(JSON.parse(value)).success; }
    catch { return false; }
  }),
]);
const milestoneInput = z.object({
  title: z.string().default(""), description: z.string().default(""),
  skills: skillsInput.default([]), badgeEmoji: z.string().default("🏆"),
  badgeColor: z.string().default("#22c55e"),
});
const downloadableInput = z.object({ downloadable: z.boolean() });

async function removeTemporaryUpload(file: Express.Multer.File | undefined): Promise<void> {
  if (file) await fs.promises.unlink(file.path).catch(() => {});
}
async function validPassiveHeader(file: Express.Multer.File): Promise<boolean> {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!file.mimetype.startsWith("image/") && !/\.(png|jpe?g|gif|webp|pdf)$/.test(extension) && file.mimetype !== "application/pdf") return true;
  const handle = await fs.promises.open(file.path, "r");
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    return extension === ".pdf"
      ? file.mimetype === "application/pdf" && bytes.toString("ascii", 0, 5) === "%PDF-"
      : imageMatchesType(bytes, file.mimetype, file.originalname);
  } finally { await handle.close(); }
}

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

async function canReadLevel(req: Request, level: number): Promise<boolean> {
  if (!req.user?.id) return false;
  if (await isPlatformAdmin(req.user.id)) return true;
  const [profile] = await db.select({ xp: profileTable.xp }).from(profileTable).where(eq(profileTable.userId, req.user.id)).limit(1);
  return Boolean(profile && computeLevel(profile.xp).level >= level);
}
router.get("/uploads/milestone-files/:filename", async (req, res, next) => {
  const filename = String(req.params.filename);
  if (path.basename(filename) !== filename || filename.startsWith(".")) { res.sendStatus(404); return; }
  const [file] = await db.select().from(levelMilestoneFilesTable).where(eq(levelMilestoneFilesTable.fileUrl, `/api/uploads/milestone-files/${filename}`)).limit(1);
  if (!file || !(await canReadLevel(req, file.level))) { res.sendStatus(404); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  if (!/\.(png|jpe?g|gif|webp|pdf|mp4|webm)$/i.test(filename)) res.attachment(file.fileName);
  res.sendFile(filename, { root: MILESTONE_FILES_DIR }, error => { if (error) next(error); });
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
    const level = positiveId(req.params.level);
    if (level === null) { res.status(400).json({ error: "Livello non valido" }); return; }
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
    res.json({ milestone: milestone ?? null, files: await canReadLevel(req, level) ? files : [] });
  } catch (err) {
    console.error("GET /milestones/:level error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── PUT upsert milestone content (admin only) ────────────────────────────────
router.put("/milestones/:level", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const level = positiveId(req.params.level);
    if (level === null) { res.status(400).json({ error: "Livello non valido" }); return; }
    const parsed = milestoneInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Dati del livello non validi" }); return; }
    const fields = { ...parsed.data, skills: Array.isArray(parsed.data.skills) ? JSON.stringify(parsed.data.skills) : parsed.data.skills };
    const [milestone] = await db.insert(levelMilestonesTable).values({ level, ...fields })
      .onConflictDoUpdate({ target: levelMilestonesTable.level, set: { ...fields, updatedAt: new Date() } }).returning();
    res.json(milestone);
  } catch (err) {
    console.error("PUT /milestones/:level error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST upload file to milestone (admin only) ───────────────────────────────
router.post("/milestones/:level/files", async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId || !(await isPlatformAdmin(userId))) {
    res.status(403).json({ error: "Solo l'amministratore può caricare file" });
    return;
  }
  if (positiveId(req.params.level) === null) { res.status(400).json({ error: "Livello non valido" }); return; }
  milestoneFileUpload.single("file")(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    const level = positiveId(req.params.level);
    if (level === null) { await removeTemporaryUpload(req.file); res.status(400).json({ error: "Livello non valido" }); return; }
    if (!(await validPassiveHeader(req.file))) {
      await removeTemporaryUpload(req.file);
      res.status(415).json({ error: "Il contenuto non corrisponde al formato del file" }); return;
    }
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
    await removeTemporaryUpload(req.file);
    console.error("POST /milestones/:level/files error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── PATCH toggle downloadable (admin only) ───────────────────────────────────
router.patch("/milestones/files/:fileId/downloadable", async (req, res) => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const fileId = positiveId(req.params.fileId);
    const parsed = downloadableInput.safeParse(req.body);
    if (fileId === null || !parsed.success) { res.status(400).json({ error: "Dati del file non validi" }); return; }
    const [updated] = await db
      .update(levelMilestoneFilesTable)
      .set({ downloadable: parsed.data.downloadable })
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
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  try {
    const fileId = positiveId(req.params.fileId);
    if (fileId === null) { res.status(400).json({ error: "File non valido" }); return; }
    // Commit the database deletion first. A failed query must leave the file
    // readable; concurrent deletions can claim the row only once.
    const [file] = await db.delete(levelMilestoneFilesTable).where(eq(levelMilestoneFilesTable.id, fileId)).returning();
    if (!file) { res.status(404).json({ error: "File non trovato" }); return; }
    const physicalPath = path.join(MILESTONE_FILES_DIR, path.basename(file.fileUrl));
    await fs.promises.unlink(physicalPath).catch(error => {
      if (error.code !== "ENOENT") console.error("Milestone file cleanup failed after deletion");
    });
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

      // Synchronize customized nickname to certificates
      if (profile.name) {
        await db
          .update(levelCertificatesTable)
          .set({ userName: profile.name, avatarUrl: profile.avatarUrl ?? null })
          .where(eq(levelCertificatesTable.userId, userId));
      }
    }

    const certs = await db
      .select()
      .from(levelCertificatesTable)
      .where(eq(levelCertificatesTable.userId, userId))
      .orderBy(asc(levelCertificatesTable.level));

    const mapped = certs.map((c) => ({
      ...c,
      userName: profile?.name || c.userName || "Operatore",
    }));
    res.json(mapped);
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
    const [profile] = await db
      .select({ name: profileTable.name })
      .from(profileTable)
      .where(eq(profileTable.userId, req.params.userId))
      .limit(1);

    const certs = await db
      .select()
      .from(levelCertificatesTable)
      .where(eq(levelCertificatesTable.userId, req.params.userId))
      .orderBy(asc(levelCertificatesTable.level));

    const mapped = certs.map((c) => ({
      ...c,
      userName: profile?.name || c.userName || "Operatore",
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Check admin status ───────────────────────────────────────────────────────
router.get("/milestones/admin/status", async (req, res) => {
  const userId = getUserId(req);
  res.json({ isAdmin: userId ? await isPlatformAdmin(userId) : false });
});

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
}

// ─── GET /milestones/certificates/:id/image.svg (Public SVG for wallets and download) ───
router.get("/milestones/certificates/:id/image.svg", async (req: Request, res: Response) => {
  const id = certificateIdFromParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "bad_id" });
    return;
  }
  const [cert] = await db
    .select()
    .from(levelCertificatesTable)
    .where(eq(levelCertificatesTable.id, id))
    .limit(1);
  if (!cert) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const [profile] = await db
    .select({ name: profileTable.name })
    .from(profileTable)
    .where(eq(profileTable.userId, cert.userId))
    .limit(1);

  const queryGrade = req.query.grade ? Number(req.query.grade) : null;
  const effectiveGrade = queryGrade && queryGrade >= 1 && queryGrade <= 5 ? queryGrade : cert.level;
  const effectiveGradeName = typeof req.query.gradeName === "string" && req.query.gradeName.trim()
    ? req.query.gradeName.trim()
    : cert.levelName;
  const effectiveUserName = typeof req.query.userName === "string" && req.query.userName.trim()
    ? req.query.userName.trim()
    : (profile?.name || cert.userName || "Operatore");

  res.set({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=300",
  }).send(renderMilestoneCertificateSvg({
    ...cert,
    level: effectiveGrade,
    levelName: effectiveGradeName,
    userName: effectiveUserName,
  }));
});

// ─── GET /milestones/custom-certificate/image.svg (Public on-demand personalized certificate) ───
router.get("/milestones/custom-certificate/image.svg", async (req: Request, res: Response) => {
  const queryGrade = req.query.grade ? Number(req.query.grade) : 1;
  const clampedGrade = Math.max(1, Math.min(5, Number.isFinite(queryGrade) ? queryGrade : 1));
  const gradeName = typeof req.query.gradeName === "string" && req.query.gradeName.trim()
    ? req.query.gradeName.trim()
    : "";
  const userName = typeof req.query.userName === "string" && req.query.userName.trim()
    ? req.query.userName.trim()
    : "Operatore";

  res.set({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=300",
  }).send(renderMilestoneCertificateSvg({
    id: clampedGrade,
    userId: "custom",
    userName,
    level: clampedGrade,
    levelName: gradeName,
    awardedAt: new Date(),
  }));
});

// ─── GET /milestones/certificates/:id/metadata (ERC-721 JSON) ────────────────
router.get("/milestones/certificates/:id/metadata", async (req: Request, res: Response) => {
  const id = certificateIdFromParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "bad_id" });
    return;
  }
  const [cert] = await db
    .select()
    .from(levelCertificatesTable)
    .where(eq(levelCertificatesTable.id, id))
    .limit(1);
  if (!cert) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const [profile] = await db
    .select({ name: profileTable.name })
    .from(profileTable)
    .where(eq(profileTable.userId, cert.userId))
    .limit(1);
  const effectiveUserName = profile?.name || cert.userName || "Operatore";

  res.json({
    name: `LIMEN Investitura · Grado ${cert.level} · ${cert.levelName}`,
    description: `Certificato NFT di Investitura conferito all'Operatore ${effectiveUserName} per il raggiungimento di ${cert.levelName} sotto il protocollo LIMEN.`,
    image: `${appBaseUrl()}/api/milestones/certificates/${id}/image.svg`,
    attributes: [
      { trait_type: "Grade", value: cert.level },
      { trait_type: "Grade Name", value: cert.levelName },
      { trait_type: "Operator", value: effectiveUserName },
      { trait_type: "Protocol", value: "LIMEN PROTOCOL" },
      { trait_type: "Standard", value: "Proof of Discipline" },
      { trait_type: "Awarded At", value: cert.awardedAt ? new Date(cert.awardedAt).toISOString() : null },
    ],
  });
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
