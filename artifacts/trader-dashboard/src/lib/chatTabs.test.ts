import assert from "node:assert/strict";
import { parseChatTab } from "./chatTabs";

assert.equal(parseChatTab(""), "social", "empty search defaults to social");
assert.equal(parseChatTab("?t=social"), "social");
assert.equal(parseChatTab("?t=messaggi"), "messaggi");
assert.equal(parseChatTab("?t=comunita"), "comunita");
assert.equal(parseChatTab("?t=classifica"), "classifica");
assert.equal(parseChatTab("t=classifica"), "classifica", "leading ? optional");
assert.equal(parseChatTab("?t=bogus"), "social", "unknown value falls back to social");
assert.equal(parseChatTab("?foo=1"), "social", "missing t falls back to social");

console.log("chatTabs unit checks passed");
