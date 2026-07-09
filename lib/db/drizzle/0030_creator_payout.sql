-- Creator payout (sub-project D). Stripe Connect Express account state + the payout
-- ledger. Dark by default: no rows exist until a creator onboards / requests a payout.
CREATE TABLE IF NOT EXISTS "creator_payout_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "creator_payout_accounts_user_unique" ON "creator_payout_accounts" ("user_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creator_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credits" integer NOT NULL,
	"gross_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"stripe_transfer_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_payouts_user_idx" ON "creator_payouts" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "creator_payouts_transfer_unique" ON "creator_payouts" ("stripe_transfer_id");
