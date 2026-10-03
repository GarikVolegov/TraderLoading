import fs from "node:fs";
import assert from "node:assert/strict";

// RecapTab is ported onto the Claude Design system primitives (Card/StatTile),
// matching the Panoramica. It must no longer render the old bespoke stat/panel
// styling (a local `StatCard` + hand-rolled `rounded-2xl bg-card/60` panels).
const src = fs.readFileSync("src/pages/Journal.tsx", "utf8");

// The DS metric tile replaces the local StatCard component.
assert.match(src, /import\s*\{\s*StatTile\s*\}\s*from\s*"@\/components\/ui\/StatTile"/,
  "Journal must import the DS StatTile");
assert.doesNotMatch(src, /function StatCard\b/,
  "the local StatCard component must be removed (use DS StatTile)");

// The bespoke RecapTab panels (border-border/50 variant) are re-containered as
// DS Card/CardHeader/CardContent — none of that exact class string should remain.
assert.doesNotMatch(src, /rounded-2xl bg-card\/60 backdrop-blur-sm border border-border\/50/,
  "RecapTab bespoke panels must be replaced by DS Card");

console.log("journal recap-ds static checks passed");
