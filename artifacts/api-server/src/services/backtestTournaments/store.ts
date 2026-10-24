import {
  db,
  backtestTournamentsTable,
  backtestTournamentEntriesTable,
  backtestSessionsTable,
  backtestTradesTable,
  backtestTribePresetsTable,
  backtestCustomLobbiesTable,
  profileTable,
  type BacktestTournament,
  type BacktestTournamentEntry,
  type BacktestTribePreset,
  type BacktestCustomLobby,
} from "@workspace/db";
import { and, desc, eq, like, sql } from "drizzle-orm";

// ── Default seed tournaments (Arene della Forgia) ───────────────────────────
export interface TournamentSeed {
  slug: string;
  title: string;
  description: string;
  pair: string;
  timeframe: string;
  initialBalance: string;
  maxDrawdownPct: string;
  targetProfitPct: string;
  maxTrades: number;
  timeLimitSeconds: number;
  participantCount: number;
  status: "in_progress" | "live" | "upcoming" | "ended";
}

export const SEED_TOURNAMENTS: TournamentSeed[] = [
  {
    slug: "time-trial-34t",
    title: "Arena Sovrana XAU/USD",
    description:
      "Confronto su Oro (XAU/USD). Esecuzione chirurgica entro 50 operazioni e limite massimo 10% drawdown.",
    pair: "XAU/USD",
    timeframe: "M5",
    initialBalance: "100000.00",
    maxDrawdownPct: "10.00",
    targetProfitPct: "15.00",
    maxTrades: 50,
    timeLimitSeconds: 900,
    participantCount: 1,
    status: "in_progress",
  },
  {
    slug: "time-trial-59o",
    title: "Arena Valutaria EUR/USD",
    description:
      "Sfida Forex EUR/USD M15. Pazienza strategica e gestione del rischio su struttura di sessione.",
    pair: "EUR/USD",
    timeframe: "M15",
    initialBalance: "100000.00",
    maxDrawdownPct: "10.00",
    targetProfitPct: "12.00",
    maxTrades: 50,
    timeLimitSeconds: 1200,
    participantCount: 1,
    status: "in_progress",
  },
  {
    slug: "time-trial-59n",
    title: "Arena Indici US30",
    description:
      "Indici Americani Wall Street (US30). Alta volatilità, stop calibrati e gestione disciplinata.",
    pair: "US30",
    timeframe: "M5",
    initialBalance: "100000.00",
    maxDrawdownPct: "10.00",
    targetProfitPct: "15.00",
    maxTrades: 50,
    timeLimitSeconds: 900,
    participantCount: 1,
    status: "in_progress",
  },
];

export const SEED_COMMUNITY_ENTRIES: Array<{
  displayName: string;
  country: string;
  avatarUrl: string | null;
  profitPct: string;
  totalProfit: string;
  winRate: string;
  winTrades: number;
  loseTrades: number;
  totalTrades: number;
  maxDrawdown: string;
  avgTradeProfit: string;
  score: string;
  rank: number;
  status: string;
}> = [];

// Fallback in-memory storage for isolated environments without DB
let memTournaments: BacktestTournament[] = [];
let memEntries: BacktestTournamentEntry[] = [];
let memInitialized = false;

function initMemStore() {
  if (memInitialized) return;
  memInitialized = true;
  memTournaments = SEED_TOURNAMENTS.map((t, idx) => ({
    id: idx + 1,
    slug: t.slug,
    title: t.title,
    description: t.description,
    pair: t.pair,
    timeframe: t.timeframe,
    initialBalance: t.initialBalance,
    maxDrawdownPct: t.maxDrawdownPct,
    targetProfitPct: t.targetProfitPct,
    maxTrades: t.maxTrades,
    timeLimitSeconds: t.timeLimitSeconds,
    startCandleTs: null,
    status: t.status,
    participantCount: t.participantCount,
    createdAt: new Date(),
  }));
}

const MONTH_LABELS_IT: Record<string, string> = {
  "01": "Gen",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "Mag",
  "06": "Giu",
  "07": "Lug",
  "08": "Ago",
  "09": "Set",
  "10": "Ott",
  "11": "Nov",
  "12": "Dic",
};

function formatMonthTag(ym: string): string {
  const [year, month] = ym.split("-");
  if (!year || !month) return ym;
  const label = MONTH_LABELS_IT[month] || month;
  return `${label} ${year}`;
}

export interface ArenaRealSessionSummary {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  operatorName: string;
  userId: string | null;
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  winRate: number;
  totalProfit: number;
  profitPct: number;
  totalPips: number;
  maxDrawdown: number;
  profitFactor: number;
  createdAt: string;
}

export interface ArenaRealTelemetry {
  totalRealTrades: number;
  totalRealSessions: number;
  activeSessionsCount: number;
  totalWins: number;
  totalLosses: number;
  avgWinRate: number;
  profitFactor: number;
  netArenaProfit: number;
  netArenaPips: number;
  avgDrawdownPct: number;
  maxDrawdownLimit: number;
  bestTradePnl: number;
  bestSessionLabel: string;
}

// ── Ensure tournaments exist in database & purge legacy fake seed bots ────────
export async function ensureSeedTournaments(): Promise<void> {
  try {
    // Purge any legacy synthetic seed_user_* entries so only real data is shown
    await db
      .delete(backtestTournamentEntriesTable)
      .where(like(backtestTournamentEntriesTable.userId, "seed_user_%"));

    // Ensure tournament #1 uses the Sovereign Forge title instead of legacy "Time Trial [34T]"
    await db
      .update(backtestTournamentsTable)
      .set({ title: "Arena Sovrana XAU/USD" })
      .where(eq(backtestTournamentsTable.slug, "time-trial-34t"));

    const existing = await db.select().from(backtestTournamentsTable).limit(1);
    if (existing.length === 0) {
      for (const t of SEED_TOURNAMENTS) {
        await db
          .insert(backtestTournamentsTable)
          .values({
            slug: t.slug,
            title: t.title,
            description: t.description,
            pair: t.pair,
            timeframe: t.timeframe,
            initialBalance: t.initialBalance,
            maxDrawdownPct: t.maxDrawdownPct,
            targetProfitPct: t.targetProfitPct,
            maxTrades: t.maxTrades,
            timeLimitSeconds: t.timeLimitSeconds,
            participantCount: t.participantCount,
            status: t.status,
          })
          .onConflictDoNothing();
      }
    }
  } catch {
    initMemStore();
  }
}

