CREATE TABLE IF NOT EXISTS "candle_import_chunks" (
  "symbol" smallint NOT NULL,
  "res" smallint NOT NULL,
  "source" smallint NOT NULL,
  "from_ts" bigint NOT NULL,
  "to_ts" bigint NOT NULL,
  "status" text NOT NULL,
  "candle_count" integer DEFAULT 0 NOT NULL,
  "first_ts" bigint,
  "last_ts" bigint,
  "last_error" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "candle_import_chunks_pk" PRIMARY KEY ("symbol", "res", "source", "from_ts", "to_ts"),
  CONSTRAINT "candle_import_chunks_range" CHECK ("from_ts" < "to_ts"),
  CONSTRAINT "candle_import_chunks_status" CHECK ("status" IN ('running', 'verified', 'failed'))
);
