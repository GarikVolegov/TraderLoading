import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSwipeGesture, useEdgeSwipe } from "./useEdgeSwipe";

test("useEdgeSwipe and resolveSwipeGesture are exported functions", () => {
  assert.equal(typeof useEdgeSwipe, "function");
  assert.equal(typeof resolveSwipeGesture, "function");
});

test("resolveSwipeGesture identifies swipe left accurately", () => {
  const result = resolveSwipeGesture({
    startX: 300,
    startY: 200,
    endX: 220,
    endY: 210, // dx = -80, dy = +10, |dx| > 44, |-80| > |10| * 1.25
  });

  assert.equal(result, "left");
});

test("resolveSwipeGesture identifies swipe right accurately", () => {
  const result = resolveSwipeGesture({
    startX: 50,
    startY: 200,
    endX: 150,
    endY: 205, // dx = +100, dy = +5, |dx| > 44, |100| > |5| * 1.25
  });

  assert.equal(result, "right");
});

test("resolveSwipeGesture ignores small movements below minDistance", () => {
  const result = resolveSwipeGesture({
    startX: 100,
    startY: 200,
    endX: 130, // dx = +30 (below default minDistance 44)
    endY: 200,
  });

  assert.equal(result, null);
});

test("resolveSwipeGesture ignores vertical-dominant scroll gestures", () => {
  const result = resolveSwipeGesture({
    startX: 200,
    startY: 100,
    endX: 140, // dx = -60
    endY: 300, // dy = +200 (|dx| = 60 is NOT > |200| * 1.25)
  });

  assert.equal(result, null, "Should reject diagonal/vertical gestures during page scroll");
});
