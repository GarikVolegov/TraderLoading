CREATE TABLE IF NOT EXISTS "chat_file_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_key" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"peer_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_file_access_file_key_unique" ON "chat_file_access" ("file_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_file_access_owner_idx" ON "chat_file_access" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_file_access_peer_idx" ON "chat_file_access" ("peer_user_id");
