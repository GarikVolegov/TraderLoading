import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { backtestSessionsTable } from "./backtest";

// ── Prove del Fuoco / Tornei di Backtest (Limen Protocol) ─────────────────────
export const backtestTournamentsTable = pgTable(
  "backtest_tournaments",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    pair: text("pair").notNull().default("XAU/USD"),
    timeframe: text("timeframe").notNull().default("M5"),
    initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
    targetProfitPct: numeric("target_profit_pct", { precision: 5, scale: 2 }).notNull().default("15.00"),
    maxTrades: integer("max_trades").notNull().default(50),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(900), // 15 min default
    startCandleTs: integer("start_candle_ts"),
    status: text("status").notNull().default("in_progress"), // "in_progress" | "live" | "upcoming" | "ended"
    participantCount: integer("participant_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("backtest_tournaments_slug_unique").on(t.slug),
    index("backtest_tournaments_status_idx").on(t.status),
  ],
);

// ── Iscrizioni e Risultati dei Partecipanti alla Battaglia ───────────────────
export const backtestTournamentEntriesTable = pgTable(
  "backtest_tournament_entries",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => backtestTournamentsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    country: text("country").notNull().default("IT"),
    status: text("status").notNull().default("in_progress"), // "in_progress" | "completed" | "disqualified"
    sessionId: integer("session_id").references(() => backtestSessionsTable.id, { onDelete: "set null" }),
    initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
    finalBalance: numeric("final_balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
    totalProfit: numeric("total_profit", { precision: 14, scale: 2 }).notNull().default("0.00"),
    profitPct: numeric("profit_pct", { precision: 10, scale: 2 }).notNull().default("0.00"),
    winRate: numeric("win_rate", { precision: 6, scale: 2 }).notNull().default("0.00"),
    winTrades: integer("win_trades").notNull().default(0),
    loseTrades: integer("lose_trades").notNull().default(0),
    totalTrades: integer("total_trades").notNull().default(0),
    maxDrawdown: numeric("max_drawdown", { precision: 6, scale: 2 }).notNull().default("0.00"),
    avgTradeProfit: numeric("avg_trade_profit", { precision: 12, scale: 2 }).notNull().default("0.00"),
    score: numeric("score", { precision: 12, scale: 2 }).notNull().default("0.00"),
    rank: integer("rank").notNull().default(0),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("backtest_tournament_entries_tourn_score_idx").on(t.tournamentId, t.score),
    index("backtest_tournament_entries_tourn_user_idx").on(t.tournamentId, t.userId),
    index("backtest_tournament_entries_user_idx").on(t.userId),
  ],
);

export type BacktestTournament = typeof backtestTournamentsTable.$inferSelect;
export type BacktestTournamentEntry = typeof backtestTournamentEntriesTable.$inferSelect;

// ── Preset e Gruppi Tribù della Fratellanza (Limen Protocol) ──────────────────
export const backtestTribePresetsTable = pgTable(
  "backtest_tribe_presets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    tribeName: text("tribe_name").notNull(),
    sigil: text("sigil").notNull().default("fratellanza"),
    pair: text("pair").notNull().default("XAU/USD"),
    timeframe: text("timeframe").notNull().default("M5"),
    initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
    targetProfitPct: numeric("target_profit_pct", { precision: 5, scale: 2 }).notNull().default("15.00"),
    maxTrades: integer("max_trades").notNull().default(50),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(900),
    randomDates: boolean("random_dates").notNull().default(true),
    defaultMembers: jsonb("default_members").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("backtest_tribe_presets_user_idx").on(t.userId),
  ],
);

// ── Lobby Personalizzate Multiplayer per Tornei e Duelli Replay ───────────────
export const backtestCustomLobbiesTable = pgTable(
  "backtest_custom_lobbies",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(), // es. "FORGIA-7429"
    name: text("name").notNull(),
    hostUserId: text("host_user_id").notNull(),
    hostDisplayName: text("host_display_name").notNull(),
    tribePresetId: integer("tribe_preset_id").references(() => backtestTribePresetsTable.id, { onDelete: "set null" }),
    pair: text("pair").notNull().default("XAU/USD"),
    timeframe: text("timeframe").notNull().default("M5"),
    initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
    targetProfitPct: numeric("target_profit_pct", { precision: 5, scale: 2 }).notNull().default("15.00"),
    maxTrades: integer("max_trades").notNull().default(50),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(900),
    randomDates: boolean("random_dates").notNull().default(true),
    status: text("status").notNull().default("waiting"), // "waiting" | "starting" | "live" | "completed"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("backtest_custom_lobbies_code_unique").on(t.code),
    index("backtest_custom_lobbies_status_idx").on(t.status),
    index("backtest_custom_lobbies_host_idx").on(t.hostUserId),
  ],
);

export type BacktestTribePreset = typeof backtestTribePresetsTable.$inferSelect;
export type BacktestCustomLobby = typeof backtestCustomLobbiesTable.$inferSelect;
