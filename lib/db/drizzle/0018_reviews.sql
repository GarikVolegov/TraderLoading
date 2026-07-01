-- Real customer reviews: turn the editorial `testimonials` table into the store for
-- genuine, in-app user reviews too.
--
-- User reviews carry a `user_id` and a moderation `status` (pending → approved by an
-- admin, or rejected/withdrawn). `published` stays the single public gate, so
-- /public/stats and /public/testimonials keep working unchanged. Editorial rows keep
-- user_id NULL and default to status 'approved'. A partial-unique index enforces one
-- live review per authenticated user. `review_prompt_state` records snooze/opt-out so
-- the in-app prompt never nags.

ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "moderated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "moderated_by" text;
--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonials_status_idx" ON "testimonials" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "testimonials_user_unique" ON "testimonials" ("user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_prompt_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"snoozed_until" timestamp with time zone,
	"opted_out" boolean DEFAULT false NOT NULL,
	"last_shown_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
