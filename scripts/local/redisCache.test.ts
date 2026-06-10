import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;
}

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

assert.equal(
  existsSync(new URL("../../artifacts/api-server/src/lib/cache.ts", import.meta.url)),
  true,
  "API server should provide a shared cache helper",
);

const apiPackage = readJson<{ dependencies?: Record<string, string> }>("artifacts/api-server/package.json");
assert.ok(apiPackage.dependencies?.redis, "API server should include the Redis client dependency");

const cacheSource = read("artifacts/api-server/src/lib/cache.ts");
for (const token of [
  "REDIS_URL",
  "createClient",
  "createMemoryCacheStore",
  "createRedisCacheStore",
  "getAppCache",
  "getJsonCache",
  "setJsonCache",
  "setEx",
]) {
  assert.match(cacheSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const calendarSource = read("artifacts/api-server/src/routes/calendar.ts");
assert.match(calendarSource, /getJsonCache<CalendarEvent\[]>/);
assert.match(calendarSource, /setJsonCache\(/);
assert.doesNotMatch(calendarSource, /let cache:/);

const envExample = read(".env.production.example");
assert.match(envExample, /REDIS_URL=/);

const cloudformation = read("infra/aws/cloudformation/ecs-fargate.yml");
for (const token of [
  "AWS::ElastiCache::SubnetGroup",
  "AWS::ElastiCache::ReplicationGroup",
  "RedisSecurityGroup",
  "REDIS_URL",
  "TransitEncryptionEnabled: true",
  "AtRestEncryptionEnabled: true",
  "CacheNodeType:",
  "FromPort: 6379",
  "rediss://",
]) {
  assert.match(cloudformation, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const docs = read("docs/deploy/aws-ecs-fargate.md");
assert.match(docs, /ElastiCache/);
assert.match(docs, /REDIS_URL/);
assert.match(docs, /calendar/);

console.log("redis cache checks passed");
