import assert from "node:assert/strict";
import fs from "node:fs";

const nav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

// Root hubs include Archivio and a Community hub (→ /chat, with the unread badge).
assert.match(nav, /href:\s*"\/wiki",\s*icon:\s*Archive,\s*labelKey:\s*"nav\.wiki"/,
  "root bar must expose Archivio (/wiki)");
assert.match(nav, /href:\s*"\/chat",\s*icon:\s*Users,\s*labelKey:\s*"nav\.community",\s*isChat:\s*true/,
  "root bar must expose the Community hub (→/chat) carrying the unread badge");

// Backtest item keeps its exact shape (existing navigation-backtest contract).
assert.match(nav, /\{\s*href:\s*"\/backtest",\s*icon:\s*FlaskConical,\s*labelKey:\s*"nav\.backtest",\s*isChat:\s*false\s*\}/,
  "backtest item shape must be preserved");
assert.equal((nav.match(/href:\s*"\/backtest"/g) ?? []).length, 1,
  "/backtest must appear exactly once");

// Community mode set: the four /chat tabs (deep-linked) + Tornei.
assert.match(nav, /href:\s*"\/chat\?t=social"/, "community bar links Social");
assert.match(nav, /href:\s*"\/chat\?t=messaggi"/, "community bar links Chat");
assert.match(nav, /href:\s*"\/chat\?t=comunita",\s*[^}]*labelKey:\s*"chat\.tab\.community"/,
  "community bar links Comunità");
assert.match(nav, /href:\s*"\/chat\?t=classifica"/, "community bar links Classifica");
assert.match(nav, /href:\s*"\/tornei",\s*icon:\s*Award,\s*labelKey:\s*"tornei\.nav"/,
  "community bar + desktop must expose Tornei");

// Route-derived mode + a back affordance to Home.
assert.match(nav, /COMMUNITY_ROUTES\s*=\s*\[\s*"\/chat",\s*"\/tornei"\s*\]/,
  "mode is derived from the community route set");
assert.match(nav, /ArrowLeft/, "community mode has a back arrow");

// Preserve the liquid-glass mobile pill container + desktop sidebar.
assert.match(nav, /bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+0\.75rem\)\]/,
  "mobile pill must keep its safe-area float");
assert.match(nav, /rounded-full/, "mobile pill preserved");
assert.match(nav, /backdrop-blur-2xl/, "mobile pill blur preserved");
assert.match(nav, /lg:flex/, "desktop sidebar preserved");

console.log("bottom nav community-nav static checks passed");
