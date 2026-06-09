import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync("src/pages/Settings.tsx", "utf8");

assert.match(settings, /WEEKDAY_OPTIONS/);
assert.match(settings, /Giorni chiusura/);
assert.match(settings, /handleClosedSessionDayToggle/);
assert.match(settings, /days: \[6, 0\]/);
assert.match(settings, /title: "Sabato"/);
assert.match(settings, /title: "Domenica"/);

console.log("settings market closed days static checks passed");
