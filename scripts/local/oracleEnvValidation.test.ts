import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const envFileName = ".tmp-oracle-env-validation-test.env";
const envPath = path.join(root, envFileName);

const envBody = [
  "APP_DOMAIN=app.traderloading.example",
  "POSTGRES_DB=traderloading",
  "POSTGRES_USER=traderloading",
  "POSTGRES_PASSWORD=local-valid-password-123",
  "DATABASE_URL=postgresql://traderloading:local-valid-password-123@postgres:5432/traderloading",
  "NODE_ENV=production",
  "API_CORS_ORIGINS=https://app.traderloading.example",
  "FRONTEND_DIST_DIR=/app/artifacts/trader-dashboard/dist/public",
  "VITE_API_BASE=",
  "VITE_CLERK_PUBLISHABLE_KEY=pk_test_valid",
  "VITE_CLERK_PROXY_URL=",
  "CLERK_PUBLISHABLE_KEY=pk_test_valid",
  "CLERK_SECRET_KEY=sk_test_valid",
  "VAPID_PUBLIC_KEY=PUBLIC_KEY_VALUE",
  "VAPID_PRIVATE_KEY=PRIVATE_KEY_VALUE",
  "VAPID_EMAIL=mailto:noreply@traderloading.app",
].join("\r\n");

try {
  writeFileSync(envPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(envBody, "utf8")]));

  const output = execFileSync("bash", ["deploy/oracle/validate-env.sh"], {
    cwd: root,
    env: { ...process.env, ORACLE_ENV_FILE: envFileName },
    encoding: "utf8",
  });

  assert.match(output, /Oracle env validation passed/);
} finally {
  if (existsSync(envPath)) unlinkSync(envPath);
}

console.log("oracle env validation checks passed");
