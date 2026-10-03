import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/index.css", "utf8");
const topNav = fs.readFileSync("src/components/TopNav.tsx", "utf8");
const pageLayout = fs.readFileSync("src/components/PageLayout.tsx", "utf8");
const chat = fs.readFileSync("src/pages/Chat.tsx", "utf8");

// Token defined once, in :root.
assert.match(
  css,
  /--safe-top:\s*env\(safe-area-inset-top,\s*0px\)/,
  "index.css must define --safe-top from env(safe-area-inset-top)",
);

// TopNav pads its glass header down past the notch.
assert.match(
  topNav,
  /pt-\[var\(--safe-top\)\]/,
  "TopNav glass header must pad the top by the safe-area inset",
);

// PageLayout content clears the now-taller header.
assert.match(
  pageLayout,
  /pt-\[calc\(var\(--safe-top\)\+3\.85rem\)\]/,
  "PageLayout top padding must fold in --safe-top",
);
assert.match(
  pageLayout,
  /lg:pt-\[calc\(var\(--safe-top\)\+3\.65rem\)\]/,
  "PageLayout lg top padding must fold in --safe-top",
);

// Chat scroll region subtracts --safe-top so it never overflows under the header.
assert.match(
  chat,
  /calc\(100dvh-var\(--safe-top\)-8\.5rem-var\(--bottom-nav-clearance\)\)/,
  "Chat sm height must subtract --safe-top",
);

console.log("safe-area top static checks passed");
