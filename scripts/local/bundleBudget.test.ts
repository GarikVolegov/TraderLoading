import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";

test("client initial bundle size satisfies performance SLO budget", () => {
  const assetsDir = new URL("../../artifacts/trader-dashboard/dist/public/assets/", import.meta.url);
  if (!existsSync(assetsDir)) {
    // Skip if dist assets haven't been built yet in a raw checkout
    return;
  }

  const files = readdirSync(assetsDir);
  const indexJsFiles = files.filter((f) => f.startsWith("index-") && f.endsWith(".js"));
  assert.ok(indexJsFiles.length > 0, "Expected at least one index JS file");

  // Find the primary entrypoint chunk (the largest index chunk)
  let maxIndexGzip = 0;
  let primaryIndexFile = "";
  for (const f of indexJsFiles) {
    const raw = readFileSync(new URL(f, assetsDir));
    const gzipSize = gzipSync(raw).length;
    if (gzipSize > maxIndexGzip) {
      maxIndexGzip = gzipSize;
      primaryIndexFile = f;
    }
  }

  // Budget: 235 kB gzip (240,640 bytes) — Initial baseline was 282 kB gzip
  const BUDGET_BYTES = 240_640;
  assert.ok(
    maxIndexGzip <= BUDGET_BYTES,
    `Primary chunk ${primaryIndexFile} gzip size (${(maxIndexGzip / 1024).toFixed(1)} kB) exceeds budget of ${(BUDGET_BYTES / 1024).toFixed(1)} kB`,
  );
});
