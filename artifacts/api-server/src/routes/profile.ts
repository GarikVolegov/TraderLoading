import { imageMatchesType } from "../lib/imageValidation.js";
import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { accountTradesTable, profileTable } from "@workspace/db";
import { UpdateProfileBody, UpdateProfileResponse, GetProfileResponse, GetLeaderboardResponse } from "@workspace/api-zod";
import { eq, isNull, and, ne, sql, isNotNull, desc } from "drizzle-orm";
import { resolveUploadPath } from "../lib/uploads.js";
import { tradingDay } from "../lib/tradingTime.js";
import { requireProFeature } from "../lib/billing.js";
import { getOperatorIntegrityReport } from "../services/integrityEngine.js";
import { canPublishPlatformContent as isPlatformAdmin } from "../lib/adminAuth.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";

const router: IRouter = Router();
const avatarGenerateLimiter = createMoneyRateLimiter({
  windowMs: 60_000,
  limit: 4,
  scope: "avatar-generate",
});

const XP_PER_LEVEL = 500;

const LEVEL_NAMES: Record<number, string> = {
  1: "GRADO I — Il Neofita al Varco",
  2: "GRADO I — Il Neofita al Varco",
  3: "GRADO I — Il Neofita al Varco",
  4: "GRADO II — Il Custode della Regola",
  5: "GRADO II — Il Custode della Regola",
  6: "GRADO II — Il Custode della Regola",
  7: "GRADO II — Il Custode della Regola",
  8: "GRADO III — L'Osservatore Sovrano",
  9: "GRADO III — L'Osservatore Sovrano",
  10: "GRADO III — L'Osservatore Sovrano",
  11: "GRADO III — L'Osservatore Sovrano",
  12: "GRADO III — L'Osservatore Sovrano",
  13: "GRADO IV — L'Architetto del Reale",
  14: "GRADO IV — L'Architetto del Reale",
  15: "GRADO IV — L'Architetto del Reale",
  16: "GRADO IV — L'Architetto del Reale",
  17: "GRADO IV — L'Architetto del Reale",
  18: "GRADO IV — L'Architetto del Reale",
  19: "GRADO V — Il Fondatore d'Eredità",
  20: "GRADO V — Il Fondatore d'Eredità",
};

function getLevelName(level: number): string {
  if (level in LEVEL_NAMES) return LEVEL_NAMES[level];
  if (level > 20) return "GRADO V — Il Fondatore d'Eredità";
  return "GRADO I — Il Neofita al Varco";
}

const AVATARS_DIR = resolveUploadPath("avatars");
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

async function updateStreak(profileId: number, conn: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<{ newStreak: number; bonusXp: number }> {
  const [current] = await conn.select({ streak: profileTable.streak, lastActiveDate: profileTable.lastActiveDate })
    .from(profileTable).where(eq(profileTable.id, profileId)).limit(1).for("update");
  if (!current) return { newStreak: 0, bonusXp: 0 };

  const today = tradingDay(new Date())!;
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

  if (current.lastActiveDate === today) return { newStreak: current.streak, bonusXp: 0 };

  const newStreak = current.lastActiveDate === yesterday ? (current.streak || 0) + 1 : 1;
  const bonusXp = computeStreakBonus(newStreak);

  // Only advance the streak state here — XP is NOT applied. The caller applies
  // `bonusXp` exactly once, atomically (sql`xp + bonusXp`, see missions.ts). Writing
  // xp here too caused a double credit of the streak bonus (audit 0.6).
  await conn.update(profileTable)
    .set({
      streak: newStreak,
      lastActiveDate: today,
    })
    .where(eq(profileTable.id, profileId));

  return { newStreak, bonusXp };
}

function getUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

async function computeWinRate(userId: string | null): Promise<{ winRate: number | null; totalTrades: number }> {
  const filter = userId ? eq(accountTradesTable.userId, userId) : eq(accountTradesTable.userId, "guest");
  const [agg] = await db
    .select({
      totalTrades: sql<number>`count(*)::int`,
      wins: sql<number>`count(*) filter (where ${accountTradesTable.profit} > 0)::int`,
    })
    .from(accountTradesTable)
    .where(and(filter, eq(accountTradesTable.status, "closed"), isNotNull(accountTradesTable.profit)));

  const totalTrades = Number(agg?.totalTrades ?? 0);
  if (totalTrades === 0) return { winRate: null, totalTrades: 0 };

  const wins = Number(agg?.wins ?? 0);
  const winRate = Math.round((wins / totalTrades) * 100);
  return { winRate, totalTrades };
}

async function getOrCreateProfile(userId: string | null) {
  const where = userId ? eq(profileTable.userId, userId) : isNull(profileTable.userId);
  const profiles = await db.select().from(profileTable).where(where).limit(1);
  if (profiles.length > 0) return profiles[0];

  // The first page requests profile, missions and other resources concurrently.
  // Serialize creation for this identity across API processes, then read again:
  // a check followed by an unguarded insert can create duplicate user profiles.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('traderloading.profile.create'), hashtext(${userId ?? "anonymous"}))`);
    const [existing] = await tx.select().from(profileTable).where(where).limit(1);
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt++) {
      const name = attempt === 0 ? "Trader" : `Trader${crypto.randomUUID().slice(0, 8)}`;
      const [created] = await tx.insert(profileTable).values({
        name, avatarUrl: null, xp: 0, level: 1, userId,
      }).onConflictDoNothing().returning();
      if (created) return created;
    }
    throw new Error("Unable to allocate a unique profile name");
  });
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
  const xp = profile.xp;
  const streak = profile.streak;
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
  if (!body.name) { res.status(400).json({ error: "Nome obbligatorio" }); return; }
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
        avatarUrl: body.avatarUrl === undefined ? profile.avatarUrl : body.avatarUrl,
        yearsExperience: body.yearsExperience === undefined ? profile.yearsExperience : body.yearsExperience,
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

  if (!imageMatchesType(await fs.promises.readFile(req.file.path), req.file.mimetype, req.file.originalname)) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(415).json({ error: "Il file non è un'immagine valida nel formato indicato" });
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

