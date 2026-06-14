CREATE TABLE "candle_ingestion_state" (
	"symbol" smallint NOT NULL,
	"res" smallint NOT NULL,
	"source" smallint NOT NULL,
	"first_ts" bigint,
	"last_ts" bigint,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candle_ingestion_state_symbol_res_pk" PRIMARY KEY("symbol","res")
);
--> statement-breakpoint
CREATE TABLE "candle" (
	"symbol" smallint NOT NULL,
	"res" smallint NOT NULL,
	"ts" bigint NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision DEFAULT 0 NOT NULL,
	"source" smallint NOT NULL,
	CONSTRAINT "candle_symbol_res_ts_pk" PRIMARY KEY("symbol","res","ts")
) PARTITION BY RANGE ("ts");
--> statement-breakpoint
-- Seed monthly partitions covering the 5-year warehouse window (+2 future months).
-- The ingestion job recreates any missing partition on demand (CREATE IF NOT EXISTS),
-- so this only needs to make the table immediately usable after migration.
DO $$
DECLARE
	m date := date_trunc('month', now() - interval '5 years')::date;
	end_month date := date_trunc('month', now() + interval '2 months')::date;
	part_name text;
BEGIN
	WHILE m < end_month LOOP
		part_name := format('candle_p%s', to_char(m, 'YYYY_MM'));
		EXECUTE format(
			'CREATE TABLE IF NOT EXISTS %I PARTITION OF "candle" FOR VALUES FROM (%s) TO (%s)',
			part_name,
			extract(epoch from m)::bigint,
			extract(epoch from (m + interval '1 month'))::bigint
		);
		m := m + interval '1 month';
	END LOOP;
END $$;
