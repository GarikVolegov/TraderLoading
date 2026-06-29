-- Community management, phase 2: full customization of a community.
--
-- Adds image assets (banner + avatar, distinct from the emoji icon), an accent
-- color and editable long-form texts (rules + welcome message), plus updated_at.

ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "banner_url" text;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "avatar_url" text;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "accent_color" text;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "rules" text;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "welcome_message" text;
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
