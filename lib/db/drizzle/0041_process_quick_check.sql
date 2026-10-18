ALTER TABLE process_methods ALTER COLUMN protocol DROP NOT NULL;
ALTER TABLE process_sessions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'application';
