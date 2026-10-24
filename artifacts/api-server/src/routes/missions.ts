import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { missionsTable, missionTemplatesTable, profileTable } from "@workspace/db";
import { GetMissionsResponse, CompleteMissionParams, CompleteMissionResponse } from "@workspace/api-zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getOrCreateProfile, computeLevel, getUserId, updateStreak, getLevelName } from "./profile.js";
import { awardLevelCertificate } from "./milestones.js";
import { tradingDay } from "../lib/tradingTime.js";
import { MISSION_XP_MAX } from "../lib/missionXp.js";

const router: IRouter = Router();

type MissionSeed = {
  title: string;
  description: string;
  xpReward: number;
};

// Fallback per chi non ha ancora configurato template personalizzati in Impostazioni.
const DEFAULT_MISSIONS: MissionSeed[] = [
  {
    title: "Checklist pre-trade",
    description: "Spunta tutti i criteri d'entrata prima di aprire una posizione",
    xpReward: 10,
  },
  {
    title: "Aggiorna il diario",
    description: "Registra o sincronizza almeno un trade di oggi nel Diario",
    xpReward: 15,
  },
  {
    title: "Check-in emotivo",
    description: "Registra il tuo stato d'animo all'apertura della sessione",
    xpReward: 10,
  },
];

async function ensureTodayMissions(userId: string | null) {
  return db.transaction(async tx => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('traderloading.missions.create'), hashtext(${userId ?? "anonymous"}))`);
  const today = tradingDay(new Date())!;
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  const existing = await tx.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));

  if (existing.length === 0) {
    const templateFilter = userId ? eq(missionTemplatesTable.userId, userId) : isNull(missionTemplatesTable.userId);
    const userTemplates = await tx.select().from(missionTemplatesTable).where(templateFilter);

    const missionsToCreate = userTemplates.length > 0
      ? userTemplates.map((t) => ({ title: t.title, description: t.description, xpReward: t.xpReward }))
      : DEFAULT_MISSIONS;

    if (missionsToCreate.length > 0) {
      await tx.insert(missionsTable).values(
        missionsToCreate.map((m) => ({
          ...m,
          completed: false,
          missionDate: today,
          userId,
        }))
      );
    }
    return await tx.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));
  }

  return existing;
  });
}

// NOTE: DELETE /missions/reset-today was removed. It had no auth/dev guard and
// no XP ledger, so the loop complete -> reset-today -> complete re-awarded XP
// indefinitely (unbounded XP feeds the Pro leaderboard). It was never called by
// the frontend. Daily missions already regenerate per calendar day.

router.get("/missions", async (req, res) => {
  const userId = getUserId(req);
  const missions = await ensureTodayMissions(userId);

  const data = GetMissionsResponse.parse(
    missions.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      xpReward: m.xpReward,
      completed: m.completed,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    }))
  );
  res.json(data);
});

router.post("/missions/:id/complete", async (req, res) => {
  const userId = getUserId(req);
  const { id } = CompleteMissionParams.parse({ id: Number(req.params.id) });

  const today = tradingDay(new Date())!;
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  const [mission] = await db
    .select()
    .from(missionsTable)
    .where(and(eq(missionsTable.id, id), eq(missionsTable.missionDate, today), userFilter));

  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }

  if (mission.completed) {
    res.status(400).json({ error: "Mission already completed" });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  const oldLevel = computeLevel(profile.xp).level;
  const awardXp = Math.min(Math.max(mission.xpReward, 0), MISSION_XP_MAX);
  const completion = await db.transaction(async tx => {
    const [updatedMission] = await tx.update(missionsTable)
      .set({ completed: true, completedAt: new Date() })
      .where(and(eq(missionsTable.id, id), eq(missionsTable.completed, false)))
      .returning();
    if (!updatedMission) return null;
    // Serialize streak changes on the profile row; completion, daily bonus and
    // reward are committed together, including on two simultaneous missions.
    const { newStreak, bonusXp } = await updateStreak(profile.id, tx);
    const [updatedProfile] = await tx.update(profileTable)
      .set({ xp: sql`${profileTable.xp} + ${awardXp + bonusXp}` })
      .where(eq(profileTable.id, profile.id)).returning();
    return { updatedMission, newStreak, finalXp: updatedProfile.xp };
  });
  if (!completion) { res.status(400).json({ error: "Mission already completed" }); return; }
  const { updatedMission, newStreak, finalXp } = completion;

  const { level } = computeLevel(finalXp);
  const levelUp = level > oldLevel;

  if (levelUp && userId) {
    for (let l = oldLevel + 1; l <= level; l++) {
      awardLevelCertificate(userId, l).catch(() => {});
    }
  }

  const [freshProfile] = await db.select().from(profileTable).where(eq(profileTable.id, profile.id)).limit(1);

  const data = CompleteMissionResponse.parse({
    mission: {
      id: updatedMission.id,
      title: updatedMission.title,
      description: updatedMission.description,
      xpReward: updatedMission.xpReward,
      completed: updatedMission.completed,
      completedAt: updatedMission.completedAt ? updatedMission.completedAt.toISOString() : null,
    },
    profile: {
      id: freshProfile.id,
      name: freshProfile.name,
      avatarUrl: freshProfile.avatarUrl ?? null,
      xp: freshProfile.xp,
      level: computeLevel(freshProfile.xp).level,
      xpToNextLevel: computeLevel(freshProfile.xp).xpToNextLevel,
      streak: newStreak,
      levelName: getLevelName(computeLevel(freshProfile.xp).level),
    },
    levelUp,
  });

  res.json(data);
});

export default router;
