import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const apiPackage = readJson<{ dependencies?: Record<string, string> }>("artifacts/api-server/package.json");
assert.ok(apiPackage.dependencies?.["@sentry/node"], "API server should include Sentry Node SDK");

assert.equal(
  existsSync(new URL("../../artifacts/api-server/src/lib/observability.ts", import.meta.url)),
  true,
  "observability helper should exist",
);

const observabilitySource = readText("artifacts/api-server/src/lib/observability.ts");
for (const token of [
  'import * as Sentry from "@sentry/node"',
  "export function initObservability",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "SENTRY_TRACES_SAMPLE_RATE",
  "APP_VERSION",
  "export function captureError",
  "export async function flushObservability",
  "Sentry.captureException",
  "Sentry.flush",
]) {
  assert.match(observabilitySource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const appSource = readText("artifacts/api-server/src/app.ts");
assert.match(appSource, /import \{\s*captureError\s*\} from "\.\/lib\/observability"/);
assert.match(appSource, /captureError\(err/);

const indexSource = readText("artifacts/api-server/src/index.ts");
assert.match(indexSource, /import \{\s*captureError,\s*flushObservability,\s*initObservability\s*\} from "\.\/lib\/observability"/);
assert.match(indexSource, /initObservability\(\)/);
assert.match(indexSource, /captureError\(err/);
assert.match(indexSource, /await flushObservability\(2_000\)/);

const healthSource = readText("artifacts/api-server/src/routes/health.ts");
for (const token of [
  "createHealthRouter",
  'router.get("/healthz"',
  'router.get("/readyz"',
  'router.get("/status"',
  "select 1",
  "uptimeSeconds",
  "checks",
  "database",
  "503",
]) {
  assert.match(healthSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const envExample = readText(".env.production.example");
for (const key of [
  "APP_VERSION=",
  "SENTRY_DSN=",
  "SENTRY_ENVIRONMENT=production",
  "SENTRY_TRACES_SAMPLE_RATE=0.05",
  "DD_SERVICE=traderloadings-api",
  "NEW_RELIC_APP_NAME=TraderLoadings API",
]) {
  assert.match(envExample, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const cloudformation = readText("infra/aws/cloudformation/ecs-fargate.yml");
for (const token of [
  "SentryDsn:",
  "APP_VERSION",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "SENTRY_TRACES_SAMPLE_RATE",
  "DD_SERVICE",
  "NEW_RELIC_APP_NAME",
  "/api/readyz",
]) {
  assert.match(cloudformation, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.doesNotMatch(cloudformation, /ValueFrom: !Sub "\$\{AppSecret\}:SENTRY_DSN::"/);
assert.doesNotMatch(cloudformation, /ValueFrom: !Sub "\$\{AppSecret\}:DD_API_KEY::"/);
assert.doesNotMatch(cloudformation, /ValueFrom: !Sub "\$\{AppSecret\}:NEW_RELIC_LICENSE_KEY::"/);

const docs = readText("docs/deploy/aws-ecs-fargate.md");
assert.match(docs, /CloudWatch/);
assert.match(docs, /Sentry/);
assert.match(docs, /Datadog/);
assert.match(docs, /New Relic/);
assert.match(docs, /\/api\/readyz/);

console.log("monitoring observability checks passed");
