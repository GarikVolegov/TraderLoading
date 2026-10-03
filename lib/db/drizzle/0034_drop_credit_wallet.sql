-- Marketplace pivot cleanup: the in-app credit wallet + in-house payout ledger are
-- removed (paid channels now use Stripe Connect direct charges). Drop the obsolete tables
-- and the legacy credit-pricing columns on community_channels. `creator_payout_accounts`
-- is kept (the Connect account link is reused).
DROP TABLE IF EXISTS "credit_transactions";--> statement-breakpoint
DROP TABLE IF EXISTS "credit_wallets";--> statement-breakpoint
DROP TABLE IF EXISTS "creator_payouts";--> statement-breakpoint
ALTER TABLE "community_channels" DROP COLUMN IF EXISTS "price_credits";--> statement-breakpoint
ALTER TABLE "community_channels" DROP COLUMN IF EXISTS "subscription_period_days";
