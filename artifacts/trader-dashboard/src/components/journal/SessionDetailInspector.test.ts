import assert from "node:assert/strict";
import { VIRTU_TAGS, LEAK_TAGS, AVAILABLE_TAGS } from "./SessionDetailInspector";

// 1. Tag partitioning checks
assert.equal(VIRTU_TAGS.length, 3, "VIRTU_TAGS must contain exactly 3 virtuous tags");
assert.equal(LEAK_TAGS.length, 5, "LEAK_TAGS must contain exactly 5 leak tags");
assert.equal(AVAILABLE_TAGS.length, 8, "AVAILABLE_TAGS must aggregate all 8 tags");

assert.deepEqual(
  VIRTU_TAGS.map((t) => t.id),
  ["piano", "pazienza", "target"]
);

assert.deepEqual(
  LEAK_TAGS.map((t) => t.id),
  ["fomo", "anticipazione", "uscita_prematura", "revenge", "esitazione"]
);

console.log("SessionDetailInspector functional unit tests passed!");
