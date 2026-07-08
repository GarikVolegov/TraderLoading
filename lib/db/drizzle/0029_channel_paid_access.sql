-- Per-channel paid access (sub-project C). Channels gain optional credit pricing
-- (NULL / <= 0 ⇒ free); entitlements record who has unlocked a paid channel
-- (one row per channel+user; NULL expiry ⇒ permanent one-time unlock).
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "price_credits" integer;--> statement-breakpoint
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "access_model" text;--> statement-breakpoint
ALTER TABLE "community_channels" ADD COLUMN IF NOT EXISTS "subscription_period_days" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_channel_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_channel_entitlements_pair_idx" ON "community_channel_entitlements" ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_channel_entitlements_user_idx" ON "community_channel_entitlements" ("user_id");
