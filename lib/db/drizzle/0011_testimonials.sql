CREATE TABLE IF NOT EXISTS "testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"role" varchar,
	"text" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"locale" varchar,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "testimonials_published_sort_idx" ON "testimonials" ("published","sort_order");
