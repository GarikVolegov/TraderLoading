import { Router, type IRouter } from "express";
import { db, backtestSessionsTable, backtestTradesTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

function userWhere(userId: string | null) {
  return userId ? eq(backtestSessionsTable.userId, userId) : isNull(backtestSessionsTable.userId);
}

router.get("/backtest/sessions", async (req, res) => {
  const userId = getUserId(req);
  const sessions = await db.select().from(backtestSessionsTable)
    .where(userWhere(userId))
    .orderBy(desc(backtestSessionsTable.createdAt));
  res.json(sessions);
});

router.post("/backtest/sessions", async (req, res) => {
  const userId = getUserId(req);
  const { name, pair, timeframe, strategy, notes } = req.body;
  if (!name || !pair) {
    res.status(400).json({ error: "name and pair are required" });
    return;
  }
  const [session] = await db.insert(backtestSessionsTable).values({
    name, pair, timeframe: timeframe || "H1", strategy: strategy || null, notes: notes || null, userId,
  }).returning();
  res.json(session);
});

router.delete("/backtest/sessions/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  await db.delete(backtestSessionsTable).where(
    and(eq(backtestSessionsTable.id, id), userWhere(userId))
  );
  res.json({ ok: true });
});

router.get("/backtest/sessions/:id/trades", async (req, res) => {
  const sessionId = parseInt(req.params.id);
  const trades = await db.select().from(backtestTradesTable)
    .where(eq(backtestTradesTable.sessionId, sessionId))
    .orderBy(desc(backtestTradesTable.createdAt));
  res.json(trades);
});

router.post("/backtest/sessions/:id/trades", async (req, res) => {
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
  const id = parseInt(req.params.id);
  await db.delete(backtestTradesTable).where(eq(backtestTradesTable.id, id));
  res.json({ ok: true });
});

export default router;
