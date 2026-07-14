-- In-app credit wallet + append-only ledger (sub-project B). Credits have no cash
-- value (non-refundable, non-withdrawable); stripe_event_id makes purchase grants
-- idempotent against webhook retries.
CREATE TABLE IF NOT EXISTS "credit_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_wallets_user_unique" ON "credit_wallets" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_id" text,
	"stripe_event_id" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_stripe_event_unique" ON "credit_transactions" ("stripe_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_idx" ON "credit_transactions" ("user_id","created_at");
