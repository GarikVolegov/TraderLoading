CREATE TABLE IF NOT EXISTS news_documents (
 id text PRIMARY KEY, article_id text NOT NULL, event_id text NOT NULL, source text NOT NULL,
 published_at timestamptz, first_seen_at timestamptz NOT NULL, evidence_text text NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS news_documents_event_time_idx ON news_documents(event_id, first_seen_at);
CREATE TABLE IF NOT EXISTS news_corpus_runs (
 id text PRIMARY KEY, available_at timestamptz NOT NULL, complete text NOT NULL CHECK(complete IN ('complete','partial')),
 payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS news_corpus_runs_time_idx ON news_corpus_runs(available_at);
CREATE TABLE IF NOT EXISTS market_observations (
 id text PRIMARY KEY, pair text NOT NULL, source text NOT NULL, close_at timestamptz NOT NULL,
 available_at timestamptz NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS market_observations_pair_time_idx ON market_observations(pair, close_at);
CREATE TABLE IF NOT EXISTS market_snapshots (
 id text PRIMARY KEY, pair text NOT NULL, kind text NOT NULL, cutoff_at timestamptz NOT NULL,
 target_end timestamptz NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT now(), payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS market_snapshots_pair_time_idx ON market_snapshots(pair, cutoff_at);
CREATE TABLE IF NOT EXISTS market_outcomes (
 snapshot_id text PRIMARY KEY REFERENCES market_snapshots(id), resolved_at timestamptz NOT NULL, payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS market_decisions (
 id text PRIMARY KEY, user_id text NOT NULL, snapshot_id text NOT NULL REFERENCES market_snapshots(id),
 choice text NOT NULL CHECK(choice IN ('trade','wait')), note text NOT NULL DEFAULT '',
 journal_entry_id integer REFERENCES journal_entries(id) ON DELETE SET NULL, created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_decisions_user_time_idx ON market_decisions(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS market_decisions_retry_idx ON market_decisions(user_id, snapshot_id, choice);
