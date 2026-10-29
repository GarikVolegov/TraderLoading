import { tradingDay } from "../lib/tradingTime.js";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
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
  return tradingDay(new Date())!;
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
  const completionDate = tradingDay(completedAt)!;
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

router.get("/routines/history", async (req, res) => {
  const currentUserId = getUserId(req);
  if (!currentUserId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const since = tradingDay(new Date(Date.now() - 90 * 86_400_000))!;
  const records = await db
    .select()
    .from(routineCompletionsTable)
    .where(
      and(
        eq(routineCompletionsTable.userId, currentUserId),
        gte(routineCompletionsTable.completionDate, since),
      ),
    )
    .orderBy(desc(routineCompletionsTable.completedAt));

  const totalCompletions = records.length;
  const morningCount = records.filter((r) => r.template === "morning").length;
  const eveningCount = records.filter((r) => r.template === "evening").length;

  const dates = records.map((r) => r.completionDate);
  const currentStreakDays = calculateStreak(dates, todayKey());

  // Calcolo longest streak
  const uniqueDatesSorted = [...new Set(dates)].sort();
  let longestStreakDays = 0;
  let runningStreak = 0;
  let prevDate: string | null = null;
  for (const d of uniqueDatesSorted) {
    if (!prevDate) {
      runningStreak = 1;
    } else if (daysBetween(d, prevDate) === 1) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }
    prevDate = d;
    if (runningStreak > longestStreakDays) {
      longestStreakDays = runningStreak;
    }
  }

  const avgQualityScore = totalCompletions
    ? Math.round(records.reduce((sum, r) => sum + r.qualityScore, 0) / totalCompletions)
    : 0;

  // Tasso aderenza 30 giorni (% giorni con almeno un completamento negli ultimi 30 giorni)
  const since30 = tradingDay(new Date(Date.now() - 30 * 86_400_000))!;
  const distinctDays30 = new Set(records.filter((r) => r.completionDate >= since30).map((r) => r.completionDate)).size;
  const adherenceRate30d = Math.min(100, Math.round((distinctDays30 / 30) * 100));

  res.json({
    currentStreakDays,
    longestStreakDays,
    totalCompletions,
    morningCount,
    eveningCount,
    adherenceRate30d,
    avgQualityScore,
    history: records.map((r) => {
      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(r.answersJson || "{}");
      } catch {
        answers = {};
      }
      return {
        id: r.id,
        routineId: r.routineId,
        routineTitle: r.routineTitle,
        template: r.template,
        qualityScore: r.qualityScore,
        answers,
        completionDate: r.completionDate,
        completedAt: r.completedAt,
      };
    }),
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

  const since = tradingDay(new Date(Date.now() - 29 * 86_400_000))!;
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
