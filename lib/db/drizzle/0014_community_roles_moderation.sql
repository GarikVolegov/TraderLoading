-- Community management, phase 1: granular custom roles + moderation.
--
-- Adds per-community roles (with a JSON permission set), ban and mute tables,
-- and a role_id on community_members. The community creator remains the implicit
-- owner (full power) via communities.creator_id; everyone else derives their
-- capabilities from their assigned role's permissions array.

CREATE TABLE IF NOT EXISTS "community_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_roles_community_idx" ON "community_roles" ("community_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"banned_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_bans_pair_idx" ON "community_bans" ("community_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_bans_community_idx" ON "community_bans" ("community_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_mutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"muted_by" text NOT NULL,
	"until" timestamp,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_mutes_pair_idx" ON "community_mutes" ("community_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_mutes_community_idx" ON "community_mutes" ("community_id");
--> statement-breakpoint
ALTER TABLE "community_members" ADD COLUMN IF NOT EXISTS "role_id" integer;
--> statement-breakpoint
-- Backfill: seed a default "Membro" role for every existing community.
INSERT INTO "community_roles" ("community_id", "name", "permissions", "position", "is_default")
SELECT "id", 'Membro', '[]'::jsonb, 0, true
  FROM "communities"
 WHERE NOT EXISTS (
   SELECT 1 FROM "community_roles" cr
    WHERE cr."community_id" = "communities"."id" AND cr."is_default" = true
 );
--> statement-breakpoint
-- Backfill: seed an "Admin" role (full permission set) for every existing community.
INSERT INTO "community_roles" ("community_id", "name", "permissions", "position", "is_default")
SELECT "id", 'Admin',
       '["community.manage","channels.manage","messages.moderate","files.manage","roles.manage","members.kick","members.ban","members.mute","reviews.respond","reviews.moderate"]'::jsonb,
       1, false
  FROM "communities"
 WHERE NOT EXISTS (
   SELECT 1 FROM "community_roles" cr
    WHERE cr."community_id" = "communities"."id" AND cr."name" = 'Admin' AND cr."is_default" = false
 );
--> statement-breakpoint
-- Map existing 'admin' members to their community's Admin role.
UPDATE "community_members" cm
   SET "role_id" = cr."id"
  FROM "community_roles" cr
 WHERE cr."community_id" = cm."community_id"
   AND cr."name" = 'Admin'
   AND cr."is_default" = false
   AND cm."role" = 'admin'
   AND cm."role_id" IS NULL;
--> statement-breakpoint
-- Map every remaining member (incl. owner, implicit via creator_id) to the default role.
UPDATE "community_members" cm
   SET "role_id" = cr."id"
  FROM "community_roles" cr
 WHERE cr."community_id" = cm."community_id"
   AND cr."is_default" = true
   AND cm."role_id" IS NULL;
