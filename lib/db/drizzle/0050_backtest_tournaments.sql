CREATE TABLE IF NOT EXISTS "backtest_tournaments" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "pair" text DEFAULT 'XAU/USD' NOT NULL,
  "timeframe" text DEFAULT 'M5' NOT NULL,
  "initial_balance" numeric(12, 2) DEFAULT '100000.00' NOT NULL,
  "max_drawdown_pct" numeric(5, 2) DEFAULT '10.00' NOT NULL,
  "target_profit_pct" numeric(5, 2) DEFAULT '15.00' NOT NULL,
  "max_trades" integer DEFAULT 50 NOT NULL,
  "time_limit_seconds" integer DEFAULT 900 NOT NULL,
  "start_candle_ts" integer,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "participant_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "backtest_tournament_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "tournament_id" integer NOT NULL REFERENCES "backtest_tournaments"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "country" text DEFAULT 'IT' NOT NULL,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "session_id" integer REFERENCES "backtest_sessions"("id") ON DELETE SET NULL,
  "initial_balance" numeric(12, 2) DEFAULT '100000.00' NOT NULL,
  "final_balance" numeric(12, 2) DEFAULT '100000.00' NOT NULL,
  "total_profit" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "profit_pct" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "win_rate" numeric(6, 2) DEFAULT '0.00' NOT NULL,
  "win_trades" integer DEFAULT 0 NOT NULL,
  "lose_trades" integer DEFAULT 0 NOT NULL,
  "total_trades" integer DEFAULT 0 NOT NULL,
  "max_drawdown" numeric(6, 2) DEFAULT '0.00' NOT NULL,
  "avg_trade_profit" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "score" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "rank" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "backtest_tournaments_slug_unique" ON "backtest_tournaments" ("slug");
CREATE INDEX IF NOT EXISTS "backtest_tournaments_status_idx" ON "backtest_tournaments" ("status");
CREATE INDEX IF NOT EXISTS "backtest_tournament_entries_tourn_score_idx" ON "backtest_tournament_entries" ("tournament_id", "score");
CREATE INDEX IF NOT EXISTS "backtest_tournament_entries_tourn_user_idx" ON "backtest_tournament_entries" ("tournament_id", "user_id");
