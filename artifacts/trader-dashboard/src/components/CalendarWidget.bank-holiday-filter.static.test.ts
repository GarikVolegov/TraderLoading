import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "CalendarWidget.tsx"), "utf8");

assert.match(source, /Holiday:\s*\{[^}]*color:\s*"bg-white"/s);
assert.match(source, /Holiday:\s*\{[^}]*border:\s*"border-white\/40"/s);
assert.match(source, /Holiday:\s*\{[^}]*text:\s*"text-white"/s);
assert.match(source, /Holiday:\s*\{[^}]*label:\s*"Festivo"/s);
assert.doesNotMatch(source, /filter\([^)]*Holiday/);

console.log("calendar widget bank holiday filter static checks passed");
