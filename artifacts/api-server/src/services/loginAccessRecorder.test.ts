import assert from "node:assert/strict";
import { createLoginAccessRecorder } from "./loginAccessRecorder.js";

let now = 0, reads = 0, writes = 0, failRead = true, failWrite = false;
const record = createLoginAccessRecorder({
  now: () => now,
  async findRecent() { reads++; if (failRead) throw new Error("Synthetic read failure"); return false; },
  async insert() { writes++; if (failWrite) throw new Error("Synthetic insert failure"); await new Promise(resolve => setTimeout(resolve, 5)); },
});
await assert.rejects(record("a", "loopback", undefined), /read failure/);
failRead = false; failWrite = true;
await assert.rejects(record("a", "loopback", undefined), /insert failure/);
failWrite = false;
await Promise.all(Array.from({ length: 12 }, () => record("a", "loopback", "Synthetic agent")));
assert.equal(reads, 3); assert.equal(writes, 2); // failed insert + one successful recovery
await record("a", "loopback", undefined); assert.equal(reads, 3, "Confirmed cache also works when clock starts at zero");
await record("b", "loopback", undefined); await record("a", "other-ip", undefined);
assert.equal(writes, 4, "Distinct account and IP must not suppress each other");
now = 3_600_000; await record("a", "loopback", undefined); assert.equal(writes, 5);
let inserts = 0;
const persisted = createLoginAccessRecorder({ async findRecent() { return true; }, async insert() { inserts++; } });
await persisted("existing", "loopback", undefined); assert.equal(inserts, 0, "A database record survives API cache restart without a duplicate");
console.log("Login logging failure recovery, concurrent deduplication, scope and TTL checks passed");
