import assert from "node:assert/strict";
import {
  createMemoryCacheStore,
  getJsonCache,
  setJsonCache,
  delJsonCache,
  closeAppCache,
} from "./cache.js";

// Test basic memory get/set/del
let currentTime = 1000;
const fakeClock = () => currentTime;
const store = createMemoryCacheStore(fakeClock, 3);

await store.set("k1", "v1", 10); // expires at 11_000
assert.equal(await store.get("k1"), "v1");

// Test expiration
currentTime = 12_000;
assert.equal(await store.get("k1"), null);

// Test deletion
currentTime = 15_000;
await store.set("k2", "v2", 100);
assert.equal(await store.get("k2"), "v2");
await store.del("k2");
assert.equal(await store.get("k2"), null);

// Test LRU maxEntries eviction
currentTime = 20_000;
await store.set("a", "1", 100);
await store.set("b", "2", 100);
await store.set("c", "3", 100);
assert.equal(await store.get("a"), "1");
assert.equal(await store.get("b"), "2");
assert.equal(await store.get("c"), "3");

// Adding a 4th entry exceeds maxEntries (3) -> oldest entry 'a' should be evicted
await store.set("d", "4", 100);
assert.equal(await store.get("a"), null);
assert.equal(await store.get("b"), "2");
assert.equal(await store.get("c"), "3");
assert.equal(await store.get("d"), "4");

// Test JSON cache helpers
const jsonStore = createMemoryCacheStore(() => 1000);
await setJsonCache("obj", { name: "Aureus", value: 42 }, 60, jsonStore);
const retrieved = await getJsonCache<{ name: string; value: number }>("obj", jsonStore);
assert.deepEqual(retrieved, { name: "Aureus", value: 42 });

await delJsonCache("obj", jsonStore);
assert.equal(await getJsonCache("obj", jsonStore), null);

await closeAppCache();

console.log("cache store unit tests passed");
