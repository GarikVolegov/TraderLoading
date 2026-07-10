-- Public blog engine (Phase 2a): language-neutral posts + one translation row
-- per (post, language). Kept separate from library_contents so public
-- crawlable content never shares a table with XP-gated in-app content.
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"related_library_content_id" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_unique" ON "blog_posts" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"lang" text NOT NULL,
	"title" text NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_translations_post_idx" ON "blog_post_translations" ("post_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_post_translations_post_lang_key" ON "blog_post_translations" ("post_id","lang");
