-- Community management, phase 3: member reviews with a visible rating.
--
-- One review per member (1-5 stars + text), optional owner reply, soft-hide
-- moderation and a reports table. Rating aggregates are denormalized onto
-- communities (rating_sum / rating_count over non-hidden reviews) so the
-- discovery list can show the score without a per-row subquery.

ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "rating_sum" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"owner_response" text,
	"owner_response_at" timestamp,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_reviews_pair_idx" ON "community_reviews" ("community_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_reviews_community_idx" ON "community_reviews" ("community_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_review_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_review_reports_pair_idx" ON "community_review_reports" ("review_id","reporter_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_review_reports_review_idx" ON "community_review_reports" ("review_id");
