import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./wiki.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const brain = readFileSync(new URL("../services/knowledgeGraph.ts", import.meta.url), "utf8");

for (const endpoint of [
  'router.get("/wiki/sources"',
  'router.post("/wiki/sources/text"',
  'router.post("/wiki/sources/upload"',
  'router.post("/wiki/sources/url"',
  'router.delete("/wiki/sources/:id"',
  'router.get("/wiki/graph"',
  'router.get("/wiki/communities"',
  'router.post("/wiki/query"',
  'router.post("/wiki/reindex"',
]) {
  assert.match(route, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(route, /getUserId\(req\)/);
assert.match(route, /processWikiSourceJob/);
assert.match(route, /validateWikiUploadContent/);
assert.match(route, /const uploadError = validateWikiUploadContent[\s\S]*createWikiStorageFromEnv/);
assert.doesNotMatch(route, /Tipo file non supportato dalla wiki/);
assert.match(route, /router\.post\("\/wiki\/reindex"[\s\S]*db\.select\(\)\.from\(wikiSourcesTable\)/);
assert.match(route, /router\.post\("\/wiki\/reindex"[\s\S]*enqueueWikiSourceProcessing\(source\.id\)/);
assert.match(index, /wikiRouter/);
assert.match(brain, /buildWikiAnalysisContext/);

console.log("wiki routes static checks passed");
