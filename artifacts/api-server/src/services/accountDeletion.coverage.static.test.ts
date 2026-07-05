import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// GDPR erasure guard: every table that stores a row per user (a direct
// text("user_id") column) MUST be covered by deleteLocalAccountData, otherwise
// personal data survives account deletion. This test reads the schema at run
// time so a newly-added user table that nobody wired into deletion fails the
// build instead of silently leaking.

const schemaDir = fileURLToPath(new URL("../../../../lib/db/src/schema/", import.meta.url));
const deletionSrc = readFileSync(new URL("./accountDeletion.ts", import.meta.url), "utf8");

// Extract every pgTable("<sql_name>", { ... }) block that declares a
// text("user_id") column.
function userTablesFromSchema(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(schemaDir)) {
    if (!file.endsWith(".ts") || file === "index.ts" || file.includes(".test.")) continue;
    const src = readFileSync(new URL(file, new URL("../../../../lib/db/src/schema/", import.meta.url)), "utf8");
    const re = /pgTable\(\s*["']([a-z_]+)["']([\s\S]*?)(?=export const|\n\}\s*\)\s*;\s*\nexport|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const [, name, body] = m;
      if (/text\(["']user_id["']\)/.test(body)) found.add(name);
    }
  }
  return [...found].sort();
}

const userTables = userTablesFromSchema();

// Sanity: the extractor must find a healthy set, not silently zero out (which
// would make the coverage assertion vacuously pass).
assert.ok(userTables.length >= 40, `expected >=40 user tables, got ${userTables.length}`);

const missing = userTables.filter(
  (t) => !new RegExp(`(DELETE FROM|UPDATE)\\s+${t}\\b`).test(deletionSrc),
);
assert.deepEqual(
  missing,
  [],
  `Tables with a user_id column not covered by deleteLocalAccountData: ${missing.join(", ")}`,
);

// Personal-data tables that link to the user INDIRECTLY (no user_id column) and
// so are invisible to the check above must still be handled explicitly.
for (const table of [
  "community_review_reports", // reporter_user_id / review_id
  "support_ticket_messages", // author_id / ticket_id
  "admin_audit_logs", // actor_user_id (PII scrubbed)
  "sessions", // legacy jsonb session store
  "chat_file_access", // owner_user_id / peer_user_id
]) {
  assert.match(
    deletionSrc,
    new RegExp(`(DELETE FROM|UPDATE)\\s+${table}\\b`),
    `deleteLocalAccountData must handle ${table}`,
  );
}

console.log("account deletion coverage checks passed");