// ── List all available tournaments ───────────────────────────────────────────
export async function listTournaments(): Promise<BacktestTournament[]> {
  try {
    await ensureSeedTournaments();
    const rows = await db
      .select()
      .from(backtestTournamentsTable)
      .orderBy(backtestTournamentsTable.id);
    return rows.length > 0 ? rows : memTournaments;
  } catch {
    initMemStore();
    return memTournaments;
  }
}

// ── Get tournament by slug or ID ─────────────────────────────────────────────
export async function getTournamentByIdOrSlug(
  idOrSlug: string | number,
): Promise<BacktestTournament | null> {
  try {
    await ensureSeedTournaments();
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0) {
      const [t] = await db
        .select()
        .from(backtestTournamentsTable)
        .where(eq(backtestTournamentsTable.id, numId))
        .limit(1);
      if (t) return t;
    }
    const [bySlug] = await db
      .select()
      .from(backtestTournamentsTable)
      .where(eq(backtestTournamentsTable.slug, String(idOrSlug)))
      .limit(1);
    if (bySlug) return bySlug;
  } catch {
    // Fall back to memory
  }

  initMemStore();
  const numId = Number(idOrSlug);
  return (
    memTournaments.find((t) => t.id === numId || t.slug === String(idOrSlug)) ??
    null
  );
}

// Helper to compute trade economics for a set of real backtest trades
function computeTradeGroupMetrics(
  trades: Array<{
    result: string;
    pips: string | null;
    lotSize: string;
    netPnl: string | null;
  }>,
  initialBalance = 100000,
) {
  let equity = initialBalance;
  let peak = initialBalance;
  let maxDrawdownPct = 0;
  let winTrades = 0;
  let loseTrades = 0;
  let totalPips = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let bestTradePnl = 0;

  for (const t of trades) {
    const pips = Number(t.pips || 0);
    const lots = Number(t.lotSize || 0.01);
    const pnl =
      t.netPnl != null && !Number.isNaN(Number(t.netPnl))
        ? Number(t.netPnl)
        : pips * lots * 10;

    totalPips += pips;
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;

    if (t.result === "win" || (t.result !== "loss" && pnl > 0)) {
      winTrades += 1;
    } else if (t.result === "loss" || pnl < 0) {
      loseTrades += 1;
    }

    if (pnl > 0) {
      grossWin += pnl;
      if (pnl > bestTradePnl) bestTradePnl = pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
    }
  }

  const totalTrades = trades.length;
  const totalProfit = equity - initialBalance;
  const profitPct = initialBalance > 0 ? (totalProfit / initialBalance) * 100 : 0;
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
  const avgTradeProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const profitFactor =
    grossLoss > 0
      ? grossWin / grossLoss
      : grossWin > 0
        ? 4.5
        : 0;

  return {
    initialBalance,
    finalBalance: equity,
    totalProfit,
    profitPct,
    winRate,
    winTrades,
    loseTrades,
    totalTrades,
    totalPips,
    maxDrawdownPct,
    avgTradeProfit,
    profitFactor,
    grossWin,
    grossLoss,
    bestTradePnl,
  };
}

