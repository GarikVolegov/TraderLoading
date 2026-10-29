ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "trial_used_at" timestamp;
--> statement-breakpoint
UPDATE "admin_user_subscriptions" SET "trial_started_at" = COALESCE("trial_started_at", "updated_at"), "trial_used_at" = COALESCE("trial_used_at", "updated_at") WHERE "source" = 'trial_1_day';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "honor_seals" (
  "hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "signature" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "honor_seals_user_idx" ON "honor_seals" ("user_id","created_at");
