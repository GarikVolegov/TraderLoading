import assert from "node:assert/strict";
import { resolveDatabaseTarget } from "./startDatabase.js";

const neon = resolveDatabaseTarget(
  "postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full",
  { localDefaultPortOccupied: false, managedPort: 55432 },
);

assert.equal(neon.host, "ep-example-pooler.eu-central-1.aws.neon.tech");
assert.equal(neon.port, 5432);
assert.equal(neon.managed, false);
assert.equal(neon.url, "postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full");

const localFallback = resolveDatabaseTarget("postgres://trader:trader@127.0.0.1:5432/traderloadings", {
  localDefaultPortOccupied: true,
  managedPort: 55432,
});

assert.equal(localFallback.host, "127.0.0.1");
assert.equal(localFallback.port, 55432);
assert.equal(localFallback.managed, true);
assert.equal(localFallback.url, "postgres://trader:trader@127.0.0.1:55432/traderloadings");

console.log("local start database target checks passed");
