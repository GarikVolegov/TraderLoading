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
  /calc\(100dvh\s*-\s*var\(--safe-top\)\s*-\s*8\.5rem\s*-\s*var\(--bottom-nav-clearance\)\)/,
  "Chat scroll region height must subtract --safe-top and the clearance token",
);
assert.doesNotMatch(
  chat,
  /100dvh\s*-\s*180px/,
  "Chat must not keep the old fixed 180px viewport math",
);

// ── Task 4: CookieConsent sits above the bar, offset for the sidebar ─────
const cookie = fs.readFileSync("src/components/CookieConsentPopup.tsx", "utf8");
assert.match(
  cookie,
  /bottom-\[var\(--bottom-nav-clearance\)\]/,
  "CookieConsent must float above the mobile nav bar via the token",
);
assert.match(
  cookie,
  /lg:left-\[calc\(var\(--app-inset-left\)\+0\.75rem\)\]/,
  "CookieConsent must offset its left edge past the desktop sidebar",
);
assert.doesNotMatch(
  cookie,
  /\bbottom-3\b/,
  "CookieConsent must not keep the old bottom-3 that overlapped the nav",
);

// ── Task 5: no page re-pads the bottom on top of PageLayout's clearance ──
// Lock the severe offender; the broader rule ("PageLayout owns bottom
// clearance") is a documented convention, not a grep (pb-10/pb-4 values
// are too common elsewhere to assert globally without false positives).
const milestones = fs.readFileSync("src/pages/Milestones.tsx", "utf8");
assert.doesNotMatch(
  milestones,
  /pb-24/,
  "Milestones must not double the bottom clearance with pb-24",
);

// ── Task 6: forbid NEW magic-number bottom anchoring across the app ──────
// Full-screen overlays legitimately pin to bottom-0; the cookie popup and
// the nav itself are the sanctioned floating bars. Everything else must use
// the token rather than re-introducing fixed bottom-[n] / calc(100dvh-Npx).
const ALLOWLIST = new Set([
  "src/components/BottomNav.tsx",          // the nav itself
  "src/components/CookieConsentPopup.tsx", // sanctioned floating popup (token-based)
  "src/components/PairSelectionModal.tsx", // full-screen bottom sheet (overlay)
  "src/components/ui/sheet.tsx",           // overlay primitive
  "src/components/ui/drawer.tsx",          // overlay primitive
  "src/components/ui/toast.tsx",           // toast viewport
  "src/components/social/StoryViewer.tsx", // full-screen story overlay
]);

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(full, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

const tsxFiles: string[] = [];
walk("src/components", tsxFiles);
walk("src/pages", tsxFiles);

const fixedBottomMagic = /fixed[^"'`]*\bbottom-(?:0|3|5|\[(?!var\()[^\]]*\])/;
const dvhMagic = /calc\(100dvh\s*-\s*\d+px\)/;

for (const file of tsxFiles) {
  if (ALLOWLIST.has(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(
    src,
    fixedBottomMagic,
    `${file}: fixed element anchored to the bottom with a magic number — use bottom-[var(--bottom-nav-clearance)] / .bottom-nav-safe (or add to the overlay allowlist)`,
  );
  assert.doesNotMatch(
    src,
    dvhMagic,
    `${file}: raw "calc(100dvh - Npx)" — subtract var(--bottom-nav-clearance) instead`,
  );
}

console.log("bottom-nav clearance static checks passed");
