import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSchema(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const profileSource = readSchema("./profile.ts");
assert.match(profileSource, /index\("profile_user_idx"\)\.on\(table\.userId\)/);

const extrasSource = readSchema("./extras.ts");
assert.match(extrasSource, /uniqueIndex\("user_settings_user_idx"\)\.on\(t\.userId\)/);
assert.match(extrasSource, /index\("push_subscriptions_user_idx"\)\.on\(t\.userId\)/);
assert.match(extrasSource, /index\("login_access_user_created_idx"\)\.on\(t\.userId, t\.createdAt\)/);

const missionsSource = readSchema("./missions.ts");
assert.match(missionsSource, /index\("missions_user_date_completed_idx"\)\.on\(table\.userId, table\.missionDate, table\.completed\)/);
assert.match(missionsSource, /index\("mission_templates_user_idx"\)\.on\(table\.userId\)/);

const journalSource = readSchema("./journal.ts");
assert.match(journalSource, /index\("journal_entries_user_created_idx"\)\.on\(table\.userId, table\.createdAt\)/);
assert.match(journalSource, /index\("journal_images_entry_idx"\)\.on\(table\.entryId\)/);

const brainSource = readSchema("./brain.ts");
assert.match(brainSource, /index\("brain_scan_config_enabled_last_run_idx"\)\.on\(table\.enabled, table\.lastRunAt\)/);
assert.match(brainSource, /index\("brain_graph_nodes_user_strategy_label_idx"\)\.on\(table\.userId, table\.strategyId, table\.label\)/);
assert.match(brainSource, /index\("brain_graph_edges_user_strategy_from_idx"\)\.on\(table\.userId, table\.strategyId, table\.fromNodeId\)/);

const signalsSource = readSchema("./signals.ts");
assert.match(signalsSource, /index\("signals_created_idx"\)\.on\(t\.createdAt\)/);

console.log("database scalability index checks passed");
