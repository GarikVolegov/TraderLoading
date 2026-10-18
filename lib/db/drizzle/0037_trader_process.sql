CREATE TABLE IF NOT EXISTS process_methods (
 id text PRIMARY KEY, user_id text NOT NULL, method_id text NOT NULL, version integer NOT NULL CHECK(version > 0),
 name text NOT NULL, rules jsonb NOT NULL, protocol jsonb NOT NULL,
 phase text NOT NULL DEFAULT 'define' CHECK(phase IN ('define','verify','apply','consolidate')),
 active boolean NOT NULL DEFAULT false, request_id text NOT NULL, risk_confirmed_at timestamptz NOT NULL,
 phase_started_at timestamptz NOT NULL DEFAULT now(), verification_started_at timestamptz, application_started_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS process_methods_user_active_idx ON process_methods(user_id) WHERE active = true;
CREATE UNIQUE INDEX IF NOT EXISTS process_methods_version_idx ON process_methods(user_id,method_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS process_methods_retry_idx ON process_methods(user_id,request_id);
CREATE INDEX IF NOT EXISTS process_methods_user_idx ON process_methods(user_id);
CREATE TABLE IF NOT EXISTS process_drafts (user_id text PRIMARY KEY,draft jsonb NOT NULL,previous_version_id text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS process_sessions (
 id text PRIMARY KEY,user_id text NOT NULL,day text NOT NULL,method_version_id text NOT NULL REFERENCES process_methods(id),
 rules_snapshot jsonb NOT NULL,state text NOT NULL DEFAULT 'preparation' CHECK(state IN ('preparation','plan','operation','closed')),
 checklist jsonb NOT NULL,mood text NOT NULL DEFAULT '',focus text NOT NULL DEFAULT '',plan jsonb,closure jsonb,improvement_id text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),prepared_at timestamptz,closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS process_sessions_user_day_idx ON process_sessions(user_id,day);
CREATE INDEX IF NOT EXISTS process_sessions_method_idx ON process_sessions(method_version_id);
CREATE TABLE IF NOT EXISTS process_evidence (
 id text PRIMARY KEY,user_id text NOT NULL,method_version_id text NOT NULL REFERENCES process_methods(id),
 purpose text NOT NULL CHECK(purpose IN ('development','validation','live')),source text NOT NULL CHECK(source IN ('manual','external','replay','account_trade')),
 net_r numeric,initial_risk numeric CHECK(initial_risk > 0),net_pnl numeric,
 costs_status text NOT NULL CHECK(costs_status IN ('included','excluded','unknown')),currency text,account text,
 observed_at timestamptz NOT NULL,adherence text NOT NULL CHECK(adherence IN ('conforming','violation','unknown')),
 provenance text NOT NULL CHECK(provenance IN ('declared','calculated','estimated')),note text NOT NULL DEFAULT '',
 account_trade_id integer REFERENCES account_trades(id) ON DELETE SET NULL,backtest_trade_id integer REFERENCES backtest_trades(id) ON DELETE SET NULL,
 session_id text REFERENCES process_sessions(id),request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS process_evidence_retry_idx ON process_evidence(user_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_evidence_account_idx ON process_evidence(user_id,method_version_id,purpose,account_trade_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_evidence_replay_idx ON process_evidence(user_id,method_version_id,purpose,backtest_trade_id);
CREATE INDEX IF NOT EXISTS process_evidence_method_idx ON process_evidence(user_id,method_version_id);
CREATE TABLE IF NOT EXISTS process_improvements (
 id text PRIMARY KEY,user_id text NOT NULL,method_version_id text NOT NULL REFERENCES process_methods(id),recap_id integer NOT NULL REFERENCES journal_recaps(id),
 action text NOT NULL,criterion text NOT NULL,request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS process_improvements_retry_idx ON process_improvements(user_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_improvements_recap_idx ON process_improvements(user_id,method_version_id,recap_id);
CREATE INDEX IF NOT EXISTS process_improvements_user_idx ON process_improvements(user_id,created_at);
CREATE TABLE IF NOT EXISTS process_advancements (
 id text PRIMARY KEY,user_id text NOT NULL,method_version_id text NOT NULL REFERENCES process_methods(id),from_phase text NOT NULL,to_phase text NOT NULL,
 review text NOT NULL,checks_snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS process_advancements_phase_idx ON process_advancements(method_version_id,from_phase);
