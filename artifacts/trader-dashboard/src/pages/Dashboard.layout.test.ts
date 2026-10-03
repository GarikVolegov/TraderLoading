import assert from "node:assert/strict";
import {
  columnsForWidth,
  distributeColumns,
  visibleWidgetOrder,
  DESKTOP_HIDDEN_WIDGET_IDS,
} from "./Dashboard.layout";

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

// ── visibleWidgetOrder ────────────────────────────────────────────────────────
const ORDER = ["quote", "account", "journal"];

assert.ok(DESKTOP_HIDDEN_WIDGET_IDS.includes("quote"));

// Desktop drops "quote" everywhere — including edit mode (quote lives in the clock).
assert.deepEqual(
  visibleWidgetOrder(ORDER, {}, { isEditing: false, isDesktop: true }),
  ["account", "journal"],
);
assert.deepEqual(
  visibleWidgetOrder(ORDER, {}, { isEditing: true, isDesktop: true }),
  ["account", "journal"],
);

// Mobile/tablet keeps "quote" (the clock banner hides its inline quote there).
assert.deepEqual(
  visibleWidgetOrder(ORDER, {}, { isEditing: false, isDesktop: false }),
  ["quote", "account", "journal"],
);
assert.deepEqual(
  visibleWidgetOrder(ORDER, {}, { isEditing: true, isDesktop: false }),
  ["quote", "account", "journal"],
);

// The hidden filter still applies in normal mode, and is ignored (ghosts) in edit.
assert.deepEqual(
  visibleWidgetOrder(ORDER, { account: true }, { isEditing: false, isDesktop: false }),
  ["quote", "journal"],
);
assert.deepEqual(
  visibleWidgetOrder(ORDER, { account: true }, { isEditing: true, isDesktop: false }),
  ["quote", "account", "journal"],
);
assert.deepEqual(
  visibleWidgetOrder(ORDER, { account: true }, { isEditing: false, isDesktop: true }),
  ["journal"],
);
assert.deepEqual(
  visibleWidgetOrder(ORDER, { account: true }, { isEditing: true, isDesktop: true }),
  ["account", "journal"],
);

console.log("Dashboard.layout checks passed");
