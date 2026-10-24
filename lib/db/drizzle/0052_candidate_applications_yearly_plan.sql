ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "billing_cycle" text DEFAULT 'monthly' NOT NULL;
ALTER TABLE "candidate_applications" ADD COLUMN IF NOT EXISTS "yearly_fee_cents" integer DEFAULT 0 NOT NULL;
