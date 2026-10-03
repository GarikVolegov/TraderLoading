-- Stripe webhook idempotency ledger. Stripe retries webhook delivery on any
-- non-2xx response or timeout, so without a dedup guard a retried event would
-- re-apply its side effects (e.g. re-running subscription upserts). Recording the
-- event id as the primary key makes the insert an atomic claim: the retry
-- conflicts and is skipped.
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL
);
