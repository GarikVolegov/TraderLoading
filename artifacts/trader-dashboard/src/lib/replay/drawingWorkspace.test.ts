import assert from "node:assert/strict";
import { computeFixedRangeVolumeProfile, DrawingHistory, moveDrawing, resizeDrawing } from "./drawingWorkspace";
import type { ReplayDrawing } from "./types";

const a = { time: 100, price: 10 };
const b = { time: 200, price: 20 };
const target = { time: 300, price: 30 };
const twoPoint = ["trend", "ray", "arrow", "rect", "fib", "ruler", "frvp"] as const;
for (const kind of twoPoint) {
  const original = { id: kind, kind, a, b, color: "#123456", width: 2 } as ReplayDrawing;
  const moved = moveDrawing(original, 60, 5);
  assert.ok("a" in moved && "b" in moved);
  assert.deepEqual(moved.a, { time: 160, price: 15 });
  assert.deepEqual(moved.b, { time: 260, price: 25 });
  assert.deepEqual(original, { id: kind, kind, a, b, color: "#123456", width: 2 }, "operations never mutate persisted drawings");
  const resized = resizeDrawing(original, "a", target);
  assert.ok("a" in resized && "b" in resized);
  assert.deepEqual(resized.a, target);
  assert.deepEqual(resized.b, b);
  const locked = { ...original, locked: true };
  assert.equal(moveDrawing(locked, 60, 5), locked);
  assert.equal(resizeDrawing(locked, "b", target), locked);
}
const rect: ReplayDrawing = { id: "rect", kind: "rect", a, b, color: "#fff", width: 1 };
const corner = resizeDrawing(rect, "ab", target);
assert.ok("a" in corner && "b" in corner);
assert.deepEqual(corner.a, { time: 300, price: 10 });
assert.deepEqual(corner.b, { time: 200, price: 30 });
const opposite = resizeDrawing(rect, "ba", target);
assert.ok("a" in opposite && "b" in opposite);
assert.deepEqual(opposite.a, { time: 100, price: 30 });
assert.deepEqual(opposite.b, { time: 300, price: 20 });
for (const direction of ["buy", "sell"] as const) {
  const position: ReplayDrawing = { id: direction, kind: "position", direction, entry: a, slPrice: 8, tpPrice: 15 };
  assert.deepEqual(resizeDrawing(position, "entry", target), { ...position, entry: target });
  assert.deepEqual(resizeDrawing(position, "sl", target), { ...position, slPrice: 30 });
  assert.deepEqual(resizeDrawing(position, "tp", target), { ...position, tpPrice: 30 });
  assert.deepEqual(moveDrawing(position, 60, 2), { ...position, entry: { time: 160, price: 12 }, slPrice: 10, tpPrice: 17 });
}
const singles: ReplayDrawing[] = [
  { id: "h", kind: "hline", price: 10, color: "#fff", width: 1 },
  { id: "v", kind: "vline", time: 100, color: "#fff", width: 1 },
  { id: "t", kind: "text", at: a, text: "Example", color: "#fff" },
];
assert.deepEqual(resizeDrawing(singles[0], "anchor", target), { ...singles[0], price: 30 });
assert.deepEqual(resizeDrawing(singles[1], "anchor", target), { ...singles[1], time: 300 });
assert.deepEqual(resizeDrawing(singles[2], "anchor", target), { ...singles[2], at: target });
const hray: ReplayDrawing = { id: "hray", kind: "hray", at: a, color: "#fff", width: 2 };
assert.deepEqual(moveDrawing(hray, 50, 3), { ...hray, at: { time: 150, price: 13 } });
assert.deepEqual(resizeDrawing(hray, "anchor", target), { ...hray, at: target });
const arrowUp: ReplayDrawing = { id: "up", kind: "arrowUp", at: a, color: "#089981", width: 2, text: "BOS" };
assert.deepEqual(moveDrawing(arrowUp, 10, 2), { ...arrowUp, at: { time: 110, price: 12 } });
const pathDrawing: ReplayDrawing = { id: "p", kind: "path", points: [a, b], color: "#fff", width: 2 };
assert.deepEqual(moveDrawing(pathDrawing, 10, 5), { ...pathDrawing, points: [{ time: 110, price: 15 }, { time: 210, price: 25 }] });
assert.deepEqual(resizeDrawing(pathDrawing, "p-1", target), { ...pathDrawing, points: [a, target] });
const posEnd: ReplayDrawing = { id: "pe", kind: "position", direction: "buy", entry: a, slPrice: 8, tpPrice: 15, endTime: 250 };
assert.deepEqual(moveDrawing(posEnd, 40, 1), { ...posEnd, entry: { time: 140, price: 11 }, slPrice: 9, tpPrice: 16, endTime: 290 });
assert.deepEqual(resizeDrawing(posEnd, "end", target), { ...posEnd, endTime: 300 });
const profile = computeFixedRangeVolumeProfile(
  [
    { time: 100, open: 10, high: 14, low: 9, close: 13, volume: 120 },
    { time: 160, open: 13, high: 16, low: 11, close: 11.5, volume: 80 },
    { time: 220, open: 11.5, high: 20, low: 11, close: 19, volume: 500 },
  ],
  100,
  200,
  12,
);
assert.ok(profile, "FRVP computes profile for candles in [tMin, tMax]");
assert.equal(profile.buckets.length, 12);
assert.ok(profile.pocPrice >= 9 && profile.pocPrice <= 16);
assert.ok(profile.valPrice <= profile.pocPrice && profile.vahPrice >= profile.pocPrice);
const history = new DrawingHistory();
const before = [rect];
// Intermediate pointer moves are deliberately not recorded.
let after = before;
for (let step = 1; step <= 30; step++) after = [moveDrawing(rect, step, step)];
history.record(before, after);
assert.equal(history.canUndo, true);
assert.deepEqual(history.undo(after), before, "a full gesture undoes in one action");
assert.equal(history.canUndo, false);
assert.deepEqual(history.redo(before), after);
history.record(after, []);
assert.deepEqual(history.undo([]), after, "external clear-all is reversible");
history.record(after, [{ ...rect, hidden: true, locked: true }]);
assert.equal(history.canRedo, false, "a new edit discards the old redo branch");
const bounded = new DrawingHistory();
for (let i = 0; i < 150; i++) bounded.record([{ ...rect, width: i }], [{ ...rect, width: i + 1 }]);
let current: ReplayDrawing[] = [{ ...rect, width: 150 }];
for (let i = 0; i < 100; i++) current = bounded.undo(current);
assert.equal(bounded.canUndo, false);
assert.equal("width" in current[0] && current[0].width, 50, "history retains at most 100 actions");
console.log("drawing workspace geometry/history checks passed");
