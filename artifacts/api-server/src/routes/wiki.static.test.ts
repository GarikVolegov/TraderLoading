import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./wiki.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

// The wiki is a plain notes archive: sources + folders, no graph/community/query.
for (const endpoint of [
  'router.get("/wiki/sources"',
  'router.post("/wiki/sources/text"',
  'router.post("/wiki/sources/upload"',
  'router.post("/wiki/sources/url"',
  'router.delete("/wiki/sources/:id"',
  'router.get("/wiki/folders"',
  'router.post("/wiki/folders"',
]) {
  assert.match(route, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

// The GraphRAG endpoints were removed when the wiki became a plain archive.
for (const removed of [
  'router.get("/wiki/graph"',
  'router.get("/wiki/communities"',
  'router.post("/wiki/query"',
  'router.post("/wiki/reindex"',
]) {
  assert.doesNotMatch(route, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(route, /getUserId\(req\)/);
assert.match(route, /processWikiSourceJob/);
assert.match(route, /validateWikiUploadContent/);
assert.match(route, /const uploadError = validateWikiUploadContent[\s\S]*createWikiStorageFromEnv/);
assert.doesNotMatch(route, /Tipo file non supportato dalla wiki/);
assert.match(index, /wikiRouter/);

console.log("wiki routes static checks passed");
