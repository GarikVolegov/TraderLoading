import { Router, type IRouter } from "express";
import { db, backtestSessionsTable, backtestTradesTable } from "@workspace/db";
import { eq, and, isNull, desc, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getUserId } from "./profile.js";
import { requireProFeature } from "../lib/billing.js";
import { calculateNetR } from "../../../../contracts/trader-process.js";

const router: IRouter = Router();
const numericInput = z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().finite());
const price = numericInput.pipe(z.number().positive().lt(1e7)).transform(String);
const optionalPrice = price.nullable().optional();
const sessionInput = z.object({
  name: z.string().trim().min(1).max(200), pair: z.string().trim().min(1).max(32),
  timeframe: z.string().trim().min(1).max(16).optional(),
  strategy: z.string().max(4000).nullable().optional(), notes: z.string().max(20000).nullable().optional(),
});
const tradeInput = z.object({
  clientRequestId: z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/).optional(),
  direction: z.enum(["buy", "sell"]), entryPrice: price, exitPrice: price,
  stopLoss: optionalPrice, takeProfit: optionalPrice,
  lotSize: numericInput.pipe(z.number().min(0.01).lt(1e6)).transform(String).optional(),
  result: z.enum(["win", "loss", "breakeven"]),
  pips: numericInput.pipe(z.number().gt(-1e9).lt(1e9)).transform(String).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  initialRisk: numericInput.pipe(z.number().positive().lt(1e12)).nullable().optional(),
  cost: numericInput.pipe(z.number().min(0).lt(1e12)).nullable().optional(),
  netPnl: numericInput.pipe(z.number().gt(-1e12).lt(1e12)).nullable().optional(),
  economicsProvenance: z.enum(["calculated", "declared", "estimated", "legacy_unknown"]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  openTime: z.string().datetime({ offset: true }).nullable().optional(),
  closeTime: z.string().datetime({ offset: true }).nullable().optional(),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }),
});
const resourceId = z.coerce.number().int().positive();

/** Never reconstruct entry risk from a mutable final stop or a legacy R value. */
export function backtestEconomics(input: {
  initialRisk?: number | null; cost?: number | null; netPnl?: number | null;
  economicsProvenance?: "calculated" | "declared" | "estimated" | "legacy_unknown";
  currency?: string | null; openTime?: string | null; closeTime?: string | null;
}) {
  const provenance = input.economicsProvenance ?? "legacy_unknown";
  const complete = input.cost != null && provenance !== "legacy_unknown" && Boolean(input.currency);
  return {
    initialRisk: input.initialRisk == null ? null : String(input.initialRisk),
    cost: input.cost == null ? null : String(input.cost),
    netPnl: input.netPnl == null ? null : String(input.netPnl),
    netR: complete ? (() => {
      const value = calculateNetR(input.netPnl, input.initialRisk);
      return value == null ? null : value.toFixed(8);
    })() : null,
    economicsProvenance: provenance, currency: input.currency ?? null,
    openTime: input.openTime ? new Date(input.openTime) : null,
    closeTime: input.closeTime ? new Date(input.closeTime) : null,
  };
}

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

function tradeUserWhere(userId: string | null) {
  return userId ? eq(backtestTradesTable.userId, userId) : isNull(backtestTradesTable.userId);
}

// Ownership gate: a user may only read/write trades of sessions they own.
// Without this, any Pro user could read/inject/delete another user's trades by
// iterating session/trade ids (IDOR).
async function userOwnsSession(userId: string | null, sessionId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: backtestSessionsTable.id })
    .from(backtestSessionsTable)
    .where(and(eq(backtestSessionsTable.id, sessionId), userWhere(userId)))
    .limit(1);
  return Boolean(row);
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
  const { name, pair, timeframe, strategy, notes } = sessionInput.parse(req.body);
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
  const id = resourceId.parse(req.params.id);
  await db.transaction(async tx => {
    const deleted = await tx.delete(backtestSessionsTable).where(
      and(eq(backtestSessionsTable.id, id), userWhere(userId))
    ).returning({ id: backtestSessionsTable.id });
    if (deleted.length) await tx.execute(sql`DELETE FROM broker_profile_store
      WHERE store_key LIKE 'backtest-trade:%' AND data->>'sessionId' = ${String(id)}
        AND data->>'userId' = ${userId}`);
  });
  res.json({ ok: true });
});

