import assert from "node:assert/strict";
import { summarizeRatings } from "./publicStats.js";

// Empty → null (so the UI hides the row, never fabricates a score).
assert.equal(summarizeRatings([]), null);

// Average rounded to 1 decimal + exact count.
assert.deepEqual(summarizeRatings([5, 4, 5]), { average: 4.7, count: 3 });
assert.deepEqual(summarizeRatings([5, 5, 5, 5]), { average: 5, count: 4 });
assert.deepEqual(summarizeRatings([4, 3]), { average: 3.5, count: 2 });

console.log("publicStats summarizeRatings checks passed");
