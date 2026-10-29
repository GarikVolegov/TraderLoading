CREATE INDEX IF NOT EXISTS "journal_images_file_path_idx" ON "journal_images" ("file_path");
CREATE INDEX IF NOT EXISTS "profile_xp_idx" ON "profile" ("xp");
CREATE INDEX IF NOT EXISTS "process_evidence_user_observed_idx" ON "process_evidence" ("user_id", "observed_at");
