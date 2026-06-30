import assert from "node:assert/strict";
import {
  archiveTypeOf,
  parseTags,
  collectionsFromFolders,
  collectionAccent,
  tagCloud,
  filterSources,
  type WikiSource,
  type ArchiveFolder,
} from "./archive.ts";

// kind -> archive type mapping
assert.equal(archiveTypeOf("image"), "image");
assert.equal(archiveTypeOf("office"), "pdf");
assert.equal(archiveTypeOf("url"), "link");
assert.equal(archiveTypeOf("text"), "note");
assert.equal(archiveTypeOf("unknown"), "note");

// parseTags is defensive over the JSON string column
assert.deepEqual(parseTags('["a","b"]'), ["a", "b"]);
assert.deepEqual(parseTags("not json"), []);
assert.deepEqual(parseTags("[1,2]"), ["1", "2"]);

function src(p: Partial<WikiSource>): WikiSource {
  return {
    id: 1, kind: "text", title: "t", status: "ready", error: null, fileUrl: null,
    fileName: null, mimeType: null, folderId: null, extractedText: "", tags: "[]",
    originalUrl: null, fileSize: 0, createdAt: "2026-06-30T00:00:00Z", ...p,
  };
}

const folders: ArchiveFolder[] = [
  { id: 10, name: "Setup", parentId: null, color: null, position: 0 },
  { id: 11, name: "Strategie", parentId: null, color: "#ff0000", position: 1 },
];
const sources: WikiSource[] = [
  src({ id: 1, folderId: 10, tags: '["a","b"]' }),
  src({ id: 2, folderId: 10, tags: '["a"]' }),
  src({ id: 3, folderId: null, tags: "[]" }),
];

const colls = collectionsFromFolders(folders, sources);
assert.equal(colls.length, 2);
assert.equal(colls[0].id, 10);
assert.equal(colls[0].count, 2);
assert.equal(colls[1].count, 0);
// explicit color wins; missing color -> deterministic palette entry
assert.equal(colls[1].accent, "#ff0000");
assert.equal(collectionAccent({ id: 10, color: null }).startsWith("hsl"), true);

// tag cloud sorted by frequency then alpha
const cloud = tagCloud(sources);
assert.deepEqual(cloud, [{ tag: "a", count: 2 }, { tag: "b", count: 1 }]);

// filtering: type
assert.deepEqual(
  filterSources(sources, { search: "", type: "note", collection: "all", tag: null }).map((s) => s.id),
  [1, 2, 3],
);
// filtering: collection root (unfiled)
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: "root", tag: null }).map((s) => s.id),
  [3],
);
// filtering: collection by folder id
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: 10, tag: null }).map((s) => s.id),
  [1, 2],
);
// filtering: tag
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: "all", tag: "b" }).map((s) => s.id),
  [1],
);
// filtering: search over title + extractedText + tags
assert.deepEqual(
  filterSources([src({ id: 9, title: "EURUSD breakout", tags: '["fx"]' })],
    { search: "breakout", type: "all", collection: "all", tag: null }).map((s) => s.id),
  [9],
);

console.log("archive lib checks passed");
