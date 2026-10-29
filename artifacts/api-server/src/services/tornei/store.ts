// Store layer dei Tornei: iscrizione, materializzazione della classifica e
// letture (board, riga utente, albo d'oro). La materializzazione è l'unico punto
// che legge `accountTradesTable`; le letture lavorano sulla tabella standings
// pre-calcolata (nessuna aggregazione a runtime).

import {
  db,
  accountTradesTable,
  profileTable,
  tournamentSeasonsTable,
  tournamentEnrollmentsTable,
  tournamentStandingsTable,
  type TournamentSeason,
  type TournamentStanding,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { singleFlight } from "../../lib/singleFlight.js";
import { computeStandings, type StandingInput } from "./standings.js";
import { mapAccountTradeToTorneiTrade, disciplineIndexFor } from "./tradeMapping.js";

export { mapAccountTradeToTorneiTrade, disciplineIndexFor, nextDivisionFor } from "./tradeMapping.js";

// ── In-Memory Micro-Cache & Single-Flight Anti-Burst ─────────────────────────
const activeSeasonInFlight = new Map<string, Promise<TournamentSeason | null>>();
let cachedActiveSeason: { value: TournamentSeason | null; expiresAt: number } | null = null;
const ACTIVE_SEASON_TTL_MS = 15_000;

export function invalidateActiveSeasonCache(): void {
  cachedActiveSeason = null;
}

const enrollmentCountInFlight = new Map<string, Promise<number>>();
const cachedEnrollmentCounts = new Map<number, { count: number; expiresAt: number }>();
const ENROLLMENT_COUNT_TTL_MS = 10_000;

export function invalidateEnrollmentCountCache(seasonId?: number): void {
  if (seasonId !== undefined) {
    cachedEnrollmentCounts.delete(seasonId);
  } else {
    cachedEnrollmentCounts.clear();
  }
}

type CachedBoard = {
  board: TournamentStanding[];
  dq: TournamentStanding[];
  total: number;
  expiresAt: number;
};

const boardInFlight = new Map<string, Promise<CachedBoard>>();
const cachedBoards = new Map<string, CachedBoard>();
const BOARD_TTL_MS = 10_000;

export function invalidateBoardCache(): void {
  cachedBoards.clear();
}

// ── Stagione attiva: la live, altrimenti la prossima upcoming ────────────────
export async function getActiveSeason(): Promise<TournamentSeason | null> {
  const now = Date.now();
  if (cachedActiveSeason && cachedActiveSeason.expiresAt > now) {
    return cachedActiveSeason.value;
  }

  return singleFlight(activeSeasonInFlight, "active-season", async () => {
    const freshNow = Date.now();
    if (cachedActiveSeason && cachedActiveSeason.expiresAt > freshNow) {
      return cachedActiveSeason.value;
    }

    const [live] = await db
      .select()
      .from(tournamentSeasonsTable)
      .where(eq(tournamentSeasonsTable.status, "live"))
      .limit(1);
    if (live) {
      cachedActiveSeason = { value: live, expiresAt: Date.now() + ACTIVE_SEASON_TTL_MS };
      return live;
    }

    const [upcoming] = await db
      .select()
      .from(tournamentSeasonsTable)
      .where(eq(tournamentSeasonsTable.status, "upcoming"))
      .orderBy(sql`${tournamentSeasonsTable.startsAt} asc`)
      .limit(1);

    const res = upcoming ?? null;
    cachedActiveSeason = { value: res, expiresAt: Date.now() + ACTIVE_SEASON_TTL_MS };
    return res;
  });
}

export async function getSeasonById(seasonId: number): Promise<TournamentSeason | null> {
  const [season] = await db
    .select()
    .from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.id, seasonId))
    .limit(1);
  return season ?? null;
}

// ── Iscrizione idempotente ───────────────────────────────────────────────────
export async function enrollUser(args: {
  seasonId: number;
  userId: string;
  accountId: string;
}): Promise<void> {
  await db
    .insert(tournamentEnrollmentsTable)
    .values({ seasonId: args.seasonId, userId: args.userId, accountId: args.accountId })
    .onConflictDoNothing({
      target: [tournamentEnrollmentsTable.seasonId, tournamentEnrollmentsTable.userId],
    });
  invalidateEnrollmentCountCache(args.seasonId);
}

// Conto REALE sincronizzato dell'utente: il brokerAccountId più recente con
// trade sincronizzati NON demo/manual. Null se l'utente ha solo trade demo/manual.
// Il torneo richiede un conto reale: i trade del demoConnector (source='demo') e
// quelli inseriti a mano dal diario (source='manual') hanno saldo/profitti arbitrari
// e renderebbero la classifica manipolabile.
export async function resolveSyncedAccount(userId: string): Promise<{ accountId: string } | null> {
  const [row] = await db
    .select({ brokerAccountId: accountTradesTable.brokerAccountId })
    .from(accountTradesTable)
    .where(and(eq(accountTradesTable.userId, userId), sql`${accountTradesTable.source} NOT IN ('demo', 'manual')`))
    .orderBy(sql`${accountTradesTable.updatedAt} desc`)
    .limit(1);
  if (!row) return null;
  return { accountId: row.brokerAccountId ?? "synced" };
}

