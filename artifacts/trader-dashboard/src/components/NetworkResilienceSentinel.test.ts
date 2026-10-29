import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sentinelFile = path.join(__dirname, "NetworkResilienceSentinel.tsx");
const appFile = path.join(__dirname, "..", "App.tsx");

assert.ok(fs.existsSync(sentinelFile), "NetworkResilienceSentinel.tsx must exist");
assert.ok(fs.existsSync(appFile), "App.tsx must exist");

const sentinelSource = fs.readFileSync(sentinelFile, "utf8");
const appSource = fs.readFileSync(appFile, "utf8");

// Behavioral assertions:
assert.match(sentinelSource, /window\.addEventListener\("online"/, "Must listen to online events");
assert.match(sentinelSource, /window\.addEventListener\("offline"/, "Must listen to offline events");
assert.match(sentinelSource, /queryClient\.invalidateQueries/, "Must refetch stale queries when connection is restored");
assert.match(sentinelSource, /role="status"/, "Must have accessible role status");
assert.match(sentinelSource, /aria-live="polite"/, "Must have polite aria-live");
assert.match(sentinelSource, /Modalità Offline/, "Must display dignified offline status copy");
assert.match(sentinelSource, /Sincronizzazione Ripristinata/, "Must display reconnection confirmation copy");

// App.tsx mounting assertion:
assert.match(appSource, /import\s*\{\s*NetworkResilienceSentinel\s*\}\s*from/, "App.tsx must import NetworkResilienceSentinel");
assert.match(appSource, /<NetworkResilienceSentinel\s*\/>/, "App.tsx must mount NetworkResilienceSentinel globally");

console.log("NetworkResilienceSentinel static and mounting checks passed!");
