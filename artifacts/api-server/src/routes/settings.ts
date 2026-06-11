import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, userSettingsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";
import { getUploadsDir } from "../lib/uploads.js";

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

type SettingsRecord = {
  onboardingTutorialCompletedAt?: Date | string | null;
  notificationPrefs?: string | null;
  tradingSessions?: string | null;
  calendarCurrencies?: string | null;
  calendarImpacts?: string | null;
  selectedPairs?: string | null;
  alarmConfigs?: string | null;
};

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeSettings(settings: SettingsRecord): Record<string, unknown> {
  const result: Record<string, unknown> = { ...settings };
  result.onboardingTutorialCompletedAt = serializeDate(settings.onboardingTutorialCompletedAt);
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
  if (settings.alarmConfigs) {
    try { result.alarmConfigs = JSON.parse(settings.alarmConfigs); } catch { result.alarmConfigs = null; }
  }
  return result;
}

export function buildSettingsUpdateData(
  body: Record<string, unknown>,
  settings: SettingsRecord,
): { updateData: Record<string, unknown>; error?: string } {
  const {
    backgroundUrl,
    backgroundType,
    fontChoice,
    backgroundDarkness,
    language,
    tradingSessions,
    lotDivisor,
    calendarCurrencies,
    calendarImpacts,
    dailyReminderTime,
    preMacroMinutes,
    maxDailyLoss,
    selectedPairs,
    alarmConfigs,
    onboardingTutorialCompletedAt,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (backgroundUrl !== undefined) updateData.backgroundUrl = backgroundUrl ?? null;
  if (backgroundType !== undefined) updateData.backgroundType = backgroundType || "default";
  if (fontChoice !== undefined) updateData.fontChoice = fontChoice;
  if (backgroundDarkness !== undefined) updateData.backgroundDarkness = Math.min(90, Math.max(0, Number(backgroundDarkness)));
  if (tradingSessions !== undefined) updateData.tradingSessions = tradingSessions ? JSON.stringify(tradingSessions) : null;
  if (lotDivisor !== undefined) {
    const parsedDivisor = Number(lotDivisor);
    if (isNaN(parsedDivisor) || parsedDivisor < 1) {
      return { updateData, error: "lotDivisor must be a number >= 1" };
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
  if (alarmConfigs !== undefined) {
    updateData.alarmConfigs = alarmConfigs ? JSON.stringify(alarmConfigs) : null;
  }
  if (onboardingTutorialCompletedAt !== undefined) {
    if (onboardingTutorialCompletedAt === null) {
      updateData.onboardingTutorialCompletedAt = null;
    } else if (typeof onboardingTutorialCompletedAt === "string") {
      const parsedDate = new Date(onboardingTutorialCompletedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return { updateData, error: "onboardingTutorialCompletedAt must be a valid ISO date string or null" };
      }
      updateData.onboardingTutorialCompletedAt = parsedDate;
    } else {
      return { updateData, error: "onboardingTutorialCompletedAt must be a valid ISO date string or null" };
    }
  }
  if (language !== undefined) {
    updateData.notificationPrefs = JSON.stringify({
      ...parseNotificationPrefs(settings.notificationPrefs ?? null),
      __language: normalizeLanguage(language),
    });
  }
  return { updateData };
}

const UPLOADS_DIR = getUploadsDir();
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
  res.json(serializeSettings(settings));
});

router.put("/settings", async (req, res) => {
  const userId = getUserId(req);
  const settings = await getOrCreateSettings(userId);

  const { updateData, error } = buildSettingsUpdateData(req.body, settings);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  if (Object.keys(updateData).length === 0) {
    res.json(serializeSettings(settings));
    return;
  }
  const [updated] = await db.update(userSettingsTable)
    .set(updateData)
    .where(eq(userSettingsTable.id, settings.id))
    .returning();
  
  res.json(serializeSettings(updated));
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
