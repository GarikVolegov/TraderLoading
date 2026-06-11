import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "CalendarWidget.tsx"), "utf8");

assert.doesNotMatch(source, /useGetMissions/);
assert.doesNotMatch(source, /Missioni di Oggi/);
assert.doesNotMatch(source, /missions\s*&&\s*missions\.length/);

console.log("calendar widget mission removal static checks passed");
