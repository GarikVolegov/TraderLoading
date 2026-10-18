import assert from "node:assert/strict";

import { createPgPoolConfig } from "./poolConfig.js";

const baseEnv = {
  DATABASE_URL: "postgres://user:pass@db.example.com:5432/app",
};

assert.deepEqual(createPgPoolConfig(baseEnv), {
  connectionString: baseEnv.DATABASE_URL,
  options: "-c TimeZone=UTC",
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

assert.deepEqual(
  createPgPoolConfig({
    ...baseEnv,
    PGPOOL_MAX: "24",
    PG_IDLE_TIMEOUT_MS: "15000",
    PG_CONNECTION_TIMEOUT_MS: "2500",
    PG_ALLOW_EXIT_ON_IDLE: "true",
    PGSSLMODE: "require",
  }),
  {
    connectionString: baseEnv.DATABASE_URL,
    options: "-c TimeZone=UTC",
    max: 24,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 2_500,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: true },
  },
);

assert.deepEqual(
  createPgPoolConfig({
    ...baseEnv,
    PGPOOL_MAX: "0",
    PG_IDLE_TIMEOUT_MS: "nope",
    PG_CONNECTION_TIMEOUT_MS: "-1",
    PGSSLMODE: "no-verify",
  }),
  {
    connectionString: baseEnv.DATABASE_URL,
    options: "-c TimeZone=UTC",
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  },
);

assert.throws(
  () => createPgPoolConfig({}),
  /DATABASE_URL must be set/,
);

const withOptions = new URL(baseEnv.DATABASE_URL);
withOptions.searchParams.set("options", "-c statement_timeout=1500 -c TimeZone=Europe/Rome");
withOptions.searchParams.set("application_name", "synthetic-audit");
const configured = createPgPoolConfig({ DATABASE_URL: withOptions.toString() });
assert.equal(new URL(configured.connectionString!).searchParams.has("options"), false);
assert.equal(new URL(configured.connectionString!).searchParams.get("application_name"), "synthetic-audit");
assert.equal(configured.options, "-c statement_timeout=1500 -c TimeZone=Europe/Rome -c TimeZone=UTC");
assert.equal(createPgPoolConfig({ ...baseEnv, PGOPTIONS: "-c lock_timeout=1000" }).options, "-c lock_timeout=1000 -c TimeZone=UTC");
assert.throws(
  () => createPgPoolConfig({ DATABASE_URL: "postgres://user:synthetic-secret@" }),
  { message: "DATABASE_URL must be a valid PostgreSQL URL" },
);

console.log("database pool config checks passed");