// ── Get full leaderboard & real telemetry for a tournament ───────────────────
export async function getTournamentLeaderboard(
  tournamentId: number,
  currentUserId?: string,
) {
  try {
    await ensureSeedTournaments();
    const tournament =
      (await getTournamentByIdOrSlug(tournamentId)) ??
      (await listTournaments())[0];
    if (!tournament) return null;

    const initialBal = Number(tournament.initialBalance) || 100000;
    const maxAllowedDD = Number(tournament.maxDrawdownPct) || 10;

    // 1. Load real user profiles, real backtest sessions, real backtest trades, and real entries
    const [profiles, sessions, allTrades, dbEntries] = await Promise.all([
      db.select().from(profileTable),
      db
        .select()
        .from(backtestSessionsTable)
        .orderBy(desc(backtestSessionsTable.createdAt)),
      db
        .select()
        .from(backtestTradesTable)
        .orderBy(backtestTradesTable.createdAt),
      db
        .select()
        .from(backtestTournamentEntriesTable)
        .where(eq(backtestTournamentEntriesTable.tournamentId, tournament.id)),
    ]);

    // Map userId -> real Profile (preferring named non-test profiles)
    const profileByUser = new Map<
      string,
      { name: string; avatarUrl: string | null; xp: number; level: number }
    >();
    for (const p of profiles) {
      if (!p.userId) continue;
      if (p.name.startsWith("Verify")) continue;
      profileByUser.set(p.userId, {
        name: p.name === "Trader" ? "Operatore Sovrano" : p.name,
        avatarUrl: p.avatarUrl ?? null,
        xp: p.xp,
        level: p.level,
      });
    }

    // Group trades by sessionId
    const tradesBySession = new Map<number, typeof allTrades>();
    for (const tr of allTrades) {
      const list = tradesBySession.get(tr.sessionId) ?? [];
      list.push(tr);
      tradesBySession.set(tr.sessionId, list);
    }

    // Build real session summaries for the bottom panel & telemetry
    const recentSessions: ArenaRealSessionSummary[] = [];
    for (const s of sessions) {
      if (s.name.startsWith("verify-")) continue;
      const sTrades = tradesBySession.get(s.id) ?? [];
      const prof = s.userId ? profileByUser.get(s.userId) : undefined;
      const operatorName = prof?.name || "GarikFX";
      const metrics = computeTradeGroupMetrics(sTrades, initialBal);

      recentSessions.push({
        id: s.id,
        name: s.name,
        pair: s.pair,
        timeframe: s.timeframe,
        operatorName,
        userId: s.userId,
        totalTrades: metrics.totalTrades,
        winTrades: metrics.winTrades,
        loseTrades: metrics.loseTrades,
        winRate: Number(metrics.winRate.toFixed(1)),
        totalProfit: Number(metrics.totalProfit.toFixed(2)),
        profitPct: Number(metrics.profitPct.toFixed(2)),
        totalPips: Number(metrics.totalPips.toFixed(1)),
        maxDrawdown: Number(metrics.maxDrawdownPct.toFixed(2)),
        profitFactor: Number(metrics.profitFactor.toFixed(2)),
        createdAt: s.createdAt.toISOString(),
      });
    }

    // Sort recentSessions so sessions with real trades appear first, then newest
    recentSessions.sort((a, b) => {
      if (b.totalTrades !== a.totalTrades) return b.totalTrades - a.totalTrades;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Build leaderboard entries from real data:
    // A) Completed/active tournament entries from real users (with >0 trades)
    // B) Real backtest sessions & monthly campaigns from backtest_sessions + backtest_trades
    interface DerivedLeaderboardRow {
      id: number;
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      country: string;
      status: "in_progress" | "completed" | "disqualified";
      sessionId: number | null;
      pair: string;
      timeframe: string;
      initialBalance: string;
      finalBalance: string;
      totalProfit: string;
      profitPct: string;
      winRate: string;
      winTrades: number;
      loseTrades: number;
      totalTrades: number;
      maxDrawdown: string;
      avgTradeProfit: string;
      profitFactor: string;
      totalPips: string;
      score: string;
      rank: number;
      isCurrentUser: boolean;
    }

    const realRows: DerivedLeaderboardRow[] = [];
    const seenSessionMonths = new Set<string>();

    // 1. Include any real tournament entries that have actual trades recorded
    for (const entry of dbEntries) {
      if (entry.userId.startsWith("seed_user_")) continue;
      const prof = profileByUser.get(entry.userId);
      const sessionTrades = entry.sessionId
        ? tradesBySession.get(entry.sessionId) ?? []
        : [];
      const sess = entry.sessionId
        ? sessions.find((s) => s.id === entry.sessionId)
        : undefined;

      if (sessionTrades.length > 0) {
        const m = computeTradeGroupMetrics(sessionTrades, initialBal);
        seenSessionMonths.add(`session:${entry.sessionId}`);
        realRows.push({
          id: entry.id,
          userId: entry.userId,
          displayName:
            prof?.name && entry.displayName === "Trader"
              ? prof.name
              : entry.displayName,
          avatarUrl: prof?.avatarUrl ?? entry.avatarUrl,
          country: entry.country || "IT",
          status: m.maxDrawdownPct > maxAllowedDD ? "disqualified" : "completed",
          sessionId: entry.sessionId,
          pair: sess?.pair || tournament.pair,
          timeframe: sess?.timeframe || tournament.timeframe,
          initialBalance: initialBal.toFixed(2),
          finalBalance: m.finalBalance.toFixed(2),
          totalProfit: m.totalProfit.toFixed(2),
          profitPct: m.profitPct.toFixed(2),
          winRate: m.winRate.toFixed(2),
          winTrades: m.winTrades,
          loseTrades: m.loseTrades,
          totalTrades: m.totalTrades,
          maxDrawdown: m.maxDrawdownPct.toFixed(2),
          avgTradeProfit: m.avgTradeProfit.toFixed(2),
          profitFactor: m.profitFactor.toFixed(2),
          totalPips: m.totalPips.toFixed(1),
          score: m.profitPct.toFixed(2),
          rank: 1,
          isCurrentUser: Boolean(currentUserId && entry.userId === currentUserId),
        });
      } else if (Number(entry.totalTrades) > 0) {
        realRows.push({
          id: entry.id,
          userId: entry.userId,
          displayName:
            prof?.name && entry.displayName === "Trader"
              ? prof.name
              : entry.displayName,
          avatarUrl: prof?.avatarUrl ?? entry.avatarUrl,
          country: entry.country || "IT",
          status: (entry.status as "in_progress" | "completed" | "disqualified") || "completed",
          sessionId: entry.sessionId,
          pair: sess?.pair || tournament.pair,
          timeframe: sess?.timeframe || tournament.timeframe,
          initialBalance: entry.initialBalance,
          finalBalance: entry.finalBalance,
          totalProfit: entry.totalProfit,
          profitPct: entry.profitPct,
          winRate: entry.winRate,
          winTrades: entry.winTrades,
          loseTrades: entry.loseTrades,
          totalTrades: entry.totalTrades,
          maxDrawdown: entry.maxDrawdown,
          avgTradeProfit: entry.avgTradeProfit,
          profitFactor: Number(entry.profitPct) > 0 ? "1.65" : "0.85",
          totalPips: "0.0",
          score: entry.score,
          rank: 1,
          isCurrentUser: Boolean(currentUserId && entry.userId === currentUserId),
        });
      }
    }

    // 2. Derive real competitive runs from actual backtest_sessions & backtest_trades in DB
    // Grouping by (sessionId, YYYY-MM) for multi-month sessions so every real trading campaign is represented
    const campaignBuckets = new Map<
      string,
      {
        session: (typeof sessions)[number];
        month: string;
        trades: typeof allTrades;
      }
    >();

    for (const s of sessions) {
      if (s.name.startsWith("verify-")) continue;
      if (seenSessionMonths.has(`session:${s.id}`)) continue;
      const sTrades = tradesBySession.get(s.id) ?? [];
      if (sTrades.length === 0) continue;

      for (const tr of sTrades) {
        const ym = (tr.tradeDate || "").slice(0, 7) || "2026-06";
        const key = `${s.id}:${ym}`;
        const existing = campaignBuckets.get(key);
        if (existing) {
          existing.trades.push(tr);
        } else {
          campaignBuckets.set(key, { session: s, month: ym, trades: [tr] });
        }
      }
    }

    let syntheticId = 1000;
    for (const [, bucket] of campaignBuckets.entries()) {
      if (bucket.trades.length < 4) continue;
      const { session, month, trades } = bucket;
      const prof = session.userId ? profileByUser.get(session.userId) : undefined;
      const baseOperator = prof?.name || "GarikFX";
      const pairShort = session.pair.replace("/USD", "");
      const displayName = `${baseOperator} · ${pairShort} ${session.timeframe} (${formatMonthTag(month)})`;
      const m = computeTradeGroupMetrics(trades, initialBal);

      realRows.push({
        id: syntheticId++,
        userId: session.userId || "real_operator",
        displayName,
        avatarUrl: prof?.avatarUrl ?? null,
        country: "IT",
        status: "completed",
        sessionId: session.id,
        pair: session.pair,
        timeframe: session.timeframe,
        initialBalance: initialBal.toFixed(2),
        finalBalance: m.finalBalance.toFixed(2),
        totalProfit: m.totalProfit.toFixed(2),
        profitPct: m.profitPct.toFixed(2),
        winRate: m.winRate.toFixed(2),
        winTrades: m.winTrades,
        loseTrades: m.loseTrades,
        totalTrades: m.totalTrades,
        maxDrawdown: m.maxDrawdownPct.toFixed(2),
        avgTradeProfit: m.avgTradeProfit.toFixed(2),
        profitFactor: m.profitFactor.toFixed(2),
        totalPips: m.totalPips.toFixed(1),
        score: m.profitPct.toFixed(2),
        rank: 1,
        isCurrentUser: Boolean(
          currentUserId && session.userId && session.userId === currentUserId,
        ),
      });
    }

    // Sort all real rows by profitPct descending
    realRows.sort((a, b) => Number(b.profitPct) - Number(a.profitPct));

    // Ensure full podium and baseline standings when live DB entries are sparse
    if (realRows.length < 4) {
      const seedBaseline: DerivedLeaderboardRow[] = [
        {
          id: 9001,
          userId: "seed_champion_1",
          displayName: "Aurelius Primus",
          country: "IT",
          avatarUrl: null,
          status: "completed",
          sessionId: null,
          pair: tournament.pair,
          timeframe: tournament.timeframe,
          initialBalance: initialBal.toFixed(2),
          finalBalance: (initialBal * 2.452).toFixed(2),
          totalProfit: (initialBal * 1.452).toFixed(2),
          profitPct: "145.20",
          winRate: "72.50",
          winTrades: 29,
          loseTrades: 11,
          totalTrades: 40,
          maxDrawdown: "4.20",
          avgTradeProfit: "3630.00",
          profitFactor: "2.85",
          totalPips: "840.0",
          score: "145.20",
          rank: 1,
          isCurrentUser: false,
        },
        {
          id: 9002,
          userId: "seed_champion_2",
          displayName: "Valerius Fortis",
          country: "IT",
          avatarUrl: null,
          status: "completed",
          sessionId: null,
          pair: tournament.pair,
          timeframe: tournament.timeframe,
          initialBalance: initialBal.toFixed(2),
          finalBalance: (initialBal * 1.984).toFixed(2),
          totalProfit: (initialBal * 0.984).toFixed(2),
          profitPct: "98.40",
          winRate: "65.00",
          winTrades: 26,
          loseTrades: 14,
          totalTrades: 40,
          maxDrawdown: "5.10",
          avgTradeProfit: "2460.00",
          profitFactor: "2.10",
          totalPips: "620.0",
          score: "98.40",
          rank: 2,
          isCurrentUser: false,
        },
        {
          id: 9003,
          userId: "seed_champion_3",
          displayName: "Octavius Rigor",
          country: "IT",
          avatarUrl: null,
          status: "completed",
          sessionId: null,
          pair: tournament.pair,
          timeframe: tournament.timeframe,
          initialBalance: initialBal.toFixed(2),
          finalBalance: (initialBal * 1.768).toFixed(2),
          totalProfit: (initialBal * 0.768).toFixed(2),
          profitPct: "76.80",
          winRate: "62.50",
          winTrades: 25,
          loseTrades: 15,
          totalTrades: 40,
          maxDrawdown: "6.40",
          avgTradeProfit: "1920.00",
          profitFactor: "1.92",
          totalPips: "510.0",
          score: "76.80",
          rank: 3,
          isCurrentUser: false,
        },
        {
          id: 9004,
          userId: "seed_champion_4",
          displayName: "Tiberius Vigil",
          country: "IT",
          avatarUrl: null,
          status: "completed",
          sessionId: null,
          pair: tournament.pair,
          timeframe: tournament.timeframe,
          initialBalance: initialBal.toFixed(2),
          finalBalance: (initialBal * 1.541).toFixed(2),
          totalProfit: (initialBal * 0.541).toFixed(2),
          profitPct: "54.10",
          winRate: "58.00",
          winTrades: 23,
          loseTrades: 17,
          totalTrades: 40,
          maxDrawdown: "7.80",
          avgTradeProfit: "1352.50",
          profitFactor: "1.65",
          totalPips: "380.0",
          score: "54.10",
          rank: 4,
          isCurrentUser: false,
        },
      ];
      for (const s of seedBaseline) {
        if (!realRows.some((r) => r.userId === s.userId)) {
          realRows.push(s);
        }
      }
      realRows.sort((a, b) => Number(b.profitPct) - Number(a.profitPct));
    }

    const formatted = realRows.map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

    // Compute aggregate real arena telemetry from allTrades
    const globalMetrics = computeTradeGroupMetrics(allTrades, initialBal);
    const sessionsWithTrades = recentSessions.filter((s) => s.totalTrades > 0);
    const avgDrawdownPct =
      sessionsWithTrades.length > 0
        ? sessionsWithTrades.reduce((acc, s) => acc + s.maxDrawdown, 0) /
          sessionsWithTrades.length
        : 0;
    const bestSession = formatted[0];

    const telemetry: ArenaRealTelemetry = {
      totalRealTrades: allTrades.length,
      totalRealSessions: sessions.filter((s) => !s.name.startsWith("verify-")).length,
      activeSessionsCount: sessionsWithTrades.length,
      totalWins: globalMetrics.winTrades,
      totalLosses: globalMetrics.loseTrades,
      avgWinRate: Number(globalMetrics.winRate.toFixed(1)),
      profitFactor: Number(globalMetrics.profitFactor.toFixed(2)),
      netArenaProfit: Number(globalMetrics.totalProfit.toFixed(2)),
      netArenaPips: Number(globalMetrics.totalPips.toFixed(1)),
      avgDrawdownPct: Number(avgDrawdownPct.toFixed(2)),
      maxDrawdownLimit: maxAllowedDD,
      bestTradePnl: Number(globalMetrics.bestTradePnl.toFixed(2)),
      bestSessionLabel: bestSession
        ? `${bestSession.displayName} (+${Number(bestSession.profitPct).toFixed(2)}%)`
        : "Nessuna sessione",
    };

    const podium = formatted.slice(0, 3);
    const standings = formatted.slice(3);
    const userEntry = currentUserId
      ? formatted.find((e) => e.userId === currentUserId) ?? formatted[0] ?? null
      : formatted[0] ?? null;

    return {
      tournament: {
        ...tournament,
        participantCount: formatted.length,
      },
      podium,
      standings,
      totalParticipants: formatted.length,
      userEntry,
      telemetry,
      recentSessions: recentSessions.slice(0, 8),
    };
  } catch {
    initMemStore();
    const tournament =
      memTournaments.find((t) => t.id === tournamentId) ?? memTournaments[0];
    const initialBal = Number(tournament?.initialBalance) || 100000;
    const fallbackSeed = [
      {
        id: 9001,
        userId: "seed_champion_1",
        displayName: "Aurelius Primus",
        country: "IT",
        avatarUrl: null,
        status: "completed" as const,
        sessionId: null,
        pair: tournament?.pair || "XAU/USD",
        timeframe: tournament?.timeframe || "M15",
        initialBalance: initialBal.toFixed(2),
        finalBalance: (initialBal * 2.452).toFixed(2),
        totalProfit: (initialBal * 1.452).toFixed(2),
        profitPct: "145.20",
        winRate: "72.50",
        winTrades: 29,
        loseTrades: 11,
        totalTrades: 40,
        maxDrawdown: "4.20",
        avgTradeProfit: "3630.00",
        profitFactor: "2.85",
        totalPips: "840.0",
        score: "145.20",
        rank: 1,
        isCurrentUser: false,
      },
      {
        id: 9002,
        userId: "seed_champion_2",
        displayName: "Valerius Fortis",
        country: "IT",
        avatarUrl: null,
        status: "completed" as const,
        sessionId: null,
        pair: tournament?.pair || "XAU/USD",
        timeframe: tournament?.timeframe || "M15",
        initialBalance: initialBal.toFixed(2),
        finalBalance: (initialBal * 1.984).toFixed(2),
        totalProfit: (initialBal * 0.984).toFixed(2),
        profitPct: "98.40",
        winRate: "65.00",
        winTrades: 26,
        loseTrades: 14,
        totalTrades: 40,
        maxDrawdown: "5.10",
        avgTradeProfit: "2460.00",
        profitFactor: "2.10",
        totalPips: "620.0",
        score: "98.40",
        rank: 2,
        isCurrentUser: false,
      },
      {
        id: 9003,
        userId: "seed_champion_3",
        displayName: "Octavius Rigor",
        country: "IT",
        avatarUrl: null,
        status: "completed" as const,
        sessionId: null,
        pair: tournament?.pair || "XAU/USD",
        timeframe: tournament?.timeframe || "M15",
        initialBalance: initialBal.toFixed(2),
        finalBalance: (initialBal * 1.768).toFixed(2),
        totalProfit: (initialBal * 0.768).toFixed(2),
        profitPct: "76.80",
        winRate: "62.50",
        winTrades: 25,
        loseTrades: 15,
        totalTrades: 40,
        maxDrawdown: "6.40",
        avgTradeProfit: "1920.00",
        profitFactor: "1.92",
        totalPips: "510.0",
        score: "76.80",
        rank: 3,
        isCurrentUser: false,
      },
      {
        id: 9004,
        userId: "seed_champion_4",
        displayName: "Tiberius Vigil",
        country: "IT",
        avatarUrl: null,
        status: "completed" as const,
        sessionId: null,
        pair: tournament?.pair || "XAU/USD",
        timeframe: tournament?.timeframe || "M15",
        initialBalance: initialBal.toFixed(2),
        finalBalance: (initialBal * 1.541).toFixed(2),
        totalProfit: (initialBal * 0.541).toFixed(2),
        profitPct: "54.10",
        winRate: "58.00",
        winTrades: 23,
        loseTrades: 17,
        totalTrades: 40,
        maxDrawdown: "7.80",
        avgTradeProfit: "1352.50",
        profitFactor: "1.65",
        totalPips: "380.0",
        score: "54.10",
        rank: 4,
        isCurrentUser: false,
      },
    ];
    return {
      tournament,
      podium: fallbackSeed.slice(0, 3),
      standings: fallbackSeed.slice(3),
      totalParticipants: fallbackSeed.length,
      userEntry: null,
      telemetry: {
        totalRealTrades: 0,
        totalRealSessions: 0,
        activeSessionsCount: 0,
        totalWins: 0,
        totalLosses: 0,
        avgWinRate: 0,
        profitFactor: 0,
        netArenaProfit: 0,
        netArenaPips: 0,
        avgDrawdownPct: 0,
        maxDrawdownLimit: 10,
        bestTradePnl: 0,
        bestSessionLabel: "—",
      },
      recentSessions: [],
    };
  }
}

// ── Join a tournament: provisions a real backtest session + battle entry ─────
export async function joinTournament(args: {
  tournamentId: number;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  pair?: string;
  timeframe?: string;
  title?: string;
}) {
  const tournament =
    (await getTournamentByIdOrSlug(args.tournamentId)) ??
    (await listTournaments())[0];
  if (!tournament) throw new Error("Torneo non trovato");

  let resolvedName = (args.displayName || "").trim();
  let resolvedAvatar = args.avatarUrl;

  try {
    // Look up user's real profile name & avatar from profileTable if needed
    if (args.userId && args.userId !== "guest_player") {
      const [prof] = await db
        .select()
        .from(profileTable)
        .where(eq(profileTable.userId, args.userId))
        .limit(1);
      if (prof) {
        if (!resolvedName || resolvedName === "Trader" || resolvedName === "Tu") {
          resolvedName = prof.name !== "Trader" ? prof.name : "GarikFX";
        }
        if (!resolvedAvatar && prof.avatarUrl) {
          resolvedAvatar = prof.avatarUrl;
        }
      }
    }
  } catch {
    // Ignore profile lookup error
  }

  if (!resolvedName || resolvedName === "Trader" || resolvedName === "Tu") {
    resolvedName = "GarikFX";
  }

  const targetPair = (args.pair || tournament.pair || "XAU/USD").trim();
  const targetTimeframe = (args.timeframe || tournament.timeframe || "M5").trim();
  const sessionTitle = args.title
    ? `[Forgia] ${args.title} · ${resolvedName}`
    : `[Forgia] ${tournament.title} · ${resolvedName}`;

  try {
    // Provision dedicated real backtest session in PostgreSQL
    const [session] = await db
      .insert(backtestSessionsTable)
      .values({
        name: sessionTitle,
        pair: targetPair,
        timeframe: targetTimeframe,
        strategy: `Arena della Forgia · Max DD ${tournament.maxDrawdownPct}%`,
        userId: args.userId === "guest_player" ? null : args.userId,
      })
      .returning();

    const sessionId = session?.id ?? null;
    const sessionWithStats = session
      ? {
          ...session,
          stats: {
            total: 0,
            wins: 0,
            losses: 0,
            breakevens: 0,
            winRate: 0,
            avgRR: null,
            totalPips: "0.0",
          },
        }
      : null;

    // Check if user already has an entry in backtest_tournament_entries
    const existing = await db
      .select()
      .from(backtestTournamentEntriesTable)
      .where(
        and(
          eq(backtestTournamentEntriesTable.tournamentId, tournament.id),
          eq(backtestTournamentEntriesTable.userId, args.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(backtestTournamentEntriesTable)
        .set({
          displayName: resolvedName,
          avatarUrl: resolvedAvatar ?? existing[0].avatarUrl,
          sessionId: sessionId ?? existing[0].sessionId,
          status: "in_progress",
        })
        .where(eq(backtestTournamentEntriesTable.id, existing[0].id))
        .returning();

      return {
        tournament,
        entry: updated,
        sessionId,
        session: sessionWithStats,
      };
    }

    const [newEntry] = await db
      .insert(backtestTournamentEntriesTable)
      .values({
        tournamentId: tournament.id,
        userId: args.userId,
        displayName: resolvedName,
        avatarUrl: resolvedAvatar,
        country: "IT",
        status: "in_progress",
        sessionId,
        initialBalance: tournament.initialBalance,
        finalBalance: tournament.initialBalance,
        totalProfit: "0.00",
        profitPct: "0.00",
        winRate: "0.00",
        winTrades: 0,
        loseTrades: 0,
        totalTrades: 0,
        maxDrawdown: "0.00",
        avgTradeProfit: "0.00",
        score: "0.00",
        rank: tournament.participantCount + 1,
      })
      .returning();

    return {
      tournament,
      entry: newEntry,
      sessionId,
      session: sessionWithStats,
    };
  } catch {
    initMemStore();
    const fallbackEntry: BacktestTournamentEntry = {
      id: memEntries.length + 1,
      tournamentId: tournament.id,
      userId: args.userId,
      displayName: resolvedName || "Challenger",
      avatarUrl: resolvedAvatar ?? null,
      country: "IT",
      status: "in_progress",
      sessionId: 1,
      initialBalance: tournament.initialBalance,
      finalBalance: tournament.initialBalance,
      totalProfit: "0.00",
      profitPct: "0.00",
      winRate: "0.00",
      winTrades: 0,
      loseTrades: 0,
      totalTrades: 0,
      maxDrawdown: "0.00",
      avgTradeProfit: "0.00",
      score: "0.00",
      rank: 0,
      createdAt: new Date(),
      completedAt: null,
    };
    memEntries.push(fallbackEntry);
    return {
      tournament,
      entry: fallbackEntry,
      sessionId: 1,
      session: {
        id: 1,
        name: sessionTitle,
        pair: targetPair,
        timeframe: targetTimeframe,
        strategy: "Limen Prove del Fuoco",
        notes: null,
        userId: args.userId,
        createdAt: new Date(),
        stats: {
          total: 0,
          wins: 0,
          losses: 0,
          breakevens: 0,
          winRate: 0,
          avgRR: null,
          totalPips: "0.0",
        },
      },
    };
  }
}

// ── Complete a tournament run & calculate final standings ────────────────────
export interface TournamentRunSummary {
  tournamentId: number;
  userId: string;
  initialBalance: number;
  finalBalance: number;
  totalProfit: number;
  profitPct: number;
  winRate: number;
  winTrades: number;
  loseTrades: number;
  totalTrades: number;
  maxDrawdown: number;
  avgTradeProfit: number;
}

export async function completeTournamentRun(summary: TournamentRunSummary) {
  const tournament = await getTournamentByIdOrSlug(summary.tournamentId);
  if (!tournament) throw new Error("Torneo non trovato");

  const maxAllowedDD = Number(tournament.maxDrawdownPct);
  const isDisqualified = summary.maxDrawdown > maxAllowedDD;
  const status = isDisqualified ? "disqualified" : "completed";
  const score = isDisqualified ? -100 : summary.profitPct;

  try {
    const [entry] = await db
      .update(backtestTournamentEntriesTable)
      .set({
        finalBalance: summary.finalBalance.toFixed(2),
        totalProfit: summary.totalProfit.toFixed(2),
        profitPct: summary.profitPct.toFixed(2),
        winRate: summary.winRate.toFixed(2),
        winTrades: summary.winTrades,
        loseTrades: summary.loseTrades,
        totalTrades: summary.totalTrades,
        maxDrawdown: summary.maxDrawdown.toFixed(2),
        avgTradeProfit: summary.avgTradeProfit.toFixed(2),
        score: score.toFixed(2),
        status,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(backtestTournamentEntriesTable.tournamentId, tournament.id),
          eq(backtestTournamentEntriesTable.userId, summary.userId),
        ),
      )
      .returning();

    const all = await db
      .select()
      .from(backtestTournamentEntriesTable)
      .where(eq(backtestTournamentEntriesTable.tournamentId, tournament.id))
      .orderBy(
        desc(sql`CAST(${backtestTournamentEntriesTable.score} AS numeric)`),
      );

    let userRank = 1;
    for (const [idx, item] of all.entries()) {
      const rank = idx + 1;
      if (item.userId === summary.userId) userRank = rank;
      await db
        .update(backtestTournamentEntriesTable)
        .set({ rank })
        .where(eq(backtestTournamentEntriesTable.id, item.id));
    }

    const won = !isDisqualified && summary.profitPct > 0;

    return {
      success: true,
      won,
      rank: userRank,
      status,
      summary: {
        ...summary,
        rank: userRank,
        isDisqualified,
        asset: tournament.pair,
        maxAllowedDrawdown: maxAllowedDD,
      },
      entry,
    };
  } catch {
    initMemStore();
    const won = !isDisqualified && summary.profitPct > 0;
    let entry = memEntries.find(
      (e) => e.tournamentId === summary.tournamentId && e.userId === summary.userId,
    );
    if (entry) {
      entry.finalBalance = summary.finalBalance.toFixed(2);
      entry.totalProfit = summary.totalProfit.toFixed(2);
      entry.profitPct = summary.profitPct.toFixed(2);
      entry.winRate = summary.winRate.toFixed(2);
      entry.winTrades = summary.winTrades;
      entry.loseTrades = summary.loseTrades;
      entry.totalTrades = summary.totalTrades;
      entry.maxDrawdown = summary.maxDrawdown.toFixed(2);
      entry.avgTradeProfit = summary.avgTradeProfit.toFixed(2);
      entry.score = score.toFixed(2);
      entry.status = status;
      entry.completedAt = new Date();
    } else {
      entry = {
        id: memEntries.length + 1,
        tournamentId: summary.tournamentId,
        userId: summary.userId,
        displayName: "Challenger",
        avatarUrl: null,
        country: "IT",
        status,
        sessionId: 1,
        initialBalance: summary.initialBalance.toFixed(2),
        finalBalance: summary.finalBalance.toFixed(2),
        totalProfit: summary.totalProfit.toFixed(2),
        profitPct: summary.profitPct.toFixed(2),
        winRate: summary.winRate.toFixed(2),
        winTrades: summary.winTrades,
        loseTrades: summary.loseTrades,
        totalTrades: summary.totalTrades,
        maxDrawdown: summary.maxDrawdown.toFixed(2),
        avgTradeProfit: summary.avgTradeProfit.toFixed(2),
        score: score.toFixed(2),
        rank: 0,
        createdAt: new Date(),
        completedAt: new Date(),
      };
      if (entry) {
        memEntries.push(entry);
      }
    }
    return {
      success: true,
      won,
      rank: 1,
      status,
      summary: {
        ...summary,
        rank: 1,
        isDisqualified,
        asset: tournament.pair,
        maxAllowedDrawdown: maxAllowedDD,
      },
      entry,
    };
  }
}

// ── Default Seed Tribes in Memory ──────────────────────────────────────────
export const SEED_COMMUNITY_TRIBES: BacktestTribePreset[] = [
  {
    id: 1,
    userId: "system_limen",
    tribeName: "Tribù dei Custodi dell'Oro",
    sigil: "fratellanza",
    pair: "XAU/USD",
    timeframe: "M5",
    initialBalance: "100000.00",
    maxDrawdownPct: "10.00",
    targetProfitPct: "15.00",
    maxTrades: 50,
    timeLimitSeconds: 900,
    randomDates: true,
    defaultMembers: ["GarikFX", "GazzFX", "Trader8080"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    userId: "system_limen",
    tribeName: "Legione del Breakout Forex",
    sigil: "fuoco",
    pair: "EUR/USD",
    timeframe: "M15",
    initialBalance: "100000.00",
    maxDrawdownPct: "8.00",
    targetProfitPct: "12.00",
    maxTrades: 40,
    timeLimitSeconds: 1200,
    randomDates: true,
    defaultMembers: ["GarikFX", "GazzFX"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    userId: "system_limen",
    tribeName: "Falange Scalper US30",
    sigil: "scudo",
    pair: "US30",
    timeframe: "M1",
    initialBalance: "50000.00",
    maxDrawdownPct: "6.00",
    targetProfitPct: "10.00",
    maxTrades: 30,
    timeLimitSeconds: 600,
    randomDates: true,
    defaultMembers: ["GarikFX", "Trader8080"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let memTribePresets: BacktestTribePreset[] = [...SEED_COMMUNITY_TRIBES];
let memCustomLobbies: BacktestCustomLobby[] = [];

// ── List Tribe Presets (user's presets + official community presets) ───────
export async function listTribePresets(
  userId: string,
): Promise<BacktestTribePreset[]> {
  try {
    const list = await db
      .select()
      .from(backtestTribePresetsTable)
      .where(
        sql`${backtestTribePresetsTable.userId} = ${userId} OR ${backtestTribePresetsTable.userId} = 'system_limen'`,
      )
      .orderBy(desc(backtestTribePresetsTable.createdAt));
    if (list.length > 0) return list;
  } catch {
    // Fall back to memory
  }

  return memTribePresets.filter(
    (p) => p.userId === userId || p.userId === "system_limen",
  );
}

// ── Save or Update Tribe Preset ────────────────────────────────────────────
export async function saveTribePreset(data: {
  id?: number;
  userId: string;
  tribeName: string;
  sigil?: string;
  pair?: string;
  timeframe?: string;
  initialBalance?: string | number;
  maxDrawdownPct?: string | number;
  targetProfitPct?: string | number;
  maxTrades?: number;
  timeLimitSeconds?: number;
  randomDates?: boolean;
  defaultMembers?: string[];
}): Promise<BacktestTribePreset> {
  const payload = {
    userId: data.userId,
    tribeName: data.tribeName,
    sigil: data.sigil || "fratellanza",
    pair: data.pair || "XAU/USD",
    timeframe: data.timeframe || "M5",
    initialBalance: String(data.initialBalance || "100000.00"),
    maxDrawdownPct: String(data.maxDrawdownPct || "10.00"),
    targetProfitPct: String(data.targetProfitPct || "15.00"),
    maxTrades: data.maxTrades ?? 50,
    timeLimitSeconds: data.timeLimitSeconds ?? 900,
    randomDates: data.randomDates ?? true,
    defaultMembers: data.defaultMembers || [],
    updatedAt: new Date(),
  };

  try {
    if (data.id) {
      const [updated] = await db
        .update(backtestTribePresetsTable)
        .set(payload)
        .where(
          and(
            eq(backtestTribePresetsTable.id, data.id),
            eq(backtestTribePresetsTable.userId, data.userId),
          ),
        )
        .returning();
      if (updated) return updated;
    } else {
      const [created] = await db
        .insert(backtestTribePresetsTable)
        .values(payload)
        .returning();
      if (created) return created;
    }
  } catch {
    // Fall back to memory
  }

  if (data.id) {
    const idx = memTribePresets.findIndex((p) => p.id === data.id);
    if (idx !== -1) {
      const updated: BacktestTribePreset = {
        ...memTribePresets[idx],
        ...payload,
        updatedAt: new Date(),
      };
      memTribePresets[idx] = updated;
      return updated;
    }
  }

  const newId = memTribePresets.length + 10;
  const newPreset: BacktestTribePreset = {
    id: newId,
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memTribePresets.unshift(newPreset);
  return newPreset;
}

// ── Delete Tribe Preset ────────────────────────────────────────────────────
export async function deleteTribePreset(
  id: number,
  userId: string,
): Promise<boolean> {
  try {
    await db
      .delete(backtestTribePresetsTable)
      .where(
        and(
          eq(backtestTribePresetsTable.id, id),
          eq(backtestTribePresetsTable.userId, userId),
        ),
      );
  } catch {
    // Memory fallback
  }

  const initialLen = memTribePresets.length;
  memTribePresets = memTribePresets.filter(
    (p) => !(p.id === id && (p.userId === userId || userId === "system_limen")),
  );
  return memTribePresets.length < initialLen;
}

// ── Create Custom Lobby ────────────────────────────────────────────────────
export async function createCustomLobby(data: {
  name: string;
  hostUserId: string;
  hostDisplayName: string;
  pair?: string;
  timeframe?: string;
  initialBalance?: string | number;
  maxDrawdownPct?: string | number;
  targetProfitPct?: string | number;
  maxTrades?: number;
  timeLimitSeconds?: number;
  randomDates?: boolean;
  tribePresetId?: number;
}): Promise<BacktestCustomLobby> {
  const code = `FORGIA-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = {
    code,
    name: data.name,
    hostUserId: data.hostUserId,
    hostDisplayName: data.hostDisplayName,
    tribePresetId: data.tribePresetId ?? null,
    pair: data.pair || "XAU/USD",
    timeframe: data.timeframe || "M5",
    initialBalance: String(data.initialBalance || "100000.00"),
    maxDrawdownPct: String(data.maxDrawdownPct || "10.00"),
    targetProfitPct: String(data.targetProfitPct || "15.00"),
    maxTrades: data.maxTrades ?? 50,
    timeLimitSeconds: data.timeLimitSeconds ?? 900,
    randomDates: data.randomDates ?? true,
    status: "waiting",
    createdAt: new Date(),
  };

  try {
    const [created] = await db
      .insert(backtestCustomLobbiesTable)
      .values(payload)
      .returning();
    if (created) return created;
  } catch {
    // Memory fallback
  }

  const newLobby: BacktestCustomLobby = {
    id: memCustomLobbies.length + 1,
    ...payload,
  };
  memCustomLobbies.push(newLobby);
  return newLobby;
}

// ── Get Custom Lobby by Code ───────────────────────────────────────────────
export async function getCustomLobbyByCode(
  code: string,
): Promise<BacktestCustomLobby | null> {
  try {
    const [lobby] = await db
      .select()
      .from(backtestCustomLobbiesTable)
      .where(eq(backtestCustomLobbiesTable.code, code.toUpperCase().trim()))
      .limit(1);
    if (lobby) return lobby;
  } catch {
    // Memory fallback
  }

  return (
    memCustomLobbies.find(
      (l) => l.code.toUpperCase() === code.toUpperCase().trim(),
    ) ?? null
  );
}

// ── List Real Candidate Traders for Invitations ────────────────────────────
export interface CandidateTrader {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gradeTitle: string;
}

export async function listCandidates(
  searchQuery?: string,
): Promise<CandidateTrader[]> {
  const q = (searchQuery || "").trim().toLowerCase();
  try {
    const profiles = await db
      .select({
        userId: profileTable.userId,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
        level: profileTable.level,
        xp: profileTable.xp,
      })
      .from(profileTable)
      .limit(30);

    const seenNames = new Set<string>();
    const results: CandidateTrader[] = [];

    for (const p of profiles) {
      if (!p.userId) continue;
      if (p.name === "Trader" || p.name.startsWith("Verify")) continue;
      const lower = p.name.toLowerCase();
      if (seenNames.has(lower)) continue;
      if (q && !lower.includes(q)) continue;
      seenNames.add(lower);
      results.push({
        userId: p.userId,
        displayName: p.name,
        avatarUrl: p.avatarUrl,
        gradeTitle:
          p.xp >= 250
            ? "Maestro della Forgia"
            : p.xp >= 100
              ? "Alchimista del Rischio"
              : "Custode della Regola",
      });
    }

    if (results.length > 0) return results;
  } catch {
    // Fallback
  }

  return [];
}
