CREATE TABLE IF NOT EXISTS "backtest_tribe_presets" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "pair" text DEFAULT 'XAU/USD' NOT NULL,
  "timeframe" text DEFAULT 'M5' NOT NULL,
  "initial_balance" numeric(12, 2) DEFAULT '100000.00' NOT NULL,
  "max_drawdown_pct" numeric(5, 2) DEFAULT '10.00' NOT NULL,
  "target_profit_pct" numeric(5, 2) DEFAULT '15.00' NOT NULL,
  "max_trades" integer DEFAULT 50 NOT NULL,
  "time_limit_seconds" integer DEFAULT 900 NOT NULL,
  "random_dates" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backtest_tribe_presets_user_idx" ON "backtest_tribe_presets" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backtest_custom_lobbies" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "host_user_id" text NOT NULL,
  "host_display_name" text NOT NULL,
  "tribe_preset_id" integer REFERENCES "backtest_tribe_presets"("id") ON DELETE SET NULL,
  "pair" text DEFAULT 'XAU/USD' NOT NULL,
  "timeframe" text DEFAULT 'M5' NOT NULL,
  "initial_balance" numeric(12, 2) DEFAULT '100000.00' NOT NULL,
  "max_drawdown_pct" numeric(5, 2) DEFAULT '10.00' NOT NULL,
  "target_profit_pct" numeric(5, 2) DEFAULT '15.00' NOT NULL,
  "max_trades" integer DEFAULT 50 NOT NULL,
  "time_limit_seconds" integer DEFAULT 900 NOT NULL,
  "random_dates" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "backtest_custom_lobbies_code_unique" ON "backtest_custom_lobbies" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backtest_custom_lobbies_status_idx" ON "backtest_custom_lobbies" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wiki_sources_storage_key_idx" ON "wiki_sources" ("storage_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backtest_tournament_entries_user_idx" ON "backtest_tournament_entries" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backtest_custom_lobbies_host_idx" ON "backtest_custom_lobbies" ("host_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_prizes_user_idx" ON "tournament_prizes" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_applications_user_idx" ON "candidate_applications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_evidence_session_idx" ON "process_evidence" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_join_requests_user_idx" ON "community_join_requests" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_moderation_log_target_idx" ON "community_moderation_log" ("target_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academy_payout_affiliate_idx" ON "academy_payouts" ("affiliate_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academy_lessons_module_idx" ON "academy_lessons" ("module_id", "order_index");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arsenal_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "product_id" text NOT NULL,
  "product_title" text NOT NULL,
  "variant" text,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'eur' NOT NULL,
  "stripe_session_id" text,
  "stripe_payment_intent_id" text,
  "customer_name" text,
  "customer_email" text,
  "customer_phone" text,
  "shipping_address_line1" text,
  "shipping_address_line2" text,
  "shipping_city" text,
  "shipping_postal_code" text,
  "shipping_country" text,
  "fulfillment_status" text DEFAULT 'paid' NOT NULL,
  "fulfillment_provider" text DEFAULT 'dropship_manual' NOT NULL,
  "provider_order_id" text,
  "tracking_number" text,
  "tracking_url" text,
  "carrier" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arsenal_orders_user_idx" ON "arsenal_orders" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arsenal_orders_stripe_session_idx" ON "arsenal_orders" ("stripe_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arsenal_orders_status_idx" ON "arsenal_orders" ("fulfillment_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arsenal_orders_created_idx" ON "arsenal_orders" ("created_at");
