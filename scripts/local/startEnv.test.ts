import assert from "node:assert/strict";
import { buildFrontendDevEnv } from "./startEnv.js";

const env = buildFrontendDevEnv({
  BASE_PATH: "/app",
  PORT: "9999",
  VITE_API_BASE: "http://api.example.test",
  CLERK_PUBLISHABLE_KEY: "pk_test_from_server_key",
  VITE_CLERK_PROXY_URL: "http://clerk-proxy.example.test",
});

assert.equal(env.BASE_PATH, "/app");
assert.equal(env.PORT, "9999");
assert.equal(env.VITE_API_BASE, "http://api.example.test");
assert.equal(env.VITE_CLERK_PUBLISHABLE_KEY, "pk_test_from_server_key");
assert.equal(env.VITE_CLERK_PROXY_URL, "http://clerk-proxy.example.test");

const explicitViteKey = buildFrontendDevEnv({
  CLERK_PUBLISHABLE_KEY: "pk_test_server",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_vite",
});

assert.equal(explicitViteKey.VITE_CLERK_PUBLISHABLE_KEY, "pk_test_vite");

console.log("local start frontend env checks passed");
