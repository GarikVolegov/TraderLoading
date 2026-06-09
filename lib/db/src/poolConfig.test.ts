import assert from "node:assert/strict";

import { createPgPoolConfig } from "./poolConfig.js";

const baseEnv = {
  DATABASE_URL: "postgres://user:pass@db.example.com:5432/app",
};

assert.deepEqual(createPgPoolConfig(baseEnv), {
  connectionString: baseEnv.DATABASE_URL,
  max: 10,
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
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  },
);

assert.throws(
  () => createPgPoolConfig({}),
  /DATABASE_URL must be set/,
);

console.log("database pool config checks passed");
