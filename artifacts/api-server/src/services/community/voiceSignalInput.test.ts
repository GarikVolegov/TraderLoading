import assert from "node:assert/strict";
import { voiceChannelId, voiceSignalInput } from "./voiceSignalInput.js";

assert.equal(voiceChannelId("2147483647"), 2147483647);
for (const id of [undefined, "0", "-1", "01", "1tail", "1.5", "1e2", "2147483648"]) assert.equal(voiceChannelId(id), null);
for (const type of ["offer", "answer", "ice", "media-state", "reaction"]) assert.equal(voiceSignalInput.parse({ to: "user_test", type }).data, "");
for (const value of [undefined, [], {}, { to: "u", type: "hangup" }, { to: ["u"], type: "offer" }, { to: " u", type: "offer" }, { to: "u", type: "offer", data: {} }, { to: "u", type: "ice", data: "x".repeat(131073) }]) {
  assert.equal(voiceSignalInput.safeParse(value).success, false);
}
assert.equal(voiceSignalInput.parse({ to: "u", type: "ice", data: "x".repeat(131072) }).data.length, 131072);
console.log("voiceSignalInput.test.ts: all assertions passed");
