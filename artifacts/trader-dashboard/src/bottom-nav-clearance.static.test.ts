import assert from "node:assert/strict";
import fs from "node:fs";

// Paths are relative to artifacts/trader-dashboard (the test runner's cwd).
const css = fs.readFileSync("src/index.css", "utf8");

// ── Task 1: token defined once, responsive ──────────────────────────────
assert.match(
  css,
  /--bottom-nav-band:\s*4\.75rem/,
  "index.css must define the bottom-nav band (64px pill + 12px gap = 76px)",
);
assert.match(
  css,
  /--bottom-nav-clearance:\s*calc\(var\(--bottom-nav-band\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*1rem\)/,
  "clearance must be band + safe-area + 1rem (= 92px mobile, matches old 5.75rem)",
);
assert.match(
  css,
  /--app-inset-left:\s*0px/,
  "app inset-left defaults to 0 on mobile",
);
assert.match(
  css,
  /@media\s*\(min-width:\s*1024px\)[\s\S]*--bottom-nav-clearance:\s*1\.5rem/,
  "lg override: clearance collapses to 1.5rem (old lg:pb-6) when nav is the sidebar",
);
assert.match(
  css,
  /@media\s*\(min-width:\s*1024px\)[\s\S]*--app-inset-left:\s*5rem/,
  "lg override: content shifts 5rem (80px) for the sidebar (old lg:pl-20)",
);
assert.match(
  css,
  /\.pb-bottom-nav\s*\{\s*padding-bottom:\s*var\(--bottom-nav-clearance\)/,
  "convenience utility .pb-bottom-nav must exist",
);
assert.match(
  css,
  /\.bottom-nav-safe\s*\{\s*bottom:\s*var\(--bottom-nav-clearance\)/,
  "convenience utility .bottom-nav-safe must exist (anchor fixed elements above the bar)",
);

console.log("bottom-nav clearance static checks passed");
