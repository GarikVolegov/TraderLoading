-- Per-user closed-trade reads (profile win-rate, edge/trading-coach, account export)
-- filter account_trades by (user_id) and (user_id, status='closed'). The existing
-- unique index "account_trades_source_ticket_user_unique" leads with `source`, so it
-- cannot serve these predicates and Postgres falls back to a sequential scan that
-- grows with every user's trades. This composite serves both shapes: the full
-- (user_id, status) filter and, via its leftmost prefix, the user_id-only filter.
CREATE INDEX IF NOT EXISTS "account_trades_user_status_idx" ON "account_trades" ("user_id","status");
