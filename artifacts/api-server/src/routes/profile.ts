import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { profileTable, journalEntriesTable } from "@workspace/db";
import { UpdateProfileBody, UpdateProfileResponse, GetProfileResponse, GetLeaderboardResponse } from "@workspace/api-zod";
import { eq, isNull, and, ne, sql, isNotNull, desc } from "drizzle-orm";

const router: IRouter = Router();

const XP_PER_LEVEL = 500;

const LEVEL_NAMES: Record<number, string> = {
  1: "Novizio Consapevole",
  2: "Apprendista Disciplinato",
  3: "Osservatore Silenzioso",
  4: "Analista in Formazione",
  5: "Samurai della Pazienza",
  6: "Cacciatore di Pattern",
  7: "Guardiano del Risk",
  8: "Maestro del Timeframe",
  9: "Sentinella dei Mercati",
  10: "Stratega dell'Incertezza",
  11: "Architetto del Piano",
  12: "Mente Antifrágile",
  13: "Ombra del Mercato",
  14: "Custode della Disciplina",
  15: "Ninja della Liquidità",
  16: "Alchimista delle Probabilità",
  17: "Falco dello Smart Money",
  18: "Sensei dell'Order Flow",
  19: "Leggenda del Trading",
  20: "Maestro Supremo",
};

function getLevelName(level: number): string {
  if (level in LEVEL_NAMES) return LEVEL_NAMES[level];
  if (level > 20) return "Maestro Supremo";
  return `Trader Livello ${level}`;
}

const AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${unique}${path.extname(file.originalname)}`);
  },
});
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Solo immagini JPG, PNG, WebP e GIF sono consentite"));
    }
  },
});

function computeLevel(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  return { level, xpToNextLevel };
}

function computeStreakBonus(streak: number): number {
  if (streak <= 1) return 0;
  return Math.min(50, (streak - 1) * 5);
}

async function updateStreak(profileId: number): Promise<{ newStreak: number; bonusXp: number }> {
  const [current] = await db.select({ streak: profileTable.streak, lastActiveDate: profileTable.lastActiveDate, xp: profileTable.xp })
    .from(profileTable).where(eq(profileTable.id, profileId)).limit(1);
  if (!current) return { newStreak: 0, bonusXp: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (current.lastActiveDate === today) return { newStreak: current.streak, bonusXp: 0 };

  const newStreak = current.lastActiveDate === yesterday ? (current.streak || 0) + 1 : 1;
  const bonusXp = computeStreakBonus(newStreak);

  await db.update(profileTable)
    .set({
      streak: newStreak,
      lastActiveDate: today,
      xp: current.xp + bonusXp,
    })
    .where(eq(profileTable.id, profileId));

  return { newStreak, bonusXp };
}

function getUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

async function generateUniqueName(base: string): Promise<string> {
  const existing = await db.select({ id: profileTable.id })
    .from(profileTable)
    .where(sql`lower(${profileTable.name}) = lower(${base}) AND ${profileTable.userId} IS NOT NULL`)
    .limit(1);
  if (existing.length === 0) return base;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

async function computeWinRate(userId: string | null): Promise<{ winRate: number | null; totalTrades: number }> {
  const filter = userId ? eq(journalEntriesTable.userId, userId) : isNull(journalEntriesTable.userId);
  const entries = await db
    .select({ result: journalEntriesTable.result })
    .from(journalEntriesTable)
    .where(filter);

  const withResult = entries.filter(e => e.result && e.result !== "none");
  const totalTrades = withResult.length;
  if (totalTrades === 0) return { winRate: null, totalTrades: 0 };

  const wins = withResult.filter(e => e.result === "win").length;
  const winRate = Math.round((wins / totalTrades) * 100);
  return { winRate, totalTrades };
}

async function getOrCreateProfile(userId: string | null) {
  const where = userId ? eq(profileTable.userId, userId) : isNull(profileTable.userId);
  const profiles = await db.select().from(profileTable).where(where).limit(1);
  if (profiles.length > 0) return profiles[0];

  const name = userId ? await generateUniqueName("Trader") : "Trader";

  const [created] = await db.insert(profileTable).values({
    name,
    avatarUrl: null,
    xp: 0,
    level: 1,
    userId,
  }).returning();
  return created;
}

async function isNameTaken(name: string, excludeProfileId: number, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const existing = await db.select({ id: profileTable.id })
    .from(profileTable)
    .where(
      and(
        sql`lower(${profileTable.name}) = lower(${name})`,
        ne(profileTable.id, excludeProfileId),
        sql`${profileTable.userId} IS NOT NULL`
      )
    )
    .limit(1);
  return existing.length > 0;
}

router.get("/profile", async (req, res) => {
  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);
  const { newStreak } = await updateStreak(profile.id);
  const freshXp = profile.xp;
  const [fresh] = await db.select({ xp: profileTable.xp, streak: profileTable.streak }).from(profileTable).where(eq(profileTable.id, profile.id)).limit(1);
  const xp = fresh?.xp ?? freshXp;
  const streak = fresh?.streak ?? newStreak;
  const { level, xpToNextLevel } = computeLevel(xp);
  const { winRate, totalTrades } = await computeWinRate(userId);

  const data = GetProfileResponse.parse({
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? null,
    xp,
    level,
    xpToNextLevel,
    streak,
    levelName: getLevelName(level),
    yearsExperience: profile.yearsExperience ?? null,
    winRate,
    totalTrades,
  });
  res.json(data);
});

router.put("/profile", async (req, res) => {
  const userId = getUserId(req);
  const body = UpdateProfileBody.parse(req.body);
  body.name = body.name.trim();
  const profile = await getOrCreateProfile(userId);

  if (userId && body.name !== profile.name) {
    const taken = await isNameTaken(body.name, profile.id, userId);
    if (taken) {
      res.status(409).json({ error: "Nome già in uso da un altro utente" });
      return;
    }
  }

  try {
    const [updated] = await db.update(profileTable)
      .set({
        name: body.name,
        avatarUrl: body.avatarUrl ?? null,
        yearsExperience: body.yearsExperience ?? null,
      })
      .where(eq(profileTable.id, profile.id))
      .returning();

    const { level, xpToNextLevel } = computeLevel(updated.xp);
    const { winRate, totalTrades } = await computeWinRate(userId);
    const data = UpdateProfileResponse.parse({
      id: updated.id,
      name: updated.name,
      avatarUrl: updated.avatarUrl ?? null,
      xp: updated.xp,
      level,
      xpToNextLevel,
      streak: updated.streak,
      levelName: getLevelName(level),
      yearsExperience: updated.yearsExperience ?? null,
      winRate,
      totalTrades,
    });
    res.json(data);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as Record<string, unknown>).code === "23505"
    ) {
      res.status(409).json({ error: "Nome già in uso da un altro utente" });
      return;
    }
    throw err;
  }
});

router.get("/profile/check-name", async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) {
    res.json({ available: false });
    return;
  }

  const userId = getUserId(req);
  if (!userId) {
    res.json({ available: true });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  const taken = await isNameTaken(name, profile.id, userId);
  res.json({ available: !taken });
});

router.post("/profile/avatar", avatarUpload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nessuna immagine caricata" });
    return;
  }

  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);
  const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;

  await db.update(profileTable)
    .set({ avatarUrl })
    .where(eq(profileTable.id, profile.id));

  res.json({ avatarUrl });
});

router.post("/profile/avatar/generate", async (req, res) => {
  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);

  const seed = crypto.createHash("md5")
    .update(`${userId || "guest"}-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .substring(0, 8);

  const styles = [
    "cyberpunk neon trader with glowing visor",
    "futuristic holographic warrior with energy shield",
    "dark fantasy mage with glowing arcane runes",
    "steampunk inventor with brass goggles and gears",
    "sci-fi space commander with starfield background",
    "neon samurai with energy katana",
    "crystal elemental being radiating light",
    "shadowy rogue with glowing emerald eyes",
    "mythical phoenix knight with flaming armor",
    "techno-organic cyborg with circuit patterns",
    "arctic wolf warrior with ice blue markings",
    "golden dragon scale armored paladin",
  ];
  const styleIndex = parseInt(seed, 16) % styles.length;
  const style = styles[styleIndex];

  const prompt = `Professional square avatar portrait, ${style}, unique seed identifier ${seed}, dark moody background with vibrant accent lighting, highly detailed digital art, single character bust portrait facing camera, sharp focus, cinematic lighting`;

  const filename = `ai-avatar-${seed}.png`;
  const outputPath = path.join(AVATARS_DIR, filename);

  try {
    const { generateImageBuffer } = await import("@workspace/integrations-openai-ai-server/image");
    const buffer = await generateImageBuffer(prompt, "512x512");
    fs.writeFileSync(outputPath, buffer);

    const avatarUrl = `/api/uploads/avatars/${filename}`;
    await db.update(profileTable)
      .set({ avatarUrl })
      .where(eq(profileTable.id, profile.id));

    res.json({ avatarUrl });
  } catch (err) {
    console.warn("AI avatar generation failed:", err);
    res.status(500).json({ error: "Generazione avatar fallita. Riprova." });
  }
});

router.get("/leaderboard", async (_req, res) => {
  const profiles = await db.select()
    .from(profileTable)
    .where(isNotNull(profileTable.userId))
    .orderBy(desc(profileTable.xp));

  const leaderboard = profiles.map((p, idx) => {
    const { level } = computeLevel(p.xp);
    return {
      position: idx + 1,
      userId: p.userId ?? null,
      name: p.name,
      avatarUrl: p.avatarUrl ?? null,
      level,
      xp: p.xp,
    };
  });

  const data = GetLeaderboardResponse.parse(leaderboard);
  res.json(data);
});

export { getOrCreateProfile, computeLevel, getUserId, updateStreak, getLevelName };
export default router;
