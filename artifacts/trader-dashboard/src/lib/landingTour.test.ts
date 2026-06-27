import assert from "node:assert/strict";
import {
  TOUR_SCENE_COUNT,
  initialTourState,
  tourReducer,
  type TourState,
} from "./landingTour.js";

const last = TOUR_SCENE_COUNT - 1;

// initial state
assert.deepEqual(initialTourState, { index: 0, status: "playing" });

// tick advances while playing
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "tick" }), {
  index: 1,
  status: "playing",
});

// tick past the last scene ends the tour (index clamped to last)
assert.deepEqual(tourReducer({ index: last, status: "playing" }, { type: "tick" }), {
  index: last,
  status: "ended",
});

// tick while paused is a no-op
const paused: TourState = { index: 1, status: "paused" };
assert.deepEqual(tourReducer(paused, { type: "tick" }), paused);

// next from middle advances and forces playing
assert.deepEqual(tourReducer({ index: 1, status: "paused" }, { type: "next" }), {
  index: 2,
  status: "playing",
});

// next from last scene ends; next from ended stays ended
assert.deepEqual(tourReducer({ index: last, status: "playing" }, { type: "next" }), {
  index: last,
  status: "ended",
});
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "next" }), {
  index: last,
  status: "ended",
});

// prev decrements (playing); clamped at 0
assert.deepEqual(tourReducer({ index: 2, status: "paused" }, { type: "prev" }), {
  index: 1,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "prev" }), {
  index: 0,
  status: "playing",
});

// prev from ended re-enters the tour at the last scene, playing
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "prev" }), {
  index: last,
  status: "playing",
});

// pause only from playing
assert.deepEqual(tourReducer({ index: 1, status: "playing" }, { type: "pause" }), {
  index: 1,
  status: "paused",
});
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "pause" }), {
  index: last,
  status: "ended",
});

// resume only from paused
assert.deepEqual(tourReducer({ index: 1, status: "paused" }, { type: "resume" }), {
  index: 1,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 1, status: "playing" }, { type: "resume" }), {
  index: 1,
  status: "playing",
});

// replay resets from any state, including ended
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "replay" }), {
  index: 0,
  status: "playing",
});

// goto clamps and sets playing
assert.deepEqual(tourReducer({ index: 0, status: "ended" }, { type: "goto", index: 2 }), {
  index: 2,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "goto", index: 99 }), {
  index: last,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 2, status: "playing" }, { type: "goto", index: -5 }), {
  index: 0,
  status: "playing",
});

console.log("landingTour: all assertions passed");
