CREATE TABLE IF NOT EXISTS "admin_user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"manual_override" boolean DEFAULT true NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "admin_user_subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_subscriptions_user_unique" ON "admin_user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_subscriptions_plan_idx" ON "admin_user_subscriptions" USING btree ("plan");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_subscriptions_status_idx" ON "admin_user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_subscriptions_customer_idx" ON "admin_user_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_subscriptions_subscription_idx" ON "admin_user_subscriptions" USING btree ("stripe_subscription_id");
