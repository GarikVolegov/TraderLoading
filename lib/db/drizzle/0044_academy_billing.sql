CREATE TABLE IF NOT EXISTS academy_subscriptions (
  user_id text PRIMARY KEY, stripe_customer_id text, stripe_subscription_id text,
  stripe_price_id text, status text NOT NULL DEFAULT 'none', current_period_end timestamptz,
  paid_through timestamptz, latest_paid_invoice_id text, payment_revoked boolean NOT NULL DEFAULT false,
  cancel_at_period_end boolean NOT NULL DEFAULT false, checkout_session_id text, checkout_attempt_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_subscription_stripe_idx ON academy_subscriptions (stripe_subscription_id);
CREATE TABLE IF NOT EXISTS academy_affiliates (
  user_id text PRIMARY KEY, code text NOT NULL, terms_version text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_affiliate_code_idx ON academy_affiliates (code);
CREATE TABLE IF NOT EXISTS academy_attributions (
  buyer_user_id text PRIMARY KEY, affiliate_user_id text, code text, terms_version text, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_no_self_referral CHECK (affiliate_user_id IS NULL OR affiliate_user_id <> buyer_user_id)
);
CREATE TABLE IF NOT EXISTS academy_commissions (
  id text PRIMARY KEY, stripe_invoice_id text NOT NULL, stripe_subscription_id text NOT NULL,
  stripe_payment_intent_id text, stripe_charge_id text NOT NULL, buyer_user_id text NOT NULL, affiliate_user_id text,
  gross_paid_cents integer NOT NULL CHECK (gross_paid_cents >= 0), amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  reversed_cents integer NOT NULL DEFAULT 0 CHECK (reversed_cents >= 0 AND reversed_cents <= amount_cents),
  refunded_gross_cents integer NOT NULL DEFAULT 0 CHECK (refunded_gross_cents >= 0), disputed boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'eur' CHECK (currency = 'eur'), rate_bps integer NOT NULL DEFAULT 2000 CHECK (rate_bps = 2000),
  available_at timestamptz NOT NULL, period_end timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_commission_no_self_referral CHECK (affiliate_user_id IS NULL OR affiliate_user_id <> buyer_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_commission_invoice_idx ON academy_commissions (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS academy_commission_charge_idx ON academy_commissions (stripe_charge_id);
CREATE INDEX IF NOT EXISTS academy_commission_affiliate_idx ON academy_commissions (affiliate_user_id, available_at);
CREATE TABLE IF NOT EXISTS academy_payouts (
  id text PRIMARY KEY, commission_id text NOT NULL REFERENCES academy_commissions(id), affiliate_user_id text NOT NULL,
  stripe_account_id text NOT NULL, amount_cents integer NOT NULL CHECK (amount_cents > 0), stripe_transfer_id text,
  transfer_reversed_cents integer NOT NULL DEFAULT 0 CHECK (transfer_reversed_cents >= 0 AND transfer_reversed_cents <= amount_cents),
  status text NOT NULL DEFAULT 'pending', requested_by text NOT NULL, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_payout_commission_idx ON academy_payouts (commission_id);
