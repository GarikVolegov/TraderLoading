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
import { and, eq, sql } from "drizzle-orm";
import { computeStandings, type StandingInput } from "./standings.js";
import { mapAccountTradeToTorneiTrade, disciplineIndexFor } from "./tradeMapping.js";

export { mapAccountTradeToTorneiTrade, disciplineIndexFor, nextDivisionFor } from "./tradeMapping.js";

// ── Stagione attiva: la live, altrimenti la prossima upcoming ────────────────
export async function getActiveSeason(): Promise<TournamentSeason | null> {
  const [live] = await db
    .select()
    .from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.status, "live"))
    .limit(1);
  if (live) return live;
  const [upcoming] = await db
    .select()
    .from(tournamentSeasonsTable)
    .where(eq(tournamentSeasonsTable.status, "upcoming"))
    .orderBy(sql`${tournamentSeasonsTable.startsAt} asc`)
    .limit(1);
  return upcoming ?? null;
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
}

// Conto reale sincronizzato dell'utente: il brokerAccountId più recente con
// trade sincronizzati. Null se l'utente non ha trade sincronizzati.
export async function resolveSyncedAccount(userId: string): Promise<{ accountId: string } | null> {
  const [row] = await db
    .select({ brokerAccountId: accountTradesTable.brokerAccountId })
    .from(accountTradesTable)
    .where(eq(accountTradesTable.userId, userId))
    .orderBy(sql`${accountTradesTable.updatedAt} desc`)
    .limit(1);
  if (!row) return null;
  return { accountId: row.brokerAccountId ?? "synced" };
}

export async function countEnrollments(seasonId: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tournamentEnrollmentsTable)
    .where(eq(tournamentEnrollmentsTable.seasonId, seasonId));
  return n ?? 0;
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

  const inputs: StandingInput[] = [];
  for (const enr of enrollments) {
    const enrolledMs = enr.enrolledAt.getTime();
    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
      .from(profileTable)
      .where(eq(profileTable.userId, enr.userId))
      .limit(1);

    const rows = await db
      .select({
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
      .where(and(eq(accountTradesTable.userId, enr.userId), eq(accountTradesTable.status, "closed")));

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

  const [me] = await db
    .select()
    .from(tournamentStandingsTable)
    .where(
      and(
        eq(tournamentStandingsTable.seasonId, seasonId),
        eq(tournamentStandingsTable.userId, viewerUserId),
      ),
    )
    .limit(1);

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tournamentStandingsTable)
    .where(and(eq(tournamentStandingsTable.seasonId, seasonId), eq(tournamentStandingsTable.dq, false)));

  return { board, dq, me: me ?? null, total: n ?? 0 };
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
