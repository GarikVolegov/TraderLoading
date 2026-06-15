import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("./wiki.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

// The wiki is a plain notes archive: folders + sources + ingest jobs only.
for (const table of ["wiki_folders", "wiki_sources", "wiki_ingest_jobs"]) {
  assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} should be declared`);
}

// The GraphRAG tables were dropped when the wiki became a plain archive.
for (const removed of [
  "wiki_chunks",
  "wiki_graph_nodes",
  "wiki_graph_edges",
  "wiki_communities",
  "wiki_saved_answers",
]) {
  assert.doesNotMatch(schema, new RegExp(`pgTable\\("${removed}"`), `${removed} should be gone`);
}

for (const indexName of [
  "wiki_folders_user_parent_idx",
  "wiki_sources_user_status_idx",
  "wiki_sources_user_folder_idx",
  "wiki_ingest_jobs_user_status_idx",
]) {
  assert.match(schema, new RegExp(`index\\("${indexName}"`), `${indexName} should exist`);
}

assert.match(index, /export \* from "\.\/wiki"/);

console.log("wiki schema static checks passed");
