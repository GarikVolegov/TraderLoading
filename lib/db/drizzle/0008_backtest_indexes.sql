-- Backtest scalability indexes.
-- routes/backtest.ts lists a user's sessions newest-first and loads trades per
-- session newest-first; both were sequential scans. The trades index also backs
-- the ON DELETE CASCADE on the session FK (Postgres does not auto-index FKs).
CREATE INDEX IF NOT EXISTS "backtest_sessions_user_created_idx" ON "backtest_sessions" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backtest_trades_session_created_idx" ON "backtest_trades" ("session_id","created_at");
