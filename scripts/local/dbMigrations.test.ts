import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const migrationsDir = new URL("../../lib/db/drizzle/", import.meta.url);
const journalUrl = new URL("./meta/_journal.json", migrationsDir);
const drizzleConfig = readFileSync(new URL("../../lib/db/drizzle.config.ts", import.meta.url), "utf8");
const schemaIndex = readFileSync(new URL("../../lib/db/src/schema/index.ts", import.meta.url), "utf8");
const databaseProfileStore = readFileSync(
  new URL("../../artifacts/api-server/src/services/brokerHub/databaseProfileStore.ts", import.meta.url),
  "utf8",
);

assert.equal(existsSync(journalUrl), true, "Drizzle migration journal should exist");
assert.match(drizzleConfig, /schema:\s*"\.\/src\/schema\/index\.ts"/);
assert.doesNotMatch(drizzleConfig, /schema:\s*"\.\/src\/schema\/\*\.ts"/);

const journal = JSON.parse(readFileSync(journalUrl, "utf8")) as {
  entries?: Array<{ tag?: string }>;
};
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
const migrationSql = migrationFiles.map((file) => readFileSync(new URL(file, migrationsDir), "utf8")).join("\n");

assert.ok(migrationFiles.length > 0, "Drizzle should include versioned SQL migrations for production deploys");
assert.ok((journal.entries ?? []).length > 0, "Drizzle journal should track generated migrations");
assert.match(schemaIndex, /brokerProfileStoreTable/);
assert.match(migrationSql, /broker_profile_store/);
assert.match(migrationSql, /admin_user_subscriptions/);
assert.doesNotMatch(databaseProfileStore, /CREATE TABLE IF NOT EXISTS broker_profile_store/);

for (const entry of journal.entries ?? []) {
  assert.equal(
    migrationFiles.some((file) => file.includes(entry.tag ?? "")),
    true,
    `Missing SQL migration for journal entry ${entry.tag}`,
  );
}

// Reverse direction: every .sql file MUST be registered in the journal, or
// `drizzle-kit migrate` silently skips it — a migration that never runs in prod
// while CI stays green. (Migrations here are hand-authored: file + journal entry.)
const journalTags = new Set((journal.entries ?? []).map((entry) => entry.tag));
for (const file of migrationFiles) {
  const tag = file.replace(/\.sql$/, "");
  assert.equal(
    journalTags.has(tag),
    true,
    `Migration ${file} is not registered in meta/_journal.json (it would never run)`,
  );
}

console.log("database migration artifact checks passed");
