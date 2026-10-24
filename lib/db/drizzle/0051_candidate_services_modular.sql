ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "selected_services" jsonb DEFAULT '["base_protocol"]'::jsonb;
ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "approved_services" jsonb DEFAULT '["base_protocol"]'::jsonb;
ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "monthly_fee_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "one_time_fee_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'EUR' NOT NULL;
