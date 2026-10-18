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
  /sm:h-\[calc\(100dvh-var\(--safe-top\)-13rem-var\(--bottom-nav-clearance\)\)\]/,
  "Chat sm height reserves the header, title and visible local tabs while subtracting the notch",
);
assert.match(chat, /h-\[calc\(100dvh-var\(--safe-top\)-8\.8rem-var\(--bottom-nav-clearance\)\)\]/,
  "Chat mobile height reserves local tabs even when PageHeader is hidden");

// A 44px tab plus padding/border must fit below the header without taking space
// from the composer. Keep these budgets tied to the actual viewport formulas.
const tabHeight = 44 + 8 + 1;
const mobileTopBudget = 3.85 * 16 + 12 + tabHeight + 12;
const desktopTopBudget = 3.85 * 16 + 60 + 16 + tabHeight + 16;
assert.ok(8.8 * 16 >= mobileTopBudget);
assert.ok(13 * 16 >= desktopTopBudget);
for (const notch of [0, 47, 59]) {
  const height = 844 - notch - 8.8 * 16 - (76 + 34 + 16);
  assert.ok(height >= 240, "the mobile composer fits above the navigation safe area");
  assert.ok(notch + mobileTopBudget + height <= 844 - (76 + 34 + 16));
}

console.log("safe-area top static checks passed");
