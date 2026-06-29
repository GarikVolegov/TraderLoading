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

// ── Task 2: PageLayout is the single owner of clearance ─────────────────
const pageLayout = fs.readFileSync("src/components/PageLayout.tsx", "utf8");
assert.match(
  pageLayout,
  /pb-\[var\(--bottom-nav-clearance\)\]/,
  "PageLayout must pad the bottom with the clearance token",
);
assert.match(
  pageLayout,
  /pl-\[var\(--app-inset-left\)\]/,
  "PageLayout must offset left with the sidebar token",
);
assert.doesNotMatch(
  pageLayout,
  /5\.75rem|6rem|lg:pl-20|lg:pb-6/,
  "PageLayout must not keep the old magic-number clearance",
);

// ── Task 3: Chat height is token-based, not a raw dvh magic number ───────
const chat = fs.readFileSync("src/pages/Chat.tsx", "utf8");
assert.match(
  chat,
  /calc\(100dvh\s*-\s*8\.5rem\s*-\s*var\(--bottom-nav-clearance\)\)/,
  "Chat scroll region height must subtract the clearance token",
);
assert.doesNotMatch(
  chat,
  /100dvh\s*-\s*180px/,
  "Chat must not keep the old fixed 180px viewport math",
);

console.log("bottom-nav clearance static checks passed");
