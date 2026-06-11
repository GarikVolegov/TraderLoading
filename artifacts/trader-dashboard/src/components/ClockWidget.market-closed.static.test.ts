import assert from "node:assert/strict";
import fs from "node:fs";

const clockWidget = fs.readFileSync("src/components/ClockWidget.tsx", "utf8");

assert.match(clockWidget, /isSessionEnabledForDate/);
assert.match(clockWidget, /activeClosedSession\s*\?\s*"Chiuso"/);
assert.match(clockWidget, /isWeekend\s*\?\s*"Chiuso"/);
assert.doesNotMatch(clockWidget, /activeClosedSession\.name/);

console.log("clock widget market closed static checks passed");
