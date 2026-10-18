import assert from "node:assert/strict";
import { parseProcessDateTime, processDateTimeInput } from "./processDateTime";
assert.equal(parseProcessDateTime("2026-10-11T14:30"), "2026-10-11T12:30:00.000Z");
assert.equal(parseProcessDateTime("2026-01-11T14:30:25"), "2026-01-11T13:30:25.000Z");
assert.equal(processDateTimeInput(new Date("2026-10-10T22:30:00Z")), "2026-10-11T00:30");
assert.throws(() => parseProcessDateTime("2026-03-29T02:30"));
assert.throws(() => parseProcessDateTime("2026-10-25T02:30"));
assert.throws(() => parseProcessDateTime("2026-02-31T10:00"));
console.log("process datetime: Rome midnight, UTC-independent parsing and DST validation passed");
