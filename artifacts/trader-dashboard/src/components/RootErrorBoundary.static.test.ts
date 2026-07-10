import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/components/RootErrorBoundary.tsx",
  "utf8",
);

assert.match(
  source,
  /data-root-error-boundary/,
  "RootErrorBoundary fallback must carry a data-root-error-boundary marker so prerender validation can detect a crashed render",
);

console.log("RootErrorBoundary marker static check passed");
