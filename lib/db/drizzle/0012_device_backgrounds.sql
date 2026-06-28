ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "background_url_desktop" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "background_url_mobile" text;--> statement-breakpoint
-- Carry an existing custom selection to the mobile slot (old default images were portrait),
-- but NOT the 5 removed default images (their files no longer ship).
UPDATE "user_settings"
   SET "background_url_mobile" = "background_url"
 WHERE "background_url" IS NOT NULL
   AND "background_url" NOT LIKE '/images/IMG\_%';
