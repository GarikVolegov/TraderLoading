import assert from "node:assert/strict";
import fs from "node:fs";

const bottomNav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

assert.match(
  bottomNav,
  /bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+0\.75rem\)\]/,
  "mobile nav should float above the safe area",
);
assert.match(
  bottomNav,
  /rounded-full/,
  "mobile nav shell should be a rounded pill",
);
assert.match(
  bottomNav,
  /backdrop-blur-2xl/,
  "mobile nav shell should keep a strong frosted glass blur",
);
assert.doesNotMatch(
  bottomNav,
  /bg-card\/95 backdrop-blur-2xl border-t border-border\/50/,
  "mobile nav should not use the old full-width top-border bar",
);
assert.doesNotMatch(
  bottomNav,
  /h-\[env\(safe-area-inset-bottom,0px\)\]/,
  "floating nav should not need a separate safe-area spacer",
);
assert.doesNotMatch(
  bottomNav,
  /layoutId="nav-indicator-mobile"[\s\S]{0,320}h-0\.5/,
  "mobile active state should not be the old top hairline indicator",
);
assert.match(
  bottomNav,
  /lg:flex/,
  "desktop sidebar navigation should remain available",
);

console.log("bottom nav liquid glass static checks passed");
