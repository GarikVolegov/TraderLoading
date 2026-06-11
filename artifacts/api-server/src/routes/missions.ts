import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { missionsTable, missionTemplatesTable, profileTable } from "@workspace/db";
import { GetMissionsResponse, CompleteMissionParams, CompleteMissionResponse } from "@workspace/api-zod";
import { eq, and, isNull } from "drizzle-orm";
import { getOrCreateProfile, computeLevel, getUserId, updateStreak, getLevelName } from "./profile.js";
import { awardLevelCertificate } from "./milestones.js";

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
  const today = new Date().toISOString().slice(0, 10);
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  const existing = await db.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));

  if (existing.length === 0) {
    const templateFilter = userId ? eq(missionTemplatesTable.userId, userId) : isNull(missionTemplatesTable.userId);
    const userTemplates = await db.select().from(missionTemplatesTable).where(templateFilter);

    const missionsToCreate = userTemplates.length > 0
      ? userTemplates.map((t) => ({ title: t.title, description: t.description, xpReward: t.xpReward }))
      : DEFAULT_MISSIONS;

    if (missionsToCreate.length > 0) {
      await db.insert(missionsTable).values(
        missionsToCreate.map((m) => ({
          ...m,
          completed: false,
          missionDate: today,
          userId,
        }))
      );
    }
    return await db.select().from(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));
  }

  return existing;
}

router.delete("/missions/reset-today", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId(req);
  const userFilter = userId ? eq(missionsTable.userId, userId) : isNull(missionsTable.userId);
  
  await db.delete(missionsTable).where(and(eq(missionsTable.missionDate, today), userFilter));
  res.json({ success: true, message: "Today's missions cleared" });
});

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

  const today = new Date().toISOString().slice(0, 10);
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

  const [updatedMission] = await db
    .update(missionsTable)
    .set({ completed: true, completedAt: new Date() })
    .where(eq(missionsTable.id, id))
    .returning();

  const profile = await getOrCreateProfile(userId);
  const oldLevel = computeLevel(profile.xp).level;

  const [updatedProfile] = await db
    .update(profileTable)
    .set({ xp: profile.xp + mission.xpReward })
    .where(eq(profileTable.id, profile.id))
    .returning();

  const { newStreak, bonusXp } = await updateStreak(profile.id);
  const finalXp = updatedProfile.xp + bonusXp;
  if (bonusXp > 0) {
    await db.update(profileTable).set({ xp: finalXp }).where(eq(profileTable.id, profile.id));
  }

  const { level, xpToNextLevel } = computeLevel(finalXp);
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
