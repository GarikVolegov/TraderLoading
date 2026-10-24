CREATE TABLE IF NOT EXISTS "backtest_chart_preferences" (
  "user_id" text PRIMARY KEY NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "preferences" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
