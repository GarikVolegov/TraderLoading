CREATE TABLE IF NOT EXISTS financial_profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  total_net_worth numeric(14, 2) NOT NULL DEFAULT '0',
  monthly_expenses numeric(14, 2) NOT NULL DEFAULT '0',
  liquidity_months_covered integer NOT NULL DEFAULT 6,
  external_stable_income numeric(14, 2) NOT NULL DEFAULT '0',
  has_dependents boolean NOT NULL DEFAULT false,
  liquidity_allocation numeric(14, 2) NOT NULL DEFAULT '0',
  reserve_allocation numeric(14, 2) NOT NULL DEFAULT '0',
  trading_allocation numeric(14, 2) NOT NULL DEFAULT '0',
  investments_allocation numeric(14, 2) NOT NULL DEFAULT '0',
  future_projects_allocation numeric(14, 2) NOT NULL DEFAULT '0',
  account_objective text NOT NULL DEFAULT 'GROWTH',
  time_horizon_years numeric(6, 2) NOT NULL DEFAULT '3',
  expected_monthly_return_pct numeric(6, 2) NOT NULL DEFAULT '3',
  simulated_drawdown_pct numeric(6, 2) NOT NULL DEFAULT '10',
  is_completed boolean NOT NULL DEFAULT false,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_profiles_user_idx ON financial_profiles(user_id);
