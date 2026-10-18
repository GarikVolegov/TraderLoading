import { index, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const backtestSessionsTable = pgTable("backtest_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pair: text("pair").notNull(),
  timeframe: text("timeframe").notNull().default("H1"),
  strategy: text("strategy"),
  notes: text("notes"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // List a user's sessions newest-first (routes/backtest.ts).
  index("backtest_sessions_user_created_idx").on(table.userId, table.createdAt),
]);

export const backtestTradesTable = pgTable("backtest_trades", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => backtestSessionsTable.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  entryPrice: numeric("entry_price", { precision: 12, scale: 5 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 12, scale: 5 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 12, scale: 5 }),
  takeProfit: numeric("take_profit", { precision: 12, scale: 5 }),
  lotSize: numeric("lot_size", { precision: 8, scale: 2 }).notNull().default("0.01"),
  result: text("result").notNull(),
  pips: numeric("pips", { precision: 10, scale: 1 }),
  // Immutable entry risk and execution economics. Nulls preserve incomplete
  // legacy history: the final/trailing stop is not evidence of initial risk.
  initialRisk: numeric("initial_risk", { precision: 18, scale: 6 }),
  cost: numeric("cost", { precision: 18, scale: 6 }),
  netPnl: numeric("net_pnl", { precision: 18, scale: 6 }),
  netR: numeric("net_r", { precision: 18, scale: 8 }),
  economicsProvenance: text("economics_provenance").notNull().default("legacy_unknown"),
  currency: text("currency"),
  openTime: timestamp("open_time", { withTimezone: true }),
  closeTime: timestamp("close_time", { withTimezone: true }),
  notes: text("notes"),
  tradeDate: text("trade_date").notNull(),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Fetch trades for a session newest-first and speed the cascade delete on the
  // session FK (Postgres does not auto-index foreign keys).
  index("backtest_trades_session_created_idx").on(table.sessionId, table.createdAt),
]);

export type BacktestSession = typeof backtestSessionsTable.$inferSelect;
export type BacktestTrade = typeof backtestTradesTable.$inferSelect;
