import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("./wiki.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

for (const table of [
  "wiki_sources",
  "wiki_chunks",
  "wiki_graph_nodes",
  "wiki_graph_edges",
  "wiki_communities",
  "wiki_ingest_jobs",
  "wiki_saved_answers",
]) {
  assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} should be declared`);
}

for (const indexName of [
  "wiki_sources_user_status_idx",
  "wiki_chunks_source_idx",
  "wiki_graph_nodes_user_label_idx",
  "wiki_graph_edges_user_from_idx",
  "wiki_communities_user_idx",
  "wiki_ingest_jobs_user_status_idx",
  "wiki_saved_answers_user_idx",
]) {
  assert.match(schema, new RegExp(`index\\("${indexName}"`), `${indexName} should exist`);
}

assert.match(schema, /confidence.*EXTRACTED.*INFERRED.*AMBIGUOUS/s);
assert.match(index, /export \* from "\.\/wiki"/);

console.log("wiki schema static checks passed");
