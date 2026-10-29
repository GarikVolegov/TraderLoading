import assert from "node:assert/strict";
import fs from "node:fs";
const nav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");
assert.match(nav, /ROOT_ITEMS, rootDestination/);
assert.match(nav, /ROOT_ITEMS\.map/);
assert.match(nav, /renderItems\(false\)/);
assert.match(nav, /renderItems\(true\)/);
assert.doesNotMatch(nav, /activeHub|TORNEI_ITEM|splitHubItems|flashLabel/);
assert.match(nav, /aria-current=/);
assert.match(nav, /t\(item\.labelKey\)/);
assert.match(nav, /rootDestination\(location, search\)/);
assert.match(nav, /min-h-14/);
assert.doesNotMatch(nav, /useGetUnreadCount|href="\/milestones"/);

// ── Guardrail: Collapsed Sidebar Flyout Sub-Sections Selectability ────────
assert.match(
  nav,
  /openCollapsedFlyout[\s\S]*cancelCloseCollapsedFlyout[\s\S]*scheduleCloseCollapsedFlyout/,
  "collapsed sidebar flyouts must use a grace timer so diagonal cursor movement toward sub-items never drops pointer-events",
);
assert.match(
  nav,
  /fixed left-\[3\.6rem\] z-\[70\] hidden pl-3\.5/,
  "collapsed sidebar flyouts must include a continuous hover-bridge (left-[3.6rem] + pl-3.5) with zero dead-zone gap",
);
assert.doesNotMatch(
  nav,
  /fixed left-\[4\.5rem\]/,
  "collapsed sidebar flyouts must not use left-[4.5rem] which creates a 10px dead-zone gap",
);
assert.doesNotMatch(
  nav,
  /title=\{t\(item\.labelKey\)\}|title=\{t\("nav\.settings"\)\}/,
  "collapsed sidebar links must not set native title attributes that overlap the custom AUREUS flyout",
);
assert.match(
  nav,
  /aria-label=\{t\(item\.labelKey\)\}/,
  "collapsed sidebar links must expose aria-label for accessibility without native browser tooltips",
);

console.log("stable global navigation static checks passed");
