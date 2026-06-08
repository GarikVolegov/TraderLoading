import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { db, friendshipsTable, profileTable, routineCompletionsTable } from "@workspace/db";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

const RoutineCompletionBody = z.object({
  routineId: z.string().min(1),
  routineTitle: z.string().min(1),
  template: z.enum(["morning", "evening"]),
  answers: z.record(z.string(), z.unknown()).default({}),
});

type CompetitionUser = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

type CompetitionCompletion = {
  userId: string;
  completionDate: string;
  qualityScore: number;
};

export type RoutineCompetitionRow = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalCompletions: number;
  currentStreakDays: number;
  avgQualityScore: number;
  completedToday: boolean;
  score: number;
  isCurrentUser: boolean;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function countMeaningfulAnswers(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return value.trim() ? 1 : 0;
  if (typeof value === "number" || typeof value === "boolean") return 1;
  if (Array.isArray(value)) return value.some((item) => countMeaningfulAnswers(item) > 0) ? 1 : 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => countMeaningfulAnswers(item) > 0) ? 1 : 0;
  }
  return 0;
}

export function calculateRoutineQualityScore(answers: Record<string, unknown>): number {
  const answered = Object.values(answers).reduce<number>((sum, value) => sum + countMeaningfulAnswers(value), 0);
  return Math.min(100, answered * 20);
}

function daysBetween(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00.000Z`);
  const second = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((first - second) / 86_400_000);
}

function calculateStreak(dates: string[], today: string): number {
  const uniqueDates = [...new Set(dates)].sort().reverse();
  if (uniqueDates.length === 0) return 0;

  let streak = 0;
  let previous: string | null = null;

  for (const date of uniqueDates) {
    if (!previous) {
      const gapFromToday = daysBetween(today, date);
      if (gapFromToday > 1) break;
      streak = 1;
      previous = date;
      continue;
    }

    if (daysBetween(previous, date) !== 1) break;
    streak += 1;
    previous = date;
  }

  return streak;
}

export function buildRoutineCompetitionRows({
  users,
  completions,
  currentUserId,
  today = todayKey(),
}: {
  users: CompetitionUser[];
  completions: CompetitionCompletion[];
  currentUserId: string;
  today?: string;
}): RoutineCompetitionRow[] {
  const rows = users.map((user) => {
    const userCompletions = completions.filter((completion) => completion.userId === user.userId);
    const totalCompletions = userCompletions.length;
    const currentStreakDays = calculateStreak(userCompletions.map((completion) => completion.completionDate), today);
    const avgQualityScore = totalCompletions
      ? Math.round(userCompletions.reduce((sum, completion) => sum + completion.qualityScore, 0) / totalCompletions)
      : 0;
    const completedToday = userCompletions.some((completion) => completion.completionDate === today);
    const score = totalCompletions * 25 + currentStreakDays * 20 + avgQualityScore + (completedToday ? 10 : 0);

    return {
      rank: 0,
      userId: user.userId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      totalCompletions,
      currentStreakDays,
      avgQualityScore,
      completedToday,
      score,
      isCurrentUser: user.userId === currentUserId,
    };
  });

  return rows
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.currentStreakDays !== a.currentStreakDays) return b.currentStreakDays - a.currentStreakDays;
      if (b.totalCompletions !== a.totalCompletions) return b.totalCompletions - a.totalCompletions;
      return a.name.localeCompare(b.name);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

router.post("/routines/completions", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const body = RoutineCompletionBody.parse(req.body);
  const completedAt = new Date();
  const completionDate = completedAt.toISOString().slice(0, 10);
  const qualityScore = calculateRoutineQualityScore(body.answers);

  const [record] = await db
    .insert(routineCompletionsTable)
    .values({
      userId,
      routineId: body.routineId,
      routineTitle: body.routineTitle,
      template: body.template,
      answersJson: JSON.stringify(body.answers),
      qualityScore,
      completionDate,
      completedAt,
    })
    .returning();

  res.status(201).json({
    id: record.id,
    qualityScore: record.qualityScore,
    completionDate: record.completionDate,
  });
});

router.get("/routines/competition", async (req, res) => {
  const currentUserId = getUserId(req);
  if (!currentUserId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const friendships = await db
    .select({
      userId: friendshipsTable.userId,
      friendId: friendshipsTable.friendId,
    })
    .from(friendshipsTable)
    .where(
      and(
        or(eq(friendshipsTable.userId, currentUserId), eq(friendshipsTable.friendId, currentUserId)),
        eq(friendshipsTable.status, "accepted"),
      ),
    );

  const friendIds = friendships.map((friendship) =>
    friendship.userId === currentUserId ? friendship.friendId : friendship.userId,
  );
  const participantIds = [currentUserId, ...friendIds];

  const users = await db
    .select({
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
    })
    .from(profileTable)
    .where(sql`${profileTable.userId} IN (${sql.join(participantIds.map((id) => sql`${id}`), sql`, `)}) AND ${profileTable.userId} IS NOT NULL`);

  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const completions = await db
    .select({
      userId: routineCompletionsTable.userId,
      completionDate: routineCompletionsTable.completionDate,
      qualityScore: routineCompletionsTable.qualityScore,
    })
    .from(routineCompletionsTable)
    .where(
      and(
        sql`${routineCompletionsTable.userId} IN (${sql.join(participantIds.map((id) => sql`${id}`), sql`, `)})`,
        gte(routineCompletionsTable.completionDate, since),
      ),
    );

  const rows = buildRoutineCompetitionRows({
    users: users
      .filter((user): user is CompetitionUser => typeof user.userId === "string")
      .map((user) => ({ userId: user.userId, name: user.name, avatarUrl: user.avatarUrl ?? null })),
    completions,
    currentUserId,
  });

  res.json(rows);
});

export default router;
