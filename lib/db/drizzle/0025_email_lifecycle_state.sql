-- Lifecycle-email state (audit finding 4.1). One row per user tracking when each
-- lifecycle email (welcome / weekly digest / win-back) last went out, plus a
-- per-user opt-out, so the audience selector can dedupe and respect the digest
-- interval and win-back cooldown.
CREATE TABLE IF NOT EXISTS "email_lifecycle_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"welcome_sent_at" timestamp,
	"last_digest_at" timestamp,
	"last_winback_at" timestamp,
	"opt_out" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_lifecycle_state_user_unique" ON "email_lifecycle_state" ("user_id");
