import assert from "node:assert/strict";
import { TOUR_SCENE_COUNT, initialTourState, isTourComplete, tourReducer } from "./landingTour";

assert.equal(TOUR_SCENE_COUNT, 4);
assert.equal(initialTourState.started, false);
assert.equal(isTourComplete(initialTourState), false);
const initialSnapshot = JSON.stringify(initialTourState);
const started = tourReducer(initialTourState, { type: "start" });
assert.equal(started.index, 0);
assert.equal(started.started, true);
assert.equal(isTourComplete(started), false);

// Skipping straight to review isn't a completed demonstration.
const skipped = tourReducer(started, { type: "goto", index: 3 });
assert.deepEqual(skipped.visited, [0, 3]);
assert.equal(isTourComplete(skipped), false);
let state = tourReducer(skipped, { type: "goto", index: 1 });
state = tourReducer(state, { type: "next" });
assert.equal(state.index, 2);
assert.equal(isTourComplete(state), true);
// Revisiting a step does not inflate the completion count.
state = tourReducer(state, { type: "prev" });
assert.deepEqual(state.visited, [0, 3, 1, 2]);
assert.equal(isTourComplete(state), true);

// Bounds, invalid indices, and replay are safe; transitions do not mutate input.
assert.equal(tourReducer(state, { type: "goto", index: 99 }).index, 3);
assert.equal(tourReducer(state, { type: "goto", index: -9 }).index, 0);
assert.equal(tourReducer(state, { type: "goto", index: 1.8 }).index, 1);
assert.strictEqual(tourReducer(state, { type: "goto", index: NaN }), state);
assert.strictEqual(tourReducer(state, { type: "goto", index: Infinity }), state);
assert.equal(tourReducer(initialTourState, { type: "prev" }).index, 0);
const replayed = tourReducer(state, { type: "replay" });
assert.deepEqual(replayed, { index: 0, visited: [0], started: true });
assert.equal(isTourComplete(replayed), false);
assert.equal(JSON.stringify(initialTourState), initialSnapshot);
console.log("Manual landing process transitions passed");
