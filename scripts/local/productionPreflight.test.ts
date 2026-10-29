import assert from "node:assert/strict";
import { runProductionPreflight } from "./productionPreflight.js";

// Test 1: Valid production environment passes
{
  const mockEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL:
      "postgres://user:pass@ep-cool-pooler.eu-central-1.neon.tech/neondb?sslmode=require",
    BROKER_VAULT_KEY: "a".repeat(64),
    CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsudHJhZGVybG9hZGluZy5jb20k",
    CLERK_SECRET_KEY: "sk_live_1234567890abcdef",
    VITE_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsudHJhZGVybG9hZGluZy5jb20k",
    VAPID_PUBLIC_KEY: "pubkey",
    VAPID_PRIVATE_KEY: "privkey",
    EXPECTED_REPLICAS: "1",
  };

  const report = runProductionPreflight(mockEnv);
  assert.equal(
    report.passed,
    true,
    `Expected valid report to pass, got errors: ${report.errors.join(", ")}`,
  );
  assert.equal(report.errors.length, 0);
}

// Test 2: Missing BROKER_VAULT_KEY fails
{
  const mockEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL:
      "postgres://user:pass@ep-cool-pooler.eu-central-1.neon.tech/neondb?sslmode=require",
    CLERK_PUBLISHABLE_KEY: "pk_live_123",
    CLERK_SECRET_KEY: "sk_live_123",
  };

  const report = runProductionPreflight(mockEnv);
  assert.equal(report.passed, false);
  assert.ok(report.errors.some((e) => e.includes("BROKER_VAULT_KEY")));
}

// Test 3: Replicas > 1 without Redis fails
{
  const mockEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL:
      "postgres://user:pass@ep-cool-pooler.eu-central-1.neon.tech/neondb?sslmode=require",
    BROKER_VAULT_KEY: "b".repeat(64),
    CLERK_PUBLISHABLE_KEY: "pk_live_123",
    CLERK_SECRET_KEY: "sk_live_123",
    EXPECTED_REPLICAS: "3",
  };

  const report = runProductionPreflight(mockEnv);
  assert.equal(report.passed, false);
  assert.ok(report.errors.some((e) => e.includes("Scaling out requires Redis")));
}

// Test 4: VITE_CLERK_PROXY_URL populated fails
{
  const mockEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL:
      "postgres://user:pass@ep-cool-pooler.eu-central-1.neon.tech/neondb?sslmode=require",
    BROKER_VAULT_KEY: "c".repeat(64),
    CLERK_PUBLISHABLE_KEY: "pk_live_123",
    CLERK_SECRET_KEY: "sk_live_123",
    VITE_CLERK_PROXY_URL: "https://proxy.example.com",
  };

  const report = runProductionPreflight(mockEnv);
  assert.equal(report.passed, false);
  assert.ok(report.errors.some((e) => e.includes("VITE_CLERK_PROXY_URL must be empty")));
}

console.log("production preflight unit tests passed successfully");
