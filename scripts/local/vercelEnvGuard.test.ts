import assert from "node:assert/strict";
import { assertProductionDatabaseUrl, validateProductionDatabaseUrl } from "./vercelEnvGuard.js";

assert.deepEqual(
  validateProductionDatabaseUrl("postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full"),
  { ok: true, host: "ep-example-pooler.eu-central-1.aws.neon.tech" },
);

assert.deepEqual(
  validateProductionDatabaseUrl("postgres://trader:trader@127.0.0.1:5432/traderloadings"),
  { ok: false, reason: "loopback", host: "127.0.0.1" },
);

assert.deepEqual(
  validateProductionDatabaseUrl(""),
  { ok: false, reason: "missing", host: null },
);

assert.deepEqual(
  validateProductionDatabaseUrl("not-a-url"),
  { ok: false, reason: "invalid", host: null },
);

assert.throws(
  () => assertProductionDatabaseUrl("postgres://trader:trader@127.0.0.1:5432/traderloadings"),
  /Vercel DATABASE_URL points to 127\.0\.0\.1/,
);

console.log("vercel env guard checks passed");
