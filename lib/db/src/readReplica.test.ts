import assert from "node:assert/strict";
import test from "node:test";
import { createPgPoolConfig } from "./poolConfig.js";

test("replica pool config inherits standard timeouts while isolating connectionString", () => {
  const baseEnv = {
    DATABASE_URL: "postgres://master:pass@master.db:5432/app",
    DATABASE_READ_REPLICA_URL: "postgres://replica:pass@replica.db:5432/app",
    PGPOOL_MAX: "15",
    PG_STATEMENT_TIMEOUT_MS: "3000",
  };

  const masterConfig = createPgPoolConfig(baseEnv);
  const replicaConfig = createPgPoolConfig({
    ...baseEnv,
    DATABASE_URL: baseEnv.DATABASE_READ_REPLICA_URL,
  });

  assert.equal(masterConfig.connectionString, baseEnv.DATABASE_URL);
  assert.equal(replicaConfig.connectionString, baseEnv.DATABASE_READ_REPLICA_URL);
  assert.equal(masterConfig.max, 15);
  assert.equal(replicaConfig.max, 15);
  assert.match(masterConfig.options ?? "", /statement_timeout=3000ms/);
  assert.match(replicaConfig.options ?? "", /statement_timeout=3000ms/);
});
