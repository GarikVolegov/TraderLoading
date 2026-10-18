ALTER TABLE process_drafts
  ADD COLUMN IF NOT EXISTS id text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step integer NOT NULL DEFAULT 0;
