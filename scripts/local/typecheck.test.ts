import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./typecheck.ts", import.meta.url), "utf8");

assert.match(
  source,
  /"pnpm",\s*\[\s*"-r",\s*"--workspace-concurrency",\s*"1",\s*"--filter",\s*"\.\/artifacts\/\*\*"/s,
  "artifact and script typechecks should run sequentially to avoid parallel tsc aborts",
);

console.log("typecheck orchestration checks passed");
