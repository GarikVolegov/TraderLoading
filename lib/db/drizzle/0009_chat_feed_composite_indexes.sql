-- Composite indexes for keyset-paginated chat/feed reads at scale.
-- Each replaces a single-column index that forced a separate sort step; the
-- trailing key column lets Postgres serve filter + range + ORDER BY ... LIMIT in
-- one index range scan. The dropped indexes are fully subsumed by the new ones.

-- Direct messages: WHERE sender/receiver AND id < cursor ORDER BY id DESC.
DROP INDEX IF EXISTS "idx_chat_sender_receiver";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_sender_receiver_id" ON "chat_messages" ("sender_id","receiver_id","id");
--> statement-breakpoint

-- Community channel chat: WHERE channel_id AND id < cursor ORDER BY id DESC.
DROP INDEX IF EXISTS "community_messages_channel_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_messages_channel_id_idx" ON "community_messages" ("channel_id","id");
--> statement-breakpoint

-- Post comments: WHERE post_id ORDER BY created_at. The standalone created_at
-- index had no global-comment-feed reader and only added insert overhead.
DROP INDEX IF EXISTS "post_comments_post_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "post_comments_created_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_comments_post_created_idx" ON "post_comments" ("post_id","created_at");
