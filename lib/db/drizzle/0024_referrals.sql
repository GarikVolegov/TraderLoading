-- Referral / invite loop (audit finding 4.2). referral_codes reverse-maps an invite
-- link's code to its referrer; referrals records each attributed invitee once with an
-- idempotent reward marker.
CREATE TABLE IF NOT EXISTS "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_user_unique" ON "referral_codes" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_code_unique" ON "referral_codes" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"rewarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_unique" ON "referrals" ("referred_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_user_id");
