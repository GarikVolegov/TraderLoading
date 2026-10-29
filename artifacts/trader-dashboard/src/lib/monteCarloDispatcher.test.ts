import assert from "node:assert/strict";
import { computeMonteCarloBandsAsync } from "./monteCarloDispatcher.js";
import { monteCarloBands } from "./equityProjection.js";

const samples = [1.5, -1.0, 2.0, -0.5, 3.0, -1.2];
const opts = { steps: 20, start: 0, seed: 12345 };

const directResult = monteCarloBands(samples, opts);
const asyncResult = await computeMonteCarloBandsAsync(samples, opts);

assert.equal(asyncResult.p50.length, directResult.p50.length);
assert.deepEqual(asyncResult.p50, directResult.p50);
assert.deepEqual(asyncResult.p10, directResult.p10);
assert.deepEqual(asyncResult.p90, directResult.p90);

console.log("Monte Carlo async worker dispatcher tests passed successfully!");
