ALTER TABLE process_methods ADD COLUMN IF NOT EXISTS review_policy_started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE process_evidence ADD COLUMN IF NOT EXISTS execution_environment text NOT NULL DEFAULT 'unknown'
  CHECK (execution_environment IN ('simulation','real','unknown'));
UPDATE process_evidence SET execution_environment = 'simulation'
  WHERE source = 'replay' AND backtest_trade_id IS NOT NULL AND execution_environment = 'unknown';

CREATE TABLE IF NOT EXISTS process_reviews (
  id text PRIMARY KEY, user_id text NOT NULL,
  method_version_id text NOT NULL REFERENCES process_methods(id),
  recap_id integer NOT NULL REFERENCES journal_recaps(id),
  improvement_id text NOT NULL REFERENCES process_improvements(id),
  kind text NOT NULL CHECK(kind IN ('weekly','four_week')),
  period_start text NOT NULL, period_end text NOT NULL, covered_periods jsonb NOT NULL,
  judgment text NOT NULL, action text NOT NULL, criterion text NOT NULL,
  previous_improvement_id text,
  previous_improvement_outcome text CHECK(previous_improvement_outcome IN ('met','not_met','unassessable')),
  previous_improvement_note text NOT NULL DEFAULT '',
  decision text NOT NULL CHECK(decision IN ('continue','reverify')),
  checks jsonb NOT NULL, report jsonb NOT NULL,
  request_id text NOT NULL, request_snapshot jsonb NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS process_reviews_retry_idx ON process_reviews(user_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_reviews_period_idx ON process_reviews(method_version_id,kind,period_start,period_end);
CREATE INDEX IF NOT EXISTS process_reviews_user_idx ON process_reviews(user_id,reviewed_at);
