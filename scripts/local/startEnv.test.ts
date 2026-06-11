import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildApiDevEnv, buildFrontendDevArgs, buildFrontendDevEnv } from "./startEnv.js";

const env = buildFrontendDevEnv({
  BASE_PATH: "/app",
  PORT: "9999",
  VITE_API_BASE: "http://api.example.test",
  CLERK_PUBLISHABLE_KEY: "pk_test_from_server_key",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_stripe",
  VITE_CLERK_PROXY_URL: "http://clerk-proxy.example.test",
});

assert.equal(env.BASE_PATH, "/app");
assert.equal(env.PORT, "9999");
assert.equal(env.VITE_API_BASE, "http://api.example.test");
assert.equal(env.VITE_CLERK_PUBLISHABLE_KEY, "pk_test_from_server_key");
assert.equal(env.VITE_STRIPE_PUBLISHABLE_KEY, "pk_test_stripe");
assert.equal(env.VITE_CLERK_PROXY_URL, "http://clerk-proxy.example.test");

const explicitViteKey = buildFrontendDevEnv({
  CLERK_PUBLISHABLE_KEY: "pk_test_server",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_vite",
});

assert.equal(explicitViteKey.VITE_CLERK_PUBLISHABLE_KEY, "pk_test_vite");

const apiEnv = buildApiDevEnv(
  {
    DATABASE_URL: "postgres://from-source",
    MYFXBOOK_EMAIL: "trader@example.test",
    MYFXBOOK_PASSWORD: "secret",
    PORT: "9999",
  },
  "postgres://from-runtime-db",
);

assert.equal(apiEnv.MYFXBOOK_EMAIL, "trader@example.test");
assert.equal(apiEnv.MYFXBOOK_PASSWORD, "secret");
assert.equal(apiEnv.DATABASE_URL, "postgres://from-runtime-db");
assert.equal(apiEnv.BASE_PATH, "/");
assert.equal(apiEnv.NODE_ENV, "development");
assert.equal(apiEnv.PORT, "3001");

assert.deepEqual(buildFrontendDevArgs(), [
  "--filter",
  "@workspace/trader-dashboard",
  "run",
  "dev",
]);

const dashboardPackage = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../artifacts/trader-dashboard/package.json"), "utf8"),
);
assert.match(dashboardPackage.scripts.dev, /--strictPort\b/);

console.log("local start frontend env checks passed");
