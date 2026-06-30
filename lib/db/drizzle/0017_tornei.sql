-- Tornei di trading: gara disciplinata globale, stagioni trimestrali (ciclo del 7).
--
-- Stagioni + iscrizioni opt-in (conto reale sincronizzato) + classifica
-- materializzata (letture senza aggregazioni a runtime) + premi idempotenti +
-- certificati NFT (claimable -> pending -> minted on-chain | failed). Aggiunge
-- inoltre profile.wallet_address per il conio dei certificati.

CREATE TABLE IF NOT EXISTS "tournament_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_seasons_slug_unique" ON "tournament_seasons" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_seasons_status_idx" ON "tournament_seasons" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"consent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_enrollments_season_user_unique" ON "tournament_enrollments" ("season_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_enrollments_user_idx" ON "tournament_enrollments" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"r_cum" double precision DEFAULT 0 NOT NULL,
	"disc_index" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"division" text DEFAULT 'bronzo' NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"prev_rank" integer DEFAULT 0 NOT NULL,
	"trades" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"dq" boolean DEFAULT false NOT NULL,
	"dq_reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_standings_season_user_unique" ON "tournament_standings" ("season_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_standings_season_score_idx" ON "tournament_standings" ("season_id","score");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_prizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"tier" text NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"pro_months" integer DEFAULT 0 NOT NULL,
	"certificate_id" integer,
	"status" text DEFAULT 'granted' NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_prizes_season_user_tier_unique" ON "tournament_prizes" ("season_id","user_id","tier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"season_label" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"tier" text NOT NULL,
	"edition" text DEFAULT 'Open Edition' NOT NULL,
	"rarity" text DEFAULT 'Raro' NOT NULL,
	"mint_status" text DEFAULT 'claimable' NOT NULL,
	"wallet_address" text,
	"chain" text,
	"contract_address" text,
	"token_id" text,
	"tx_hash" text,
	"minted_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_certificates_user_idx" ON "tournament_certificates" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_certificates_season_user_tier_unique" ON "tournament_certificates" ("season_id","user_id","tier");
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "wallet_address" text;
