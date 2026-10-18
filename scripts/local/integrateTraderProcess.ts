/** Explicit local integration. Startup never performs migrations. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp } from "./lib/health.js";
import { resolveDatabaseTarget } from "./startDatabase.js";

loadEnvLocal();
const pg = createRequire(import.meta.url)("pg");
const raw = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
assert.ok(raw, "Local database configuration is missing");
const target = resolveDatabaseTarget(raw, {
  localDefaultPortOccupied: await checkTcp("127.0.0.1", 5432),
  managedPort: Number(process.env.LOCAL_POSTGRES_PORT ?? "55432"),
});
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(target.host),
  "This operation supports local databases only",
);
const names = [
  "0036_market_intelligence",
  "0037_trader_process",
  "0038_backtest_economics",
  "0039_process_session_drafts",
  "0040_process_method_draft_revisions",
  "0041_process_quick_check",
  "0042_process_guidance_reviews",
  "0043_account_trade_environment",
];
const migrations = names.map((name) => {
  const sql = readFileSync(path.join(repoRoot, "lib/db/drizzle", name + ".sql"), "utf8");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    // The sole relaxation removes a constraint, never data or a column.
    if (statement === "ALTER TABLE process_methods ALTER COLUMN protocol DROP NOT NULL") continue;
    // Populate only the newly added classification of structurally identified replay evidence.
    if (/^UPDATE process_evidence SET execution_environment = 'simulation'\s+WHERE source = 'replay' AND backtest_trade_id IS NOT NULL AND execution_environment = 'unknown'$/.test(statement)) continue;
    assert.match(
      statement,
      /^(?:CREATE (?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS|ALTER TABLE \w+\s+ADD COLUMN IF NOT EXISTS)/i,
      "Integration must use additive DDL only",
    );
    assert.doesNotMatch(statement, /\b(?:DROP COLUMN|DROP CONSTRAINT|ALTER COLUMN|RENAME)\b/i);
  }
  return { name, sql, hash: createHash("sha256").update(sql).digest("hex") };
});
const expected: Record<string, string[]> = {
  process_methods: ["id", "user_id", "rules", "protocol", "active", "review_policy_started_at"],
  process_drafts: ["id", "revision", "step", "draft"],
  process_sessions: ["id", "draft", "revision", "rules_snapshot", "mode"],
  process_evidence: ["method_version_id", "account_trade_id", "backtest_trade_id", "execution_environment"],
  process_improvements: ["method_version_id", "recap_id"],
  process_advancements: ["checks_snapshot", "review"],
  process_reviews: ["id", "covered_periods", "request_snapshot", "decision", "reviewed_at"],
  account_trades: ["id", "execution_environment"],
  backtest_trades: ["initial_risk", "cost", "net_pnl", "net_r", "open_time", "close_time"],
  market_decisions: ["id", "user_id", "snapshot_id"],
};
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const client = new pg.Client({ connectionString: target.url });
await client.connect();
const readiness = async () => {
  const columns = await client.query(
    "SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema=$1",
    ["public"],
  );
  const missing = Object.entries(expected).flatMap(([table, names]) =>
    names
      .filter(
        (name) =>
          !(columns.rows as Array<{ table_name: string; column_name: string }>).some(
            (c) => c.table_name === table && c.column_name === name,
          ),
      )
      .map((name) => `${table}.${name}`),
  );
  if (
    !columns.rows.some(
      (c: { table_name: string; column_name: string; is_nullable: string }) =>
        c.table_name === "process_methods" &&
        c.column_name === "protocol" &&
        c.is_nullable === "YES",
    )
  )
    missing.push("process_methods.protocol nullable");
  return missing;
};
try {
  const missing = await readiness();
  console.log("Local process schema:", missing.length ? "requires integration" : "ready");
  console.log("Missing columns:", missing);
  if (!process.argv.includes("--apply")) {
    console.log("Read-only inspection. Applying requires --apply --backup <verified full dump>.");
    if (process.argv.includes("--require-ready") && missing.length > 0) process.exitCode = 1;
  } else {
    const backupArg = process.argv.indexOf("--backup");
    assert.ok(backupArg >= 0 && process.argv[backupArg + 1], "A full backup is required");
    const backup = path.resolve(process.argv[backupArg + 1]!);
    assert.ok(existsSync(backup), "Backup file is missing");
    const bin =
      process.env.AUDIT_PG_BIN ??
      path.join(homedir(), "Applications/Postgres.app/Contents/Versions/16/bin");
    const contents = execFileSync(path.join(bin, "pg_restore"), ["--list", backup], {
      encoding: "utf8",
    });
    const database = decodeURIComponent(new URL(target.url).pathname.slice(1));
    assert.ok(contents.includes(`dbname: ${database}`), "Backup must match the local database");
    assert.match(
      contents,
      /TABLE DATA public backtest_trades/,
      "Backup must include existing replay data",
    );
    const metadata = await client.query(
      "SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position",
      ["public"],
    );
    const tables = new Map<string, string[]>();
    for (const row of metadata.rows) {
      if (row.table_name.startsWith("candle")) continue;
      const columns = tables.get(row.table_name) ?? [];
      columns.push(row.column_name);
      tables.set(row.table_name, columns);
    }
    const fingerprints = async () => {
      const data: Record<string, unknown> = {};
      for (const [table, columns] of tables) {
        data[table] = (
          await client.query(
            `SELECT count(*)::text AS rows,md5(coalesce(string_agg(h,',' ORDER BY h),'')) AS checksum FROM (SELECT md5(to_jsonb(r)::text) AS h FROM (SELECT ${columns.map(identifier).join(",")} FROM public.${identifier(table)}) r) hashes`,
          )
        ).rows[0];
      }
      return data;
    };
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='60s'");
      await client.query("SELECT pg_advisory_xact_lock(2074012)");
      await client.query(
        `LOCK TABLE ${[...tables.keys()].map((t) => "public." + identifier(t)).join(",")} IN SHARE MODE`,
      );
      const before = await fingerprints();
      for (const migration of migrations) await client.query(migration.sql);
      assert.deepEqual(await readiness(), [], "All required columns must be present");
      const after = await fingerprints();
      assert.deepEqual(
        after,
        before,
        "Existing rows and their original columns must remain identical",
      );
      await client.query("COMMIT");
      const report = {
        completedAt: new Date().toISOString(),
        database,
        backup,
        migrations: migrations.map(({ name, hash }) => ({ name, hash })),
        preservedTables: tables.size,
        existingRowsUnchanged: true,
        candles: "untouched; excluded from fingerprint scan",
        migrationJournal: "unchanged; explicit local additive reconciliation",
      };
      const output = path.join(path.dirname(backup), "integration.json");
      writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
      chmodSync(output, 0o600);
      console.log(
        `Integration complete. ${tables.size} existing tables verified unchanged. Report: ${output}`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
