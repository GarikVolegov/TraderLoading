import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tabs = readFileSync(new URL("./tabs.tsx", import.meta.url), "utf8");
const skeleton = readFileSync(new URL("./skeleton.tsx", import.meta.url), "utf8");

assert.match(tabs, /data-\[state=active\]/, "Tabs must style the active state");
assert.match(tabs, /glass-inset|bg-surface|bg-secondary/, "Tabs track must use a glass/neutral surface");
assert.match(skeleton, /animate-shimmer/, "Skeleton must use animate-shimmer");

console.log("primitive D static checks passed");
