/** Local-only PostgreSQL integration probe. Creates and drops an isolated schema. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const requireDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const pg = requireDb("pg");
const { drizzle } = requireDb("drizzle-orm/node-postgres");
const schemaTypes = await import("../lib/db/src/schema/index.ts");
import { defaultChartPreferences } from "../contracts/backtestChart.ts";
import { createBacktestChartStore } from "../artifacts/api-server/src/services/backtestChartPreferences.ts";

const connectionString = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
assert.ok(connectionString, "Set LOCAL_DATABASE_URL to a local test database");
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname),
  "This probe only runs against localhost",
);
const schema = `chart_preferences_test_${Date.now()}`;
const admin = new pg.Pool({ connectionString });
const scoped = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await scoped.query(
    await readFile(
      new URL("../lib/db/drizzle/0049_backtest_chart_preferences.sql", import.meta.url),
      "utf8",
    ),
  );
  const store = createBacktestChartStore(drizzle(scoped, { schema: schemaTypes }));
  const preferences = defaultChartPreferences();
  assert.deepEqual(await store.read("a"), { revision: 0, preferences: null });
  const create = await Promise.all([
    store.write("a", { revision: 0, preferences }),
    store.write("a", { revision: 0, preferences }),
  ]);
  assert.equal(
    create.filter((result) => result.conflict).length,
    1,
    "creation races must be serialized even without an existing row",
  );
  const writes = await Promise.all([
    store.write("a", { revision: 1, preferences }),
    store.write("a", { revision: 1, preferences }),
  ]);
  assert.equal(writes.filter((result) => result.conflict).length, 1);
  assert.equal((await store.read("a")).revision, 2);
  assert.deepEqual(await store.read("b"), { revision: 0, preferences: null });
  preferences.settings.chartBgColor1 = "#abcdef";
  await store.write("b", { revision: 0, preferences });
  assert.notEqual(
    (await store.read("a")).preferences?.settings.chartBgColor1,
    (await store.read("b")).preferences?.settings.chartBgColor1,
  );
  console.log(
    "PostgreSQL chart preferences migration, user isolation and concurrent create/update CAS passed",
  );
} finally {
  await scoped.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
