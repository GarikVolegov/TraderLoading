import assert from "node:assert/strict";
import fs from "node:fs";

const nav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

// /clock, /library and /news had no persistent mobile nav entry (only reachable
// via the desktop-only Cmd+K palette) — a root-level "More" overflow closes the
// gap without disturbing the existing 6-item root pill.
assert.match(
  nav,
  /const ROOT_OVERFLOW_ITEMS = \[\s*\{ href: "\/library", icon: Library,\s*labelKey: "nav\.library" \},\s*\{ href: "\/clock",\s*icon: Clock,\s*labelKey: "nav\.clock"\s*\},\s*\{ href: "\/news",\s*icon: Newspaper, labelKey: "nav\.news"\s*\},\s*\] as const;/,
  "root overflow must list Library, Clock and News",
);
// Settings already has its own shortcut via the TopNav avatar on mobile —
// it must not be duplicated into the new overflow list.
const rootOverflowBlock = nav.slice(
  nav.indexOf("const ROOT_OVERFLOW_ITEMS"),
  nav.indexOf("as const;", nav.indexOf("const ROOT_OVERFLOW_ITEMS")),
);
assert.doesNotMatch(rootOverflowBlock, /nav\.settings/, "Settings must not be duplicated in the root overflow");

// The root (non-hub) mobile pill must render its own "More" trigger.
assert.match(
  nav,
  /\{ROOT_ITEMS\.map\(\(item\) => \(\s*<NavItem[\s\S]*?\)\)\}\s*\{\/\* Mobile has no persistent sidebar/,
  "the More trigger must render right after the 6 root items",
);

// The overflow sheet must render root items when there is no active hub, and
// stay open even outside a hub (since ROOT_OVERFLOW_ITEMS is never empty).
assert.match(
  nav,
  /\{\(!activeHub \|\| overflow\.length > 0\) && \(/,
  "the overflow sheet must also open at the root level, not just inside a hub",
);
assert.match(
  nav,
  /\{\(activeHub \? overflow : ROOT_OVERFLOW_ITEMS\)\.map\(\(item\) => \(/,
  "the overflow sheet must list ROOT_OVERFLOW_ITEMS outside a hub",
);

// Desktop sidebar gets the same 3 pages for parity (previously only Library
// was in SECONDARY_ITEMS; Clock/News were desktop-only-reachable via Cmd+K).
assert.match(
  nav,
  /const SECONDARY_ITEMS = \[\s*\{ href: "\/library",\s*icon: Library,\s*labelKey: "nav\.library"\s*\},\s*\{ href: "\/clock",\s*icon: Clock,\s*labelKey: "nav\.clock"\s*\},\s*\{ href: "\/news",\s*icon: Newspaper,\s*labelKey: "nav\.news"\s*\},\s*\{ href: "\/settings", icon: Settings,\s*labelKey: "nav\.settings" \},\s*\] as const;/,
  "desktop secondary group must include Library, Clock, News and Settings",
);

console.log("bottom nav root overflow static checks passed");
