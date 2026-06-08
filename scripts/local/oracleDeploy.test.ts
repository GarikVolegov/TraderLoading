import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

for (const path of [
  "Dockerfile.oracle",
  "compose.oracle.yml",
  "deploy/oracle/Caddyfile",
  "deploy/oracle/bootstrap-ubuntu.sh",
  "deploy/oracle/validate-env.sh",
  "deploy/oracle/deploy.sh",
  "deploy/oracle/update.sh",
  "deploy/oracle/status.sh",
  ".env.oracle.example",
  "docs/deploy/oracle-always-free.md",
]) {
  assert.equal(existsSync(new URL(`../../${path}`, import.meta.url)), true, `${path} should exist`);
}

const dockerfile = read("Dockerfile.oracle");
assert.match(dockerfile, /FROM node:24-bookworm-slim AS base/);
assert.match(dockerfile, /corepack prepare pnpm@11\.0\.9 --activate/);
assert.match(dockerfile, /ARG VITE_CLERK_PUBLISHABLE_KEY/);
assert.match(dockerfile, /RUN pnpm run build:railway/);
assert.match(dockerfile, /CMD \["node", "\.\/dist\/index\.cjs"\]/);

const compose = read("compose.oracle.yml");
assert.match(compose, /caddy:/);
assert.match(compose, /app:/);
assert.match(compose, /postgres:/);
assert.match(compose, /restart: unless-stopped/);
assert.match(compose, /80:80/);
assert.match(compose, /443:443/);
assert.match(compose, /POSTGRES_PASSWORD/);
assert.match(compose, /DATABASE_URL/);
assert.match(compose, /\/api\/healthz/);
assert.match(compose, /trader_uploads:/);
assert.match(compose, /trader_postgres:/);

const caddyfile = read("deploy/oracle/Caddyfile");
assert.match(caddyfile, /\{\$APP_DOMAIN\}/);
assert.match(caddyfile, /reverse_proxy app:3001/);

const bootstrap = read("deploy/oracle/bootstrap-ubuntu.sh");
assert.match(bootstrap, /set -Eeuo pipefail/);
assert.match(bootstrap, /get\.docker\.com/);
assert.match(bootstrap, /ufw allow 80\/tcp/);
assert.match(bootstrap, /ufw allow 443\/tcp/);
assert.match(bootstrap, /usermod -aG docker/);

const validateEnv = read("deploy/oracle/validate-env.sh");
assert.match(validateEnv, /set -Eeuo pipefail/);
assert.match(validateEnv, /APP_DOMAIN/);
assert.match(validateEnv, /POSTGRES_PASSWORD/);
assert.match(validateEnv, /DATABASE_URL/);
assert.match(validateEnv, /CLERK_SECRET_KEY/);
assert.match(validateEnv, /VAPID_PUBLIC_KEY/);
assert.match(validateEnv, /VAPID_PRIVATE_KEY/);
assert.match(validateEnv, /app\.example\.com/);
assert.match(validateEnv, /change-this/);

const deployScript = read("deploy/oracle/deploy.sh");
assert.match(deployScript, /set -Eeuo pipefail/);
assert.match(deployScript, /bash deploy\/oracle\/validate-env\.sh/);
assert.match(deployScript, /compose\.oracle\.yml/);
assert.match(deployScript, /COMPOSE=\(docker compose/);
assert.match(deployScript, /"\$\{COMPOSE\[@\]\}" build/);
assert.match(deployScript, /pnpm run db:push/);
assert.match(deployScript, /\/api\/healthz/);
assert.match(deployScript, /logs --tail=80 app/);

const updateScript = read("deploy/oracle/update.sh");
assert.match(updateScript, /bash deploy\/oracle\/validate-env\.sh/);
assert.match(updateScript, /git pull --ff-only/);
assert.match(updateScript, /COMPOSE=\(docker compose/);
assert.match(updateScript, /"\$\{COMPOSE\[@\]\}" build app/);
assert.match(updateScript, /pnpm run db:push/);
assert.match(updateScript, /up -d/);

const statusScript = read("deploy/oracle/status.sh");
assert.match(statusScript, /COMPOSE=\(docker compose/);
assert.match(statusScript, /"\$\{COMPOSE\[@\]\}" ps/);
assert.match(statusScript, /curl -fsS/);
assert.match(statusScript, /logs --tail=80/);

const envExample = read(".env.oracle.example");
for (const key of [
  "APP_DOMAIN=",
  "POSTGRES_PASSWORD=",
  "DATABASE_URL=postgresql://",
  "VAPID_PUBLIC_KEY=",
  "VAPID_PRIVATE_KEY=",
  "CLERK_SECRET_KEY=",
  "VITE_CLERK_PUBLISHABLE_KEY=",
]) {
  assert.match(envExample, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const dockerignore = read(".dockerignore");
assert.match(dockerignore, /^\.env\*/m);
assert.match(dockerignore, /^node_modules$/m);
assert.match(dockerignore, /^\.git$/m);

const docs = read("docs/deploy/oracle-always-free.md");
assert.match(docs, /VM\.Standard\.A1\.Flex/);
assert.match(docs, /bash deploy\/oracle\/bootstrap-ubuntu\.sh/);
assert.match(docs, /bash deploy\/oracle\/validate-env\.sh/);
assert.match(docs, /bash deploy\/oracle\/deploy\.sh/);
assert.match(docs, /bash deploy\/oracle\/update\.sh/);
assert.match(docs, /bash deploy\/oracle\/status\.sh/);
assert.match(docs, /docker compose --env-file \.env\.oracle/);
assert.match(docs, /pnpm push:vapid/);
assert.match(docs, /Cloudflare/);
assert.match(docs, /\/api\/healthz/);

console.log("oracle deploy checks passed");
