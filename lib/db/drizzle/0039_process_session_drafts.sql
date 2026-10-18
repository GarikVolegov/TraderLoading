ALTER TABLE process_sessions
  ADD COLUMN IF NOT EXISTS draft jsonb,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
