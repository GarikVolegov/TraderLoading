import { test } from "node:test";
import assert from "node:assert/strict";
import { cumulativeR, mulberry32, quantile, monteCarloBands } from "./equityProjection";

test("cumulativeR builds a running sum anchored at start", () => {
  assert.deepEqual(cumulativeR([1, -0.5, 2]), [0, 1, 0.5, 2.5]);
  assert.deepEqual(cumulativeR([1, 1], 3), [3, 4, 5]);
  assert.deepEqual(cumulativeR([]), [0]);
});

test("mulberry32 is deterministic for a seed", () => {
  const a = mulberry32(123), b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test("quantile interpolates within a sorted array", () => {
  assert.equal(quantile([0, 10], 0.5), 5);
  assert.equal(quantile([0, 10, 20], 0), 0);
  assert.equal(quantile([0, 10, 20], 1), 20);
});

test("monteCarloBands returns ordered bands of the right length", () => {
  const b = monteCarloBands([1, -1, 2, 0.5], { steps: 10, start: 5, seed: 42 });
  assert.equal(b.p50.length, 11);
  assert.equal(b.p10[0], 5);
  assert.equal(b.p90[0], 5);
  for (let i = 0; i <= 10; i++) {
    assert.ok(b.p10[i] <= b.p50[i] + 1e-9, `p10<=p50 at ${i}`);
    assert.ok(b.p50[i] <= b.p90[i] + 1e-9, `p50<=p90 at ${i}`);
  }
});

test("monteCarloBands is deterministic for a seed", () => {
  const o = { steps: 8, start: 0, seed: 7 } as const;
  assert.deepEqual(monteCarloBands([1, -1, 0.5], o), monteCarloBands([1, -1, 0.5], o));
});

test("monteCarloBands tolerates an empty sample set", () => {
  const b = monteCarloBands([], { steps: 5, start: 2 });
  assert.deepEqual(b.p50, [2, 2, 2, 2, 2, 2]);
});
