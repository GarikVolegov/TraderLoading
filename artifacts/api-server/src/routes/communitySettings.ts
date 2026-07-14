import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, communitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveUploadPath } from "../lib/uploads.js";
import { requirePermission } from "../services/communityPermissions.js";

const COMMUNITY_ASSETS_DIR = resolveUploadPath("community-assets");
if (!fs.existsSync(COMMUNITY_ASSETS_DIR)) fs.mkdirSync(COMMUNITY_ASSETS_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const assetStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COMMUNITY_ASSETS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `casset-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const assetUpload = multer({
  storage: assetStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) cb(null, true);
    else cb(new Error("Solo immagini JPG, PNG, WebP e GIF"));
  },
});

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
function sanitizeColor(value: unknown): string | null {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : null;
}

const router: IRouter = Router();

// ─── Update editable settings (community.manage) ──────────────────────────────
router.patch("/community/:id", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requirePermission(req, res, communityId, "community.manage"))) return;
  try {
    const { name, description, iconEmoji, accentColor, rules, welcomeMessage, isPublic } = req.body;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim().length > 0) update.name = name.trim().slice(0, 50);
    if (typeof description === "string") update.description = description.slice(0, 200);
    if (typeof iconEmoji === "string" && iconEmoji.trim().length > 0) update.iconEmoji = iconEmoji.trim().slice(0, 16);
    if ("accentColor" in req.body) update.accentColor = sanitizeColor(accentColor);
    if (typeof rules === "string") update.rules = rules.slice(0, 4000);
    if (typeof welcomeMessage === "string") update.welcomeMessage = welcomeMessage.slice(0, 1000);
    if (typeof isPublic === "boolean") update.isPublic = isPublic;

    const [updated] = await db
      .update(communitiesTable)
      .set(update)
      .where(eq(communitiesTable.id, communityId))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error("PATCH /community/:id error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Image upload (banner / avatar), community.manage ─────────────────────────
function uploadHandler(column: "bannerUrl" | "avatarUrl", responseKey: string) {
  return (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
    assetUpload.single("image")(req, res, async (err) => {
      if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
      if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
      const communityId = parseInt(String(req.params.id));
      const ctx = await requirePermission(req, res, communityId, "community.manage");
      if (!ctx) {
        fs.unlink(path.join(COMMUNITY_ASSETS_DIR, req.file.filename), () => {});
        return;
      }
      try {
        const url = `/api/uploads/community-assets/${req.file.filename}`;
        await db
          .update(communitiesTable)
          .set({ [column]: url, updatedAt: new Date() })
          .where(eq(communitiesTable.id, communityId));
        res.json({ [responseKey]: url });
      } catch (e) {
        console.error(`POST /community/:id/${responseKey} error:`, e);
        res.status(500).json({ error: "Errore interno" });
      }
    });
  };
}

router.post("/community/:id/banner", uploadHandler("bannerUrl", "bannerUrl"));
router.post("/community/:id/avatar", uploadHandler("avatarUrl", "avatarUrl"));

export default router;
