-- Wiki vector store + hierarchical folders.
-- Hand-authored: drizzle-kit cannot emit CREATE EXTENSION, the pgvector column,
-- or the HNSW index. Requires a pgvector-capable Postgres (Neon has it; local
-- self-host must use the pgvector/pgvector image — see compose.oracle.yml).
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
-- Semantic embedding for each chunk. 768 dims = Ollama nomic-embed-text and MUST
-- match EMBEDDING_DIM in lib/db/src/schema/vector.ts. Nullable so the app keeps
-- working (keyword-only) until embeddings are generated via ingest/reindex.
ALTER TABLE "wiki_chunks" ADD COLUMN "embedding" vector(768);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wiki_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"color" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_folders" ADD CONSTRAINT "wiki_folders_parent_id_wiki_folders_id_fk"
	FOREIGN KEY ("parent_id") REFERENCES "wiki_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_folders_user_parent_idx" ON "wiki_folders" ("user_id","parent_id");
--> statement-breakpoint
ALTER TABLE "wiki_sources" ADD COLUMN "folder_id" integer;
--> statement-breakpoint
ALTER TABLE "wiki_sources" ADD CONSTRAINT "wiki_sources_folder_id_wiki_folders_id_fk"
	FOREIGN KEY ("folder_id") REFERENCES "wiki_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_sources_user_folder_idx" ON "wiki_sources" ("user_id","folder_id");
--> statement-breakpoint
-- HNSW cosine index: no training / `lists` tuning and builds fine on the empty
-- column. Used by queryWiki's `embedding <=> $query` similarity ordering.
CREATE INDEX IF NOT EXISTS "wiki_chunks_embedding_hnsw" ON "wiki_chunks"
	USING hnsw ("embedding" vector_cosine_ops);