router.post("/profile/avatar/generate", avatarGenerateLimiter, async (req, res) => {
  const userId = getUserId(req);
  if (process.env.NODE_ENV === "production" && !userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }
  const profile = await getOrCreateProfile(userId);
  const previousAvatarUrl = profile.avatarUrl;

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
    await fs.promises.writeFile(outputPath, buffer);

    const avatarUrl = `/api/uploads/avatars/${filename}`;
    await db.update(profileTable)
      .set({ avatarUrl })
      .where(eq(profileTable.id, profile.id));

    if (previousAvatarUrl && previousAvatarUrl.startsWith("/api/uploads/avatars/ai-avatar-")) {
      const oldFilename = path.basename(previousAvatarUrl);
      if (oldFilename !== filename) {
        await fs.promises.unlink(path.join(AVATARS_DIR, oldFilename)).catch(() => {});
      }
    }

    res.json({ avatarUrl });
  } catch (err) {
    console.warn("AI avatar generation failed:", err);
    res.status(500).json({ error: "Generazione avatar fallita. Riprova." });
  }
});

router.get("/profile/integrity", async (req, res) => {
  const userId = getUserId(req);
  const profile = await getOrCreateProfile(userId);
  const { level } = computeLevel(profile.xp);
  const isAdmin = userId ? await isPlatformAdmin(userId) : false;
  const report = await getOperatorIntegrityReport({
    userId,
    legacyLevel: level,
    streak: profile.streak,
    isAdmin,
  });
  res.json(report);
});

router.get("/leaderboard", async (req, res) => {
  if (!(await requireProFeature(req, res, "leaderboard"))) return;
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

interface CachedIntegrityLeaderboard {
  data: unknown[];
  cachedAt: number;
}

let integrityLeaderboardCache: CachedIntegrityLeaderboard | null = null;
let integrityLeaderboardInFlight: Promise<unknown[]> | null = null;
const INTEGRITY_LEADERBOARD_TTL_MS = 60_000;

async function computeIntegrityLeaderboard(): Promise<unknown[]> {
  const profiles = await db
    .select()
    .from(profileTable)
    .where(isNotNull(profileTable.userId))
    .orderBy(desc(profileTable.xp))
    .limit(60);

  // Evaluate in chunks of 5 to prevent PostgreSQL connection pool exhaustion (max: 20)
  const enriched: Array<{
    userId: string | null;
    name: string;
    avatarUrl: string | null;
    level: number;
    xp: number;
    streak: number;
    grade: unknown;
    integrityIndex: number;
    consecutiveIntegralSessions: number;
    consistencyScore: number;
    avgRiskReward: number;
    profitFactor: number;
    recentViolationsCount: number;
    driftDetected: boolean;
    masteryScore: number;
    winRate: number | null;
  }> = [];

  const CHUNK_SIZE = 5;
  for (let i = 0; i < profiles.length; i += CHUNK_SIZE) {
    const chunk = profiles.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (p) => {
        const { level } = computeLevel(p.xp);
        const report = await getOperatorIntegrityReport({
          userId: p.userId ?? null,
          legacyLevel: level,
          streak: p.streak,
        });
        return {
          userId: p.userId ?? null,
          name: p.name,
          avatarUrl: p.avatarUrl ?? null,
          level,
          xp: p.xp,
          streak: p.streak,
          grade: report.currentGrade,
          integrityIndex: report.integrityIndex,
          consecutiveIntegralSessions: report.consecutiveIntegralSessions,
          consistencyScore: report.consistencyScore,
          avgRiskReward: report.avgRiskReward,
          profitFactor: report.profitFactor,
          recentViolationsCount: report.recentViolationsCount,
          driftDetected: report.driftDetected,
          masteryScore: report.masteryScore,
          winRate: report.winRate,
        };
      }),
    );
    enriched.push(...chunkResults);
  }

  enriched.sort((a, b) => {
    if (b.masteryScore !== a.masteryScore) return b.masteryScore - a.masteryScore;
    if (b.integrityIndex !== a.integrityIndex) return b.integrityIndex - a.integrityIndex;
    return b.xp - a.xp;
  });

  return enriched.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
  }));
}

router.get("/leaderboard/integrity", async (req, res) => {
  if (!(await requireProFeature(req, res, "leaderboard"))) return;

  const now = Date.now();
  if (integrityLeaderboardCache && now - integrityLeaderboardCache.cachedAt < INTEGRITY_LEADERBOARD_TTL_MS) {
    res.json(integrityLeaderboardCache.data);
    return;
  }

  if (!integrityLeaderboardInFlight) {
    integrityLeaderboardInFlight = computeIntegrityLeaderboard()
      .then((data) => {
        integrityLeaderboardCache = { data, cachedAt: Date.now() };
        return data;
      })
      .finally(() => {
        integrityLeaderboardInFlight = null;
      });
  }

  try {
    const data = await integrityLeaderboardInFlight;
    res.json(data);
  } catch (err) {
    console.error("[leaderboard/integrity] failed to generate leaderboard", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export { getOrCreateProfile, computeLevel, getUserId, updateStreak, getLevelName };
export default router;
