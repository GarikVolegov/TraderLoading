import { Router, type IRouter } from "express";
import { db, backtestSessionsTable, backtestTradesTable } from "@workspace/db";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { getUserId } from "./profile.js";
import { requireProFeature } from "../lib/billing.js";

const router: IRouter = Router();

export type BacktestSessionStats = {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRR: string | null;
  totalPips: string;
};

type BacktestStatsTrade = {
  sessionId: number;
  direction: string;
  entryPrice?: string | number | null;
  exitPrice?: string | number | null;
  stopLoss?: string | number | null;
  result: string;
  pips?: string | number | null;
};

function userWhere(userId: string | null) {
  return userId ? eq(backtestSessionsTable.userId, userId) : isNull(backtestSessionsTable.userId);
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  return parseFloat(value ?? "0");
}

function calculateSessionStats(trades: BacktestStatsTrade[]): BacktestSessionStats {
  const wins = trades.filter((trade) => trade.result === "win").length;
  const losses = trades.filter((trade) => trade.result === "loss").length;
  const breakevens = trades.filter((trade) => trade.result === "breakeven").length;
  const total = trades.length;
  let totalRR = 0;
  let rrCount = 0;

  for (const trade of trades) {
    if (trade.stopLoss && trade.entryPrice) {
      const entry = toNumber(trade.entryPrice);
      const stopLoss = toNumber(trade.stopLoss);
      const exit = toNumber(trade.exitPrice);
      const risk = Math.abs(entry - stopLoss);

      if (risk > 0) {
        const reward = trade.direction === "buy" ? exit - entry : entry - exit;
        totalRR += reward / risk;
        rrCount += 1;
      }
    }
  }

  const totalPips = trades.reduce((sum, trade) => sum + toNumber(trade.pips), 0);

  return {
    total,
    wins,
    losses,
    breakevens,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    avgRR: rrCount > 0 ? (totalRR / rrCount).toFixed(2) : null,
    totalPips: totalPips.toFixed(1),
  };
}

export function attachBacktestSessionStats<Session extends { id: number }>(
  sessions: Session[],
  trades: BacktestStatsTrade[],
): Array<Session & { stats: BacktestSessionStats }> {
  const tradesBySession = new Map<number, BacktestStatsTrade[]>();
  for (const trade of trades) {
    const sessionTrades = tradesBySession.get(trade.sessionId) ?? [];
    sessionTrades.push(trade);
    tradesBySession.set(trade.sessionId, sessionTrades);
  }

  return sessions.map((session) => ({
    ...session,
    stats: calculateSessionStats(tradesBySession.get(session.id) ?? []),
  }));
}

router.get("/backtest/sessions", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const sessions = await db.select().from(backtestSessionsTable)
    .where(userWhere(userId))
    .orderBy(desc(backtestSessionsTable.createdAt));
  const sessionIds = sessions.map((session) => session.id);
  const trades = sessionIds.length > 0
    ? await db.select().from(backtestTradesTable)
      .where(inArray(backtestTradesTable.sessionId, sessionIds))
    : [];
  res.json(attachBacktestSessionStats(sessions, trades));
});

router.post("/backtest/sessions", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const { name, pair, timeframe, strategy, notes } = req.body;
  if (!name || !pair) {
    res.status(400).json({ error: "name and pair are required" });
    return;
  }
  const [session] = await db.insert(backtestSessionsTable).values({
    name, pair, timeframe: timeframe || "H1", strategy: strategy || null, notes: notes || null, userId,
  }).returning();
  res.json(attachBacktestSessionStats([session], [])[0]);
});

router.delete("/backtest/sessions/:id", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  await db.delete(backtestSessionsTable).where(
    and(eq(backtestSessionsTable.id, id), userWhere(userId))
  );
  res.json({ ok: true });
});

router.get("/backtest/sessions/:id/trades", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const sessionId = parseInt(req.params.id);
  const trades = await db.select().from(backtestTradesTable)
    .where(eq(backtestTradesTable.sessionId, sessionId))
    .orderBy(desc(backtestTradesTable.createdAt));
  res.json(trades);
});

router.post("/backtest/sessions/:id/trades", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const sessionId = parseInt(req.params.id);
  const { direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pips, notes, tradeDate } = req.body;
  if (!direction || !entryPrice || !exitPrice || !result || !tradeDate) {
    res.status(400).json({ error: "direction, entryPrice, exitPrice, result, and tradeDate are required" });
    return;
  }
  const [trade] = await db.insert(backtestTradesTable).values({
    sessionId, direction, entryPrice, exitPrice,
    stopLoss: stopLoss || null, takeProfit: takeProfit || null,
    lotSize: lotSize || "0.01", result, pips: pips || null,
    notes: notes || null, tradeDate, userId,
  }).returning();
  res.json(trade);
});

router.delete("/backtest/trades/:id", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const id = parseInt(req.params.id);
  await db.delete(backtestTradesTable).where(eq(backtestTradesTable.id, id));
  res.json({ ok: true });
});

export default router;
