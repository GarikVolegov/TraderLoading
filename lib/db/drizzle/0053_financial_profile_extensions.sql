ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "monthly_pac" numeric(14, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "target_net_worth" numeric(14, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "wealth_sub_allocations" text;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "tax_country" text DEFAULT 'IT' NOT NULL;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "tax_regime" text DEFAULT 'DICHIARATIVO' NOT NULL;
ALTER TABLE "financial_profiles" ADD COLUMN IF NOT EXISTS "show_net_of_tax" boolean DEFAULT true NOT NULL;