router.get("/backtest/sessions/:id/trades", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const sessionId = resourceId.parse(req.params.id);
  if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }
  if (!(await userOwnsSession(userId, sessionId))) { res.status(404).json({ error: "Session not found" }); return; }
  const trades = await db.select().from(backtestTradesTable)
    .where(eq(backtestTradesTable.sessionId, sessionId))
    .orderBy(desc(backtestTradesTable.createdAt));
  res.json(trades);
});

router.post("/backtest/sessions/:id/trades", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const sessionId = resourceId.parse(req.params.id);
  if (Number.isNaN(sessionId)) { res.status(400).json({ error: "Invalid session id" }); return; }
  const parsed = tradeInput.parse(req.body);
  const { clientRequestId, direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pips, notes, tradeDate } = parsed;
  if (parsed.openTime && parsed.closeTime && new Date(parsed.closeTime) < new Date(parsed.openTime)) {
    res.status(400).json({ error: "closeTime must be on or after openTime" }); return;
  }
  if (!direction || !entryPrice || !exitPrice || !result || !tradeDate) {
    res.status(400).json({ error: "direction, entryPrice, exitPrice, result, and tradeDate are required" });
    return;
  }
  const values = {
    sessionId, direction, entryPrice, exitPrice,
    stopLoss: stopLoss || null, takeProfit: takeProfit || null,
    lotSize: lotSize || "0.01", result, pips: pips || null,
    notes: notes || null, tradeDate, userId, ...backtestEconomics(parsed),
  };
  // Receipt and trade commit together in the existing generic JSON store.
  // Keys are scoped by owner/session; manual callers without an ID keep their
  // existing behavior. A lost reply or concurrent retry must not add a trade.
  const receiptKey = clientRequestId ? "backtest-trade:" + createHash("sha256")
    .update(JSON.stringify([userId, sessionId, clientRequestId])).digest("hex") : null;
  const fingerprint = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  const saved = await db.transaction(async tx => {
    const [owner] = await tx.select({ id: backtestSessionsTable.id }).from(backtestSessionsTable)
      .where(and(eq(backtestSessionsTable.id, sessionId), userWhere(userId))).for("key share");
    if (!owner) return { status: "missing" } as const;
    if (receiptKey) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${receiptKey}, 0))`);
      const existing = await tx.execute(sql`SELECT data FROM broker_profile_store WHERE store_key = ${receiptKey}`);
      if (existing.rows[0]) {
        const receipt = existing.rows[0].data as { fingerprint: string; tradeId: number };
        if (receipt.fingerprint !== fingerprint) return { status: "conflict" } as const;
        const [trade] = await tx.select().from(backtestTradesTable).where(and(
          eq(backtestTradesTable.id, receipt.tradeId), eq(backtestTradesTable.sessionId, sessionId), tradeUserWhere(userId)));
        return trade ? { status: "saved", trade } as const : { status: "conflict" } as const;
      }
    }
    const [trade] = await tx.insert(backtestTradesTable).values(values).returning();
    if (receiptKey) await tx.execute(sql`INSERT INTO broker_profile_store(store_key, data, updated_at)
      VALUES (${receiptKey}, ${JSON.stringify({ userId, sessionId, clientRequestId, fingerprint, tradeId: trade.id })}::jsonb, now())`);
    return { status: "saved", trade } as const;
  });
  if (saved.status === "missing") { res.status(404).json({ error: "Session not found" }); return; }
  if (saved.status === "conflict") { res.status(409).json({ error: "Replay save conflicts with an earlier or deleted trade" }); return; }
  res.json(saved.trade);
});

router.delete("/backtest/trades/:id", async (req, res) => {
  if (!(await requireProFeature(req, res, "backtest"))) return;
  const userId = getUserId(req);
  const id = resourceId.parse(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid trade id" }); return; }
  // Scope the delete to the caller's own trades so a user can't delete others'.
  const deleted = await db
    .delete(backtestTradesTable)
    .where(and(eq(backtestTradesTable.id, id), tradeUserWhere(userId)))
    .returning({ id: backtestTradesTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Trade not found" }); return; }
  res.json({ ok: true });
});

export default router;
