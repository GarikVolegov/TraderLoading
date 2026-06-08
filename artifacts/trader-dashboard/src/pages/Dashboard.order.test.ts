import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(source, /tl_dashboard_order_command_center_v1/);
assert.doesNotMatch(source, /tl_dashboard_order_command_center_v2/);
assert.match(source, /columns-1 sm:columns-2 xl:columns-3/);
assert.match(source, /mb-4 break-inside-avoid/);
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"clock",\s*"quote",\s*"account",\s*"missions",\s*"routine",\s*"checklist",\s*"journal",\s*"sentiment",\s*"volatility",\s*"cot",\s*"calendar",\s*\];/s,
);

console.log("dashboard order checks passed");
