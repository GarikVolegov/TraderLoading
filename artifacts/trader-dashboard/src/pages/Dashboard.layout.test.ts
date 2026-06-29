import assert from "node:assert/strict";
import { columnsForWidth, distributeColumns } from "./Dashboard.layout";

// Breakpoints (kit dashboard-view.jsx): 3 ≥1080, 2 ≥680, else 1.
assert.equal(columnsForWidth(1280), 3);
assert.equal(columnsForWidth(1080), 3);
assert.equal(columnsForWidth(1079), 2);
assert.equal(columnsForWidth(680), 2);
assert.equal(columnsForWidth(679), 1);
assert.equal(columnsForWidth(320), 1);

// Round-robin distribution, gap-free reading order.
assert.deepEqual(distributeColumns(["a", "b", "c", "d", "e"], 3), [["a", "d"], ["b", "e"], ["c"]]);
assert.deepEqual(distributeColumns(["a", "b"], 3), [["a"], ["b"], []]);
assert.deepEqual(distributeColumns(["a", "b", "c"], 1), [["a", "b", "c"]]);
assert.deepEqual(distributeColumns([], 3), [[], [], []]);
// Guards cols < 1 → single column.
assert.deepEqual(distributeColumns(["a", "b"], 0), [["a", "b"]]);

console.log("Dashboard.layout checks passed");
