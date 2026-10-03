-- Append-only moderation audit trail (audit finding 2.9): records who did what to
-- whom (ban/unban/mute/unmute/kick/role-change/message-delete/role CRUD) so
-- community moderation is accountable.
CREATE TABLE IF NOT EXISTS "community_moderation_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"target_id" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_moderation_log_community_idx" ON "community_moderation_log" ("community_id","created_at");