export async function countEnrollments(seasonId: number): Promise<number> {
  const now = Date.now();
  const cached = cachedEnrollmentCounts.get(seasonId);
  if (cached && cached.expiresAt > now) {
    return cached.count;
  }

  return singleFlight(enrollmentCountInFlight, `count-enrollments:${seasonId}`, async () => {
    const freshNow = Date.now();
    const freshCached = cachedEnrollmentCounts.get(seasonId);
    if (freshCached && freshCached.expiresAt > freshNow) {
      return freshCached.count;
    }

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tournamentEnrollmentsTable)
      .where(eq(tournamentEnrollmentsTable.seasonId, seasonId));
    const count = n ?? 0;
    cachedEnrollmentCounts.set(seasonId, { count, expiresAt: Date.now() + ENROLLMENT_COUNT_TTL_MS });
    return count;
  });
}

export async function isEnrolled(seasonId: number, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tournamentEnrollmentsTable.id })
    .from(tournamentEnrollmentsTable)
    .where(
      and(
        eq(tournamentEnrollmentsTable.seasonId, seasonId),
        eq(tournamentEnrollmentsTable.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// ── Materializzazione classifica ─────────────────────────────────────────────
export async function materializeStandings(seasonId: number, metric: "r" | "ts" = "r"): Promise<void> {
  const season = await getSeasonById(seasonId);
  if (!season) return;
  const endsAtMs = season.endsAt.getTime();

  const enrollments = await db
    .select({
      userId: tournamentEnrollmentsTable.userId,
      enrolledAt: tournamentEnrollmentsTable.enrolledAt,
    })
    .from(tournamentEnrollmentsTable)
    .where(eq(tournamentEnrollmentsTable.seasonId, seasonId));
  if (enrollments.length === 0) return;

  // prevRank dalle standings correnti, prima di sovrascrivere.
  const existing = await db
    .select({ userId: tournamentStandingsTable.userId, rank: tournamentStandingsTable.rank })
    .from(tournamentStandingsTable)
    .where(eq(tournamentStandingsTable.seasonId, seasonId));
  const prevRankByUser = new Map(existing.map((r) => [r.userId, r.rank]));

  const enrolledUserIds = enrollments.map((e) => e.userId);

  const [profiles, allTradeRows] = await Promise.all([
    db
      .select({
        userId: profileTable.userId,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
      })
      .from(profileTable)
      .where(inArray(profileTable.userId, enrolledUserIds)),
    db
      .select({
        userId: accountTradesTable.userId,
        symbol: accountTradesTable.symbol,
        direction: accountTradesTable.direction,
        openTime: accountTradesTable.openTime,
        closeTime: accountTradesTable.closeTime,
        entryPrice: accountTradesTable.entryPrice,
        exitPrice: accountTradesTable.exitPrice,
        stopLoss: accountTradesTable.stopLoss,
        profit: accountTradesTable.profit,
        returnPct: accountTradesTable.returnPct,
        journalEntryId: accountTradesTable.journalEntryId,
      })
      .from(accountTradesTable)
      .where(
        and(
          inArray(accountTradesTable.userId, enrolledUserIds),
          eq(accountTradesTable.status, "closed"),
          // Only real-account trades count; demo deals and hand-entered manual
          // journal trades are excluded (both are user-controllable → manipulable).
          sql`${accountTradesTable.source} NOT IN ('demo', 'manual')`,
        ),
      ),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const tradesByUser = new Map<string, typeof allTradeRows>();
  for (const row of allTradeRows) {
    if (!row.userId) continue;
    const list = tradesByUser.get(row.userId) ?? [];
    list.push(row);
    tradesByUser.set(row.userId, list);
  }

  const inputs: StandingInput[] = [];
  for (const enr of enrollments) {
    const enrolledMs = enr.enrolledAt.getTime();
    const profile = profileByUser.get(enr.userId);
    const rows = tradesByUser.get(enr.userId) ?? [];

    const windowed = rows.filter((r) => {
      if (!r.closeTime) return false;
      const ms = Date.parse(r.closeTime);
      return Number.isFinite(ms) && ms >= enrolledMs && ms < endsAtMs;
    });
    const trades = windowed.map(mapAccountTradeToTorneiTrade);

    inputs.push({
      userId: enr.userId,
      displayName: profile?.name ?? "Trader",
      avatarUrl: profile?.avatarUrl ?? null,
      trades,
      discIndex: disciplineIndexFor(trades),
    });
  }

  const computed = computeStandings(inputs, metric);
  const now = new Date();

  for (const row of computed) {
    const prevRank = prevRankByUser.get(row.userId) ?? row.rank;
    await db
      .insert(tournamentStandingsTable)
      .values({
        seasonId,
        userId: row.userId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        rCum: row.rCum,
        discIndex: row.discIndex,
        score: row.score,
        division: row.division,
        rank: row.rank,
        prevRank,
        trades: row.trades,
        dq: row.dq,
        dqReason: row.dqReason,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tournamentStandingsTable.seasonId, tournamentStandingsTable.userId],
        set: {
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          rCum: row.rCum,
          discIndex: row.discIndex,
          score: row.score,
          division: row.division,
          rank: row.rank,
          prevRank,
          trades: row.trades,
          dq: row.dq,
          dqReason: row.dqReason,
          updatedAt: now,
        },
      });
  }
  invalidateBoardCache();
}

// ── Letture board ────────────────────────────────────────────────────────────
const BOARD_LIMIT = 25;

// Espressione di ordinamento per metrica (R cumulato vs Disciplina).
function orderExpr(metric: "r" | "ts") {
  return metric === "ts"
    ? sql`${tournamentStandingsTable.rCum} * ${tournamentStandingsTable.discIndex} desc`
    : sql`${tournamentStandingsTable.score} desc`;
}

export async function readBoard(
  seasonId: number,
  metric: "r" | "ts",
  viewerUserId: string,
): Promise<{
  board: TournamentStanding[];
  dq: TournamentStanding[];
  me: TournamentStanding | null;
  total: number;
}> {
  const cacheKey = `${seasonId}:${metric}`;
  const now = Date.now();
  let baseData = cachedBoards.get(cacheKey);

  if (!baseData || baseData.expiresAt <= now) {
    baseData = await singleFlight(boardInFlight, cacheKey, async () => {
      const freshNow = Date.now();
      const freshCached = cachedBoards.get(cacheKey);
      if (freshCached && freshCached.expiresAt > freshNow) {
        return freshCached;
      }

      const ranked = await db
        .select()
        .from(tournamentStandingsTable)
        .where(and(eq(tournamentStandingsTable.seasonId, seasonId), eq(tournamentStandingsTable.dq, false)))
        .orderBy(orderExpr(metric))
        .limit(BOARD_LIMIT);

      // Per la metrica Disciplina il rango è ricalcolato in lettura (sort limitato).
      const board =
        metric === "ts" ? ranked.map((r, i) => ({ ...r, rank: i + 1 })) : ranked;

      const dq = await db
        .select()
        .from(tournamentStandingsTable)
        .where(and(eq(tournamentStandingsTable.seasonId, seasonId), eq(tournamentStandingsTable.dq, true)));

      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(tournamentStandingsTable)
        .where(and(eq(tournamentStandingsTable.seasonId, seasonId), eq(tournamentStandingsTable.dq, false)));

      const computed = { board, dq, total: n ?? 0, expiresAt: Date.now() + BOARD_TTL_MS };
      cachedBoards.set(cacheKey, computed);
      return computed;
    });
  }

  // Me dall'albo in memoria se presente, altrimenti query mirata
  let me = baseData.board.find((s) => s.userId === viewerUserId) ?? baseData.dq.find((s) => s.userId === viewerUserId) ?? null;
  if (!me && viewerUserId) {
    const [fetchedMe] = await db
      .select()
      .from(tournamentStandingsTable)
      .where(
        and(
          eq(tournamentStandingsTable.seasonId, seasonId),
          eq(tournamentStandingsTable.userId, viewerUserId),
        ),
      )
      .limit(1);
    me = fetchedMe ?? null;
  }

  return { board: baseData.board, dq: baseData.dq, me, total: baseData.total };
}

// ── Albo d'oro: stagioni concluse + il loro campione (rank 1) ─────────────────
export async function readHall(): Promise<
  {
    seasonLabel: string;
    startsAt: Date;
    endsAt: Date;
    champion: string | null;
    rCum: number | null;
    discIndex: number | null;
  }[]
> {
  const seasons = await db
    .select()
    .from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.status, "ended"))
    .orderBy(sql`${tournamentSeasonsTable.endsAt} desc`);

  const out: Awaited<ReturnType<typeof readHall>> = [];
  for (const s of seasons) {
    const [champ] = await db
      .select({
        displayName: tournamentStandingsTable.displayName,
        rCum: tournamentStandingsTable.rCum,
        discIndex: tournamentStandingsTable.discIndex,
      })
      .from(tournamentStandingsTable)
      .where(
        and(
          eq(tournamentStandingsTable.seasonId, s.id),
          eq(tournamentStandingsTable.rank, 1),
          eq(tournamentStandingsTable.dq, false),
        ),
      )
      .limit(1);
    out.push({
      seasonLabel: s.label,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      champion: champ?.displayName ?? null,
      rCum: champ?.rCum ?? null,
      discIndex: champ?.discIndex ?? null,
    });
  }
  return out;
}
