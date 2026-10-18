ALTER TABLE account_trades ADD COLUMN IF NOT EXISTS execution_environment text NOT NULL DEFAULT 'unknown' CHECK (execution_environment IN ('simulation', 'real', 'unknown'));
