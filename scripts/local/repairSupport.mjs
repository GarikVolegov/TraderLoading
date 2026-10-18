// Explicit, narrow repair for an existing local database. Never run on startup.
// Reuses migration 0013: adds only missing support tables/indexes, no row changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { loadEnvLocal } from "./lib/env.js";
import { checkTcp } from "./lib/health.js";
import { resolveDatabaseTarget } from "./startDatabase.js";

loadEnvLocal();
const raw = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
assert.ok(raw, "DATABASE_URL is required");
const target = resolveDatabaseTarget(raw, {
  localDefaultPortOccupied: await checkTcp("127.0.0.1", 5432),
  managedPort: Number(process.env.LOCAL_POSTGRES_PORT ?? "55432"),
});
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.host), "Local databases only");
const client = new pg.Client({ connectionString: target.url });
await client.connect();
try {
  const before = await client.query("SELECT to_regclass('public.support_tickets') AS tickets, to_regclass('public.support_ticket_messages') AS messages");
  console.log("Support schema:", before.rows[0]);
  if (process.argv.includes("--apply")) {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(readFileSync(new URL("../../lib/db/drizzle/0013_support_tickets.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
    console.log("Existing support DDL applied. No existing rows changed.");
  } else {
    console.log("Read-only check. Use --apply to restore the support tables/indexes.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
