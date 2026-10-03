-- Defense-in-depth for the account.updated webhook mapping (sub-project D): one row
-- per Stripe Connect account. Onboarding is already advisory-locked + idempotency-keyed,
-- so no duplicates should exist to conflict with this index.
CREATE UNIQUE INDEX IF NOT EXISTS "creator_payout_accounts_stripe_unique" ON "creator_payout_accounts" ("stripe_account_id");
