import assert from "node:assert/strict";
import { parseZenTab } from "./zenTabs";

assert.equal(parseZenTab(""), "breathing", "empty search defaults to breathing");
assert.equal(parseZenTab("?t=breathing"), "breathing");
assert.equal(parseZenTab("?t=visualization"), "visualization");
assert.equal(parseZenTab("?t=quotes"), "quotes");
assert.equal(parseZenTab("?t=gratitude"), "gratitude");
assert.equal(parseZenTab("?t=meditation"), "meditation");
assert.equal(parseZenTab("?t=insight"), "insight");
assert.equal(parseZenTab("t=meditation"), "meditation", "leading ? optional");
assert.equal(parseZenTab("?t=bogus"), "breathing", "unknown value falls back to breathing");
assert.equal(parseZenTab("?foo=1"), "breathing", "missing t falls back to breathing");

console.log("zenTabs unit checks passed");
