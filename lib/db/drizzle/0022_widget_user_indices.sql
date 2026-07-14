-- Heavily-polled dashboard widgets (ideas, checklist, quotes, check-ins) filter by
-- user_id on every poll but had no index → sequential scans that grow with the table
-- (audit finding 2.9). Add per-user indices, including the sort key where the widget
-- orders rows, so the common "list mine, newest/ordered first" query is index-served.
CREATE INDEX IF NOT EXISTS "ideas_user_created_idx" ON "ideas" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_items_user_order_idx" ON "checklist_items" ("user_id","order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_user_idx" ON "quotes" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkins_user_created_idx" ON "checkins" ("user_id","created_at");
