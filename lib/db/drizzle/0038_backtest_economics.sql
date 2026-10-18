ALTER TABLE backtest_trades
  ADD COLUMN IF NOT EXISTS initial_risk numeric(18,6),
  ADD COLUMN IF NOT EXISTS cost numeric(18,6),
  ADD COLUMN IF NOT EXISTS net_pnl numeric(18,6),
  ADD COLUMN IF NOT EXISTS net_r numeric(18,8),
  ADD COLUMN IF NOT EXISTS economics_provenance text NOT NULL DEFAULT 'legacy_unknown',
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS open_time timestamptz,
  ADD COLUMN IF NOT EXISTS close_time timestamptz;
