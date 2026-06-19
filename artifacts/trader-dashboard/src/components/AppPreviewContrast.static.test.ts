import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("./ui/card.tsx", import.meta.url), "utf8");
const chartSource = readFileSync(new URL("./ui/chart.tsx", import.meta.url), "utf8");
const tooltipSource = readFileSync(new URL("./ui/tooltip.tsx", import.meta.url), "utf8");
const volatilitySource = readFileSync(new URL("./VolatilityWidget.tsx", import.meta.url), "utf8");
const cotSource = readFileSync(new URL("./CotWidget.tsx", import.meta.url), "utf8");

assert.match(cssSource, /\.widget-header \{\s+@apply [^;]*border-border\/45/s);
assert.match(cssSource, /\.widget-subtitle \{\s+@apply [^;]*text-muted-foreground\/80/s);
// .metric-card must remain grouped with .glass-inset AND that tier must keep --glass-alpha: 0.5 (the legibility floor).
// A regression that removes .metric-card from the glass-inset block, or pushes alpha toward 0, must FAIL this test.
assert.match(
  cssSource,
  /\.glass-inset,\s*\n\s*\.metric-card\s*\{[^}]*--glass-alpha:\s*0\.5/s,
  ".metric-card must be in the glass-inset tier grouped selector and that tier must set --glass-alpha: 0.5",
);
assert.match(cssSource, /\.metric-label \{\s+@apply [^;]*text-muted-foreground\/85/s);
assert.match(cssSource, /\.metric-unit \{\s+@apply [^;]*text-muted-foreground\/75/s);
assert.match(cssSource, /\.link-pill \{\s+@apply [^;]*text-muted-foreground\/80/s);
assert.match(cssSource, /\.dashboard-widget-shell :is\(\.bg-card\\\/60, \.bg-card\\\/80, \.bg-card\\\/40\) \{\s+background-color: hsl\(var\(--card\) \/ 0\.88\);/s);
assert.match(cssSource, /\.dashboard-widget-shell :is\(\.bg-secondary\\\/20, \.bg-secondary\\\/30, \.bg-secondary\\\/40\) \{\s+background-color: hsl\(var\(--secondary\) \/ 0\.55\);/s);
assert.match(cssSource, /\.dashboard-widget-shell :is\(\.border-border\\\/50, \.border-border\\\/40, \.border-border\\\/35, \.border-border\\\/30, \.border-border\\\/25, \.border-border\\\/20\) \{\s+border-color: hsl\(var\(--border\) \/ 0\.58\);/s);
assert.match(cssSource, /\.dashboard-widget-shell :is\(\.text-muted-foreground\\\/60, \.text-muted-foreground\\\/50, \.text-muted-foreground\\\/40\) \{\s+color: hsl\(var\(--muted-foreground\) \/ 0\.82\);/s);

assert.match(cardSource, /glass-panel/);

assert.match(chartSource, /stroke-border\/65/);
assert.match(chartSource, /stroke-border\/75/);
assert.match(chartSource, /fill-muted\/70/);
assert.match(chartSource, /bg-popover\/95/);
assert.match(chartSource, /text-popover-foreground/);
assert.doesNotMatch(chartSource, /bg-background px-2\.5/);

assert.match(tooltipSource, /glass-raised/);
assert.match(tooltipSource, /text-popover-foreground/);

for (const source of [volatilitySource, cotSource]) {
  assert.match(source, /background: "hsl\(var\(--popover\)\)"/);
  assert.match(source, /border: "1px solid hsl\(var\(--border\)\)"/);
  assert.match(source, /labelStyle=\{\{ color: "hsl\(var\(--popover-foreground\)\)"/);
  assert.match(source, /itemStyle=\{\{ color: "hsl\(var\(--popover-foreground\)\)"/);
}

assert.match(volatilitySource, /cursor=\{\{ fill: "hsl\(var\(--foreground\) \/ 0\.06\)"/);
assert.match(volatilitySource, /ReferenceLine y=\{data\.y1\} stroke="hsl\(var\(--muted-foreground\)\)"/);

console.log("app preview contrast static checks passed");
