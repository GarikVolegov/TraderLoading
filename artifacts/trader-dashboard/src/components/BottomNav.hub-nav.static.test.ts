import assert from "node:assert/strict";
import fs from "node:fs";

const nav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

// The single hardcoded Community hub is replaced by the generic multi-hub
// registry — Journal and Zen become contextual hubs too, not just Community.
assert.match(nav, /import\s*\{\s*matchHub,\s*splitHubItems,\s*TORNEI_ITEM\s*\}\s*from\s*"@\/lib\/navHubs"/,
  "BottomNav must import the generic hub registry helpers from navHubs.ts");
assert.doesNotMatch(nav, /COMMUNITY_ROUTES\s*=/, "the old single-hub hardcode must be gone");
assert.doesNotMatch(nav, /const COMMUNITY_ITEMS/, "COMMUNITY_ITEMS is migrated into navHubs.ts");

// Root hubs still expose Archivio and the Community entry point.
assert.match(nav, /href:\s*"\/wiki",\s*icon:\s*Archive,\s*labelKey:\s*"nav\.wiki"/,
  "root bar must expose Archivio (/wiki)");
assert.match(nav, /href:\s*"\/chat",\s*icon:\s*Users,\s*labelKey:\s*"nav\.community",\s*isChat:\s*true/,
  "root bar must expose the Community hub (→/chat) carrying the unread badge");
assert.match(nav, /\{\s*href:\s*"\/backtest",\s*icon:\s*FlaskConical,\s*labelKey:\s*"nav\.backtest",\s*isChat:\s*false\s*\}/,
  "backtest item shape must be preserved");

// Mode is now resolved generically via matchHub(location), not one boolean.
assert.match(nav, /const activeHub\s*=\s*matchHub\(location\)/,
  "mode is derived from the generic hub registry");
assert.match(nav, /splitHubItems\(activeHub\.items\)/,
  "mobile pill must split an active hub's items into primary + overflow");
assert.match(nav, /ArrowLeft/, "hub mode still has a back-to-Home arrow");

// Overflow ("Più") sheet — only reachable when a hub has more than 5 sub-items.
assert.match(nav, /from\s*"@\/components\/ui\/sheet"/, "overflow uses the existing Sheet primitive");
assert.match(nav, /overflow\.length\s*>\s*0/, "overflow trigger only renders when there is overflow");
assert.match(nav, /t\("nav\.more"\)/, "overflow trigger/sheet title uses the nav.more i18n key");

// Desktop sidebar becomes hub-contextual too (previously always flat).
assert.match(nav, /activeHub\s*\?/, "desktop sidebar branches on the active hub");
assert.match(nav, /TORNEI_ITEM\.href/, "desktop root mode still surfaces the standalone Tornei shortcut");

// Landing on a bare hub route (e.g. /journal with no ?t=) must still highlight
// that hub's own default sub-item — not silently fall back to Community's
// "social" default, which would leave every Journal/Zen item unhighlighted.
assert.match(nav, /defaultTab\s*\?\?\s*"social"/,
  "NavItem's ?t= fallback must be parameterized per hub, not hardcoded to Community's default");
assert.match(nav, /defaultTab=\{activeHub\.items\[0\]\?\.tab\}/,
  "hub item rendering must pass the active hub's own first-item tab as the default");

// Preserve the liquid-glass mobile pill container + desktop sidebar.
assert.match(nav, /bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+0\.75rem\)\]/,
  "mobile pill must keep its safe-area float");
assert.match(nav, /rounded-full/, "mobile pill preserved");
assert.match(nav, /backdrop-blur-2xl/, "mobile pill blur preserved");
assert.match(nav, /lg:flex/, "desktop sidebar preserved");

console.log("bottom nav hub-nav static checks passed");
