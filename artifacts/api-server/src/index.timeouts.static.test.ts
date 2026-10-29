import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

assert.match(indexSource, /server\.keepAliveTimeout\s*=\s*65_000/);
assert.match(indexSource, /server\.headersTimeout\s*=\s*66_000/);
assert.match(indexSource, /server\.requestTimeout\s*=\s*30_000/);
assert.match(indexSource, /closeAppCache\(\)/);

console.log("server timeouts and graceful shutdown static checks passed");
