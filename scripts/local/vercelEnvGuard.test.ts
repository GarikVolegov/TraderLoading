import assert from "node:assert/strict";
import {
  assertProductionDatabaseUrl,
  assertProductionKey,
  assertProductionUrl,
  assertVercelProductionEnv,
  validateProductionDatabaseUrl,
  validateProductionKey,
  validateProductionUrl,
} from "./vercelEnvGuard.js";

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

assert.deepEqual(validateProductionUrl("https://www.traderloading.com/"), {
  ok: true,
  origin: "https://www.traderloading.com",
});

assert.deepEqual(validateProductionUrl("http://www.traderloading.com"), {
  ok: false,
  reason: "insecure",
  origin: "http://www.traderloading.com",
});

assert.deepEqual(validateProductionKey("pk_live_example", "pk_live_", "pk_test_"), { ok: true });
assert.deepEqual(validateProductionKey("pk_test_example", "pk_live_", "pk_test_"), {
  ok: false,
  reason: "test",
});
assert.deepEqual(validateProductionKey("", "pk_live_", "pk_test_"), {
  ok: false,
  reason: "missing",
});

assert.throws(
  () => assertProductionUrl("APP_BASE_URL", "http://www.traderloading.com"),
  /Use the https production URL/,
);

assert.throws(
  () => assertProductionKey("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example", "pk_live_", "pk_test_"),
  /is a test key/,
);

assert.doesNotThrow(() =>
  assertVercelProductionEnv({
    DATABASE_URL: "postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full",
    APP_BASE_URL: "https://www.traderloading.com",
    CLERK_PUBLISHABLE_KEY: "pk_live_example",
    VITE_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    CLERK_SECRET_KEY: "sk_live_example",
  } as NodeJS.ProcessEnv),
);

console.log("vercel env guard checks passed");
