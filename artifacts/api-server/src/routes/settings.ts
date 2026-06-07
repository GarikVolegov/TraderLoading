import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, userSettingsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();
const SUPPORTED_LANGUAGES = new Set(["it", "en", "es", "fr", "de"]);

function normalizeLanguage(value: unknown): string {
  return typeof value === "string" && SUPPORTED_LANGUAGES.has(value) ? value : "it";
}

function parseNotificationPrefs(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readLanguageFromSettings(settings: { notificationPrefs?: string | null }): string {
  return normalizeLanguage(parseNotificationPrefs(settings.notificationPrefs ?? null).__language);
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `bg-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function getOrCreateSettings(userId: string | null) {
  const where = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [existing] = await db.select().from(userSettingsTable).where(where).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(userSettingsTable).values({
    backgroundType: "default",
    fontChoice: "inter",
    backgroundDarkness: 60,
    userId,
  }).returning();
  return created;
}

router.get("/settings", async (req, res) => {
  const userId = getUserId(req);
  const settings = await getOrCreateSettings(userId);
  const result: Record<string, unknown> = { ...settings };
  result.language = readLanguageFromSettings(settings);
  if (settings.tradingSessions) {
    try { result.tradingSessions = JSON.parse(settings.tradingSessions); } catch { result.tradingSessions = null; }
  }
  if (settings.calendarCurrencies) {
    try { result.calendarCurrencies = JSON.parse(settings.calendarCurrencies); } catch { result.calendarCurrencies = null; }
  }
  if (settings.calendarImpacts) {
    try { result.calendarImpacts = JSON.parse(settings.calendarImpacts); } catch { result.calendarImpacts = null; }
  }
  if (settings.selectedPairs) {
    try { result.selectedPairs = JSON.parse(settings.selectedPairs); } catch { result.selectedPairs = null; }
  }
  res.json(result);
});

router.put("/settings", async (req, res) => {
  const userId = getUserId(req);
  const { backgroundUrl, backgroundType, fontChoice, backgroundDarkness, language, tradingSessions, lotDivisor, calendarCurrencies, calendarImpacts, dailyReminderTime, preMacroMinutes, maxDailyLoss, selectedPairs } = req.body;
  const settings = await getOrCreateSettings(userId);

  const updateData: Record<string, unknown> = {};
  if (backgroundUrl !== undefined) updateData.backgroundUrl = backgroundUrl ?? null;
  if (backgroundType !== undefined) updateData.backgroundType = backgroundType || "default";
  if (fontChoice !== undefined) updateData.fontChoice = fontChoice;
  if (backgroundDarkness !== undefined) updateData.backgroundDarkness = Math.min(90, Math.max(0, Number(backgroundDarkness)));
  if (tradingSessions !== undefined) updateData.tradingSessions = tradingSessions ? JSON.stringify(tradingSessions) : null;
  if (lotDivisor !== undefined) {
    const parsedDivisor = Number(lotDivisor);
    if (isNaN(parsedDivisor) || parsedDivisor < 1) {
      res.status(400).json({ error: "lotDivisor must be a number >= 1" });
      return;
    }
    updateData.lotDivisor = parsedDivisor;
  }
  if (calendarCurrencies !== undefined) {
    updateData.calendarCurrencies = Array.isArray(calendarCurrencies) ? JSON.stringify(calendarCurrencies) : null;
  }
  if (calendarImpacts !== undefined) {
    updateData.calendarImpacts = Array.isArray(calendarImpacts) ? JSON.stringify(calendarImpacts) : null;
  }
  if (dailyReminderTime !== undefined) updateData.dailyReminderTime = dailyReminderTime || null;
  if (preMacroMinutes !== undefined) updateData.preMacroMinutes = Math.max(0, Number(preMacroMinutes));
  if (maxDailyLoss !== undefined) updateData.maxDailyLoss = maxDailyLoss ? Math.abs(Number(maxDailyLoss)) : null;
  if (selectedPairs !== undefined) {
    updateData.selectedPairs = Array.isArray(selectedPairs) ? JSON.stringify(selectedPairs) : null;
  }
  if (language !== undefined) {
    updateData.notificationPrefs = JSON.stringify({
      ...parseNotificationPrefs(settings.notificationPrefs),
      __language: normalizeLanguage(language),
    });
  }
  const [updated] = await db.update(userSettingsTable)
    .set(updateData)
    .where(eq(userSettingsTable.id, settings.id))
    .returning();
  
  const result: Record<string, unknown> = { ...updated };
  result.language = readLanguageFromSettings(updated);
  if (updated.tradingSessions) {
    try { result.tradingSessions = JSON.parse(updated.tradingSessions); } catch { result.tradingSessions = null; }
  }
  if (updated.calendarCurrencies) {
    try { result.calendarCurrencies = JSON.parse(updated.calendarCurrencies); } catch { result.calendarCurrencies = null; }
  }
  if (updated.calendarImpacts) {
    try { result.calendarImpacts = JSON.parse(updated.calendarImpacts); } catch { result.calendarImpacts = null; }
  }
  if (updated.selectedPairs) {
    try { result.selectedPairs = JSON.parse(updated.selectedPairs); } catch { result.selectedPairs = null; }
  }
  res.json(result);
});

router.post("/settings/background", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image uploaded" });
    return;
  }
  const userId = getUserId(req);
  const url = `/api/uploads/${req.file.filename}`;
  const settings = await getOrCreateSettings(userId);
  await db.update(userSettingsTable)
    .set({ backgroundUrl: url, backgroundType: "custom" })
    .where(eq(userSettingsTable.id, settings.id));
  res.json({ url });
});

export default router;
