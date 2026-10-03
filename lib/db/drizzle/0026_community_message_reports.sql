-- Community message reports (audit finding 3.6 — moderation loop). Members can
-- report a chat message; one report per (message, reporter); a moderator resolves
-- it. Mirrors community_review_reports.
CREATE TABLE IF NOT EXISTS "community_message_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"message_id" integer NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" text,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_message_reports_pair_idx" ON "community_message_reports" ("message_id","reporter_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_message_reports_community_idx" ON "community_message_reports" ("community_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_message_reports_status_idx" ON "community_message_reports" ("status");
