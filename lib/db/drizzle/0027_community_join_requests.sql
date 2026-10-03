-- Private-community join requests (audit 0.5b). One pending/approved/rejected row
-- per (community, user); re-request updates in place.
CREATE TABLE IF NOT EXISTS "community_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"decided_by_user_id" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_join_requests_pair_idx" ON "community_join_requests" ("community_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_join_requests_status_idx" ON "community_join_requests" ("community_id","status");
