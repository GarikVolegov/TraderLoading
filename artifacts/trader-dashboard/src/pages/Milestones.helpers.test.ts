import assert from "node:assert/strict";
import { parseSkills } from "./Milestones.helpers.js";

assert.deepEqual(parseSkills('["Risk management","Price action"]'), [
  "Risk management",
  "Price action",
]);
assert.deepEqual(parseSkills(null), []);
assert.deepEqual(parseSkills(undefined), []);
assert.deepEqual(parseSkills(""), []);
assert.deepEqual(parseSkills("not-json"), []);
assert.deepEqual(parseSkills('{"a":1}'), []);
assert.deepEqual(parseSkills('"just a string"'), []);
assert.deepEqual(parseSkills('["ok",42,null,"fine"]'), ["ok", "fine"]);

console.log("milestones parseSkills checks passed");
