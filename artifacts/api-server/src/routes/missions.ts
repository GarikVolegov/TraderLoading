import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { missionsTable, missionTemplatesTable, profileTable } from "@workspace/db";
import { GetMissionsResponse, CompleteMissionParams, CompleteMissionResponse } from "@workspace/api-zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getOrCreateProfile, computeLevel, getUserId, updateStreak, getLevelName } from "./profile.js";
import { awardLevelCertificate } from "./milestones.js";
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

  // Atomic claim: only the request that flips completed false->true awards XP.
  // Without the completed=false guard two concurrent completes (double tap, two
  // buttons) both pass the read check above and double-credit the reward.
  const [updatedMission] = await db
    .update(missionsTable)
    .set({ completed: true, completedAt: new Date() })
    .where(and(eq(missionsTable.id, id), eq(missionsTable.completed, false)))
    .returning();

  if (!updatedMission) {
    res.status(400).json({ error: "Mission already completed" });
    return;
  }

  const profile = await getOrCreateProfile(userId);
  const oldLevel = computeLevel(profile.xp).level;

  // Defense in depth for missions seeded before the template clamp existed.
  const awardXp = Math.min(Math.max(mission.xpReward, 0), MISSION_XP_MAX);

  // Increment atomically (xp = xp + delta) rather than read-modify-write, so
  // concurrent XP grants (e.g. mission + journal) don't clobber each other.
  const [updatedProfile] = await db
    .update(profileTable)
    .set({ xp: sql`${profileTable.xp} + ${awardXp}` })
    .where(eq(profileTable.id, profile.id))
    .returning();

  const { newStreak, bonusXp } = await updateStreak(profile.id);
  let finalXp = updatedProfile.xp;
  if (bonusXp > 0) {
    const [bonusProfile] = await db
      .update(profileTable)
      .set({ xp: sql`${profileTable.xp} + ${bonusXp}` })
      .where(eq(profileTable.id, profile.id))
      .returning();
    finalXp = bonusProfile.xp;
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
