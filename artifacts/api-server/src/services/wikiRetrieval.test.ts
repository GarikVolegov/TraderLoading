import assert from "node:assert/strict";

// @workspace/db builds a pg Pool on import; give it a dummy URL (no connection
// is opened — these are pure-function tests).
process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
process.env.BRAIN_EMBED_PROVIDER ??= "off";

const { fuseRrf } = await import("./wikiGraph.js");
const { isValidEmbedding, embedTexts } = await import("./embeddingsClient.js");

// ─── Reciprocal Rank Fusion ─────────────────────────────────────────────────

// An item ranked high in BOTH lists must win over items strong in only one.
{
  const keyword = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const vector = [{ id: 3 }, { id: 1 }, { id: 4 }];
  const fused = fuseRrf(keyword, vector).map((x) => x.id);
  assert.equal(fused[0], 1, "id 1 (rank 1 + rank 2) beats id 3 (rank 3 + rank 1)");
  assert.equal(fused.length, 4, "union of both lists, deduplicated");
  assert.ok(fused.includes(4), "vector-only hit is still included");
}

// Single list behaves like identity ordering.
{
  const fused = fuseRrf([{ id: 7 }, { id: 8 }]).map((x) => x.id);
  assert.deepEqual(fused, [7, 8], "one list preserves its order");
}

// Empty inputs are safe.
assert.deepEqual(fuseRrf([], []), [], "no candidates → empty result");

// The first item kept per id wins (carries its payload through fusion).
{
  const keyword = [{ id: 5, text: "kw" }];
  const vector = [{ id: 5, text: "vec" }];
  const fused = fuseRrf(keyword, vector);
  assert.equal(fused.length, 1, "same id appears once");
  assert.equal(fused[0].text, "kw", "payload from the first list is retained");
}

// ─── Embedding dimension guard ──────────────────────────────────────────────

assert.equal(isValidEmbedding([1, 2, 3], 3), true, "matching length + numbers is valid");
assert.equal(isValidEmbedding([1, 2], 3), false, "wrong length is rejected");
assert.equal(isValidEmbedding([1, 2, "x"], 3), false, "non-numeric entry is rejected");
assert.equal(isValidEmbedding(null, 3), false, "null is rejected");
assert.equal(isValidEmbedding("[1,2,3]", 3), false, "string is rejected");

// ─── embedTexts graceful degradation (provider off) ─────────────────────────

{
  const out = await embedTexts(["a", "b", "c"]);
  assert.equal(out.length, 3, "result is aligned 1:1 with the input");
  assert.deepEqual(out, [null, null, null], "no provider → all nulls (keyword fallback)");
}
assert.deepEqual(await embedTexts([]), [], "empty input → empty output");
