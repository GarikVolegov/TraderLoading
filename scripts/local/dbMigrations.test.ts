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

console.log("database migration artifact checks passed");
