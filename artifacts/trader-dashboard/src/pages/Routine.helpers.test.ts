import assert from "node:assert/strict";
import { getRoutineStartProgram } from "./Routine.helpers.js";

assert.equal(getRoutineStartProgram("/routine?start=morning"), "morning");
assert.equal(getRoutineStartProgram("/routine?start=evening"), "evening");
assert.equal(getRoutineStartProgram("?start=morning"), "morning");
assert.equal(getRoutineStartProgram("/routine?start=invalid"), null);
assert.equal(getRoutineStartProgram("/routine"), null);
assert.equal(getRoutineStartProgram(""), null);

console.log("routine page deep-link checks passed");
