-- Marketplace pivot: paid channels priced in real-currency cents, paid via Stripe
-- Connect direct charges (one-time) / Connect subscriptions. Additive — the legacy
-- credit-pricing columns are dropped later in 0034.
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "price_cents" integer;--> statement-breakpoint
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "sub_interval" text;--> statement-breakpoint
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'eur' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "community_channel_entitlements" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_channel_entitlements_sub_idx" ON "community_channel_entitlements" ("stripe_subscription_id");
