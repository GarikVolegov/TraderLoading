import assert from "node:assert/strict";
import { getProcessNames, parseNetstatTcpOwners } from "./health.js";

const names = await getProcessNames([0, process.pid]);

assert.equal(names.has(0), false);
assert.equal(names.get(process.pid), process.platform === "win32" ? "node" : undefined);

const parsedOwners = parseNetstatTcpOwners(
  [
    "  TCP    127.0.0.1:5173    127.0.0.1:55213    TIME_WAIT       0",
    "  TCP    0.0.0.0:5173      0.0.0.0:0          LISTENING       1234",
    "  TCP    127.0.0.1:3001    127.0.0.1:55214    ESTABLISHED     4321",
  ].join("\n"),
  5173,
);

assert.deepEqual(parsedOwners, [{ protocol: "TCP", localAddress: "0.0.0.0:5173", pid: 1234 }]);

console.log("local health checks passed");
