import assert from "node:assert/strict";
const { parseTags, buildSourceUpdate } = await import("./wikiSourceUpdate.js");

// parseTags
assert.equal(parseTags(["a", "b"]), JSON.stringify(["a", "b"]));
assert.equal(parseTags("a, b ,, c"), JSON.stringify(["a", "b", "c"]));
assert.equal(parseTags(""), "[]");
assert.equal(parseTags(undefined), "[]");
assert.equal(parseTags([1, "x", ""]), JSON.stringify(["1", "x"]));

const NOW = new Date("2026-06-30T00:00:00.000Z");

// no updatable field -> 400
assert.deepEqual(buildSourceUpdate({}, true, NOW), {
  ok: false,
  status: 400,
  error: "nessun campo da aggiornare",
});

// tags only
assert.deepEqual(buildSourceUpdate({ tags: ["x"] }, true, NOW), {
  ok: true,
  patch: { updatedAt: NOW, tags: JSON.stringify(["x"]) },
});

// move to root (folderId null) needs no folder check
assert.deepEqual(buildSourceUpdate({ folderId: null }, false, NOW), {
  ok: true,
  patch: { updatedAt: NOW, folderId: null },
});

// folderId provided but invalid
assert.deepEqual(buildSourceUpdate({ folderId: 5 }, false, NOW), {
  ok: false,
  status: 400,
  error: "Cartella non trovata",
});

// folderId valid + tags together
assert.deepEqual(buildSourceUpdate({ folderId: 5, tags: "a,b" }, true, NOW), {
  ok: true,
  patch: { updatedAt: NOW, folderId: 5, tags: JSON.stringify(["a", "b"]) },
});

console.log("wikiSourceUpdate checks passed");
