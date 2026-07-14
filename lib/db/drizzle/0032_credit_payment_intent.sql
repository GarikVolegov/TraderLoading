-- Map credit purchases back to their Stripe charge so a later refund/chargeback can
-- reverse the granted credits (sub-project B/D anti-fraud seam).
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_payment_intent_idx" ON "credit_transactions" ("stripe_payment_intent_id");
