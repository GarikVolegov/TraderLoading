# PWA safe-area + contextual Community navbar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the installed-PWA notch cutoff and add a two-level, contextual mobile bottom bar (Archivio as a direct hub; a Community hub grouping the `/chat` tabs + Tornei), plus Tornei on the desktop sidebar.

**Architecture:** Pure client-side change in `artifacts/trader-dashboard`. A single `--safe-top` CSS token wires the top safe-area into TopNav + PageLayout + Chat. The bottom bar becomes a route-derived two-mode component (root vs community). `/chat`'s active tab moves from local state to a URL query (`?t=`) so the always-mounted bar can deep-link into it.

**Tech Stack:** React 19, wouter 3.3.5 (`useLocation`, `useRoute`, `useSearch`, `Link`), framer-motion, Tailwind 4, lucide-react. Tests are Node `assert` static/unit tests run by the workspace test runner.

## Global Constraints

- **pnpm only.** Run commands from repo root or `artifacts/trader-dashboard`. Toolchain may need PATH export: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`.
- **`@typescript-eslint/no-explicit-any` = error** in non-test source. TS strict on. Tests may use `any`.
- **i18n enforced:** every new user-facing string uses `t()` with a key present in **all 5** language blocks (it/en/es/fr/de) of `src/lib/i18n.ts`. Never pass a literal to a `title`/label prop. Forbidden mojibake chars in any DICT value: `Ã` `â` `Â` `ð` (lowercase `à`/`é` are fine).
- **Do not hand-edit generated files** (`lib/api-client-react`, `lib/api-zod`). No contract change here.
- **Don't `prettier --write` files** — HEAD isn't prettier-clean.
- **Preserve existing static-test contracts** (see each task). The mobile bar container classes, the exact backtest item shape, and the desktop avatar→`/settings` section must survive the refactor.
- **Semantic commits with scope**, e.g. `fix(pwa):`, `feat(nav):`, `refactor(chat):`, `test:`.
- Test runner: from `artifacts/trader-dashboard`, run a single static/unit test with `pnpm exec tsx <path>` (they self-execute via `node:assert` + `console.log`), or the whole suite with `pnpm test`. Confirm the exact single-file command in Task 1 Step 2 and reuse it.

---

### Task 1: PWA top safe-area (`--safe-top`) across TopNav, PageLayout, Chat

Fixes the notch cutoff. One cohesive unit: define the token once and consume it in the three surfaces that anchor to the top / full viewport height.

**Files:**
- Create: `artifacts/trader-dashboard/src/safe-area-top.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/index.css` (`:root`, ~line 152-160)
- Modify: `artifacts/trader-dashboard/src/components/TopNav.tsx:29` (glass wrapper div)
- Modify: `artifacts/trader-dashboard/src/components/PageLayout.tsx:56` (content top padding)
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx:92` (section height calc)
- Modify: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (Chat regex → include `--safe-top`)

**Interfaces:**
- Produces: CSS var `--safe-top: env(safe-area-inset-top, 0px)` in `:root`, consumed as `var(--safe-top)` by later CSS/classNames.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/safe-area-top.static.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm it fails**

From `artifacts/trader-dashboard`:

Run: `pnpm exec tsx src/safe-area-top.static.test.ts`
Expected: FAIL — first assertion throws (`--safe-top` not defined in index.css).

(If `pnpm exec tsx <file>` is not available, use `pnpm test` and locate this file's failure. Note the working command and reuse it in later tasks.)

- [ ] **Step 3: Define the token in `index.css`**

In `src/index.css`, inside the first `:root { … }` block, next to `--app-inset-left: 0px;` (~line 160), add:

```css
  /* iOS notch / status-bar top inset (0px everywhere except installed notched PWAs) */
  --safe-top: env(safe-area-inset-top, 0px);
```

- [ ] **Step 4: Pad the TopNav header below the notch**

In `src/components/TopNav.tsx`, the glass wrapper at line 29 currently is:

```tsx
      <div className="bg-background/80 backdrop-blur-2xl border-b border-border/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)]">
```

Change it to add `pt-[var(--safe-top)]` so the frosted background fills the notch strip while the `h-14` content row drops below it:

```tsx
      <div className="bg-background/80 backdrop-blur-2xl border-b border-border/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)] pt-[var(--safe-top)]">
```

- [ ] **Step 5: Fold `--safe-top` into PageLayout top padding**

In `src/components/PageLayout.tsx` line 56, the content wrapper className currently contains `pt-[3.85rem]` and `lg:pt-[3.65rem]`. Replace those two tokens:

- `pt-[3.85rem]` → `pt-[calc(var(--safe-top)+3.85rem)]`
- `lg:pt-[3.65rem]` → `lg:pt-[calc(var(--safe-top)+3.65rem)]`

Resulting className (line 54-56):

```tsx
        className={`relative z-10 ${
          fullWidth ? "w-full" : "mx-auto max-w-[1760px]"
        } space-y-3 px-3 pt-[calc(var(--safe-top)+3.85rem)] sm:space-y-4 sm:px-5 lg:px-5 lg:pt-[calc(var(--safe-top)+3.65rem)] xl:px-7`}
```

- [ ] **Step 6: Subtract `--safe-top` in the Chat height calc**

In `src/pages/Chat.tsx` line 92, the section className height is:

```
h-[calc(100dvh-4.6rem-var(--bottom-nav-clearance))] sm:h-[calc(100dvh-8.5rem-var(--bottom-nav-clearance))]
```

Insert `-var(--safe-top)` immediately after `100dvh` in both calcs (keep `8.5rem-var(--bottom-nav-clearance)` contiguous for the sibling static test):

```
h-[calc(100dvh-var(--safe-top)-4.6rem-var(--bottom-nav-clearance))] sm:h-[calc(100dvh-var(--safe-top)-8.5rem-var(--bottom-nav-clearance))]
```

- [ ] **Step 7: Update the sibling clearance test's Chat regex**

In `src/bottom-nav-clearance.static.test.ts`, the "Task 3" assertion matches the old Chat calc. Replace:

```ts
assert.match(
  chat,
  /calc\(100dvh\s*-\s*8\.5rem\s*-\s*var\(--bottom-nav-clearance\)\)/,
  "Chat scroll region height must subtract the clearance token",
);
```

with (now also asserting the safe-top subtraction):

```ts
assert.match(
  chat,
  /calc\(100dvh\s*-\s*var\(--safe-top\)\s*-\s*8\.5rem\s*-\s*var\(--bottom-nav-clearance\)\)/,
  "Chat scroll region height must subtract --safe-top and the clearance token",
);
```

- [ ] **Step 8: Run both tests to confirm they pass**

Run: `pnpm exec tsx src/safe-area-top.static.test.ts`
Expected: PASS — `safe-area top static checks passed`.

Run: `pnpm exec tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS — `bottom-nav clearance static checks passed`.

- [ ] **Step 9: Commit**

```bash
git commit -m "fix(pwa): clear the iOS notch with a --safe-top inset

TopNav pads below the status bar, PageLayout + Chat account for it.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- \
  artifacts/trader-dashboard/src/index.css \
  artifacts/trader-dashboard/src/components/TopNav.tsx \
  artifacts/trader-dashboard/src/components/PageLayout.tsx \
  artifacts/trader-dashboard/src/pages/Chat.tsx \
  artifacts/trader-dashboard/src/safe-area-top.static.test.ts \
  artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
```

(Pathspec commit — shared working tree; never `git add -A`.)

---

### Task 2: i18n keys `nav.community` + `chat.tab.community` (× 5 languages)

Adds the two new copy keys the navbar needs. Uses the existing `i18n.parity.static` test as the red/green driver (parity fails if a key is missing from any language).

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts` (5 language blocks: `it`@26, `en`@730, `es`@1306, `fr`@1882, `de`@2458 — near the existing `nav.*` keys)

**Interfaces:**
- Produces: DICT keys `"nav.community"` and `"chat.tab.community"` resolvable via `t()` in all 5 languages.

- [ ] **Step 1: Add both keys to ONLY the `it` block**

In `src/lib/i18n.ts`, in the `it:` block near `"nav.wiki": "Archivio",` (~line 243), add:

```ts
    "nav.community": "Community",
    "chat.tab.community": "Comunità",
```

- [ ] **Step 2: Run the parity test to confirm it fails**

From `artifacts/trader-dashboard`:

Run: `pnpm exec tsx src/lib/i18n.parity.static.test.ts`
Expected: FAIL — the two keys exist in `it` but are missing from `en`/`es`/`fr`/`de`.

- [ ] **Step 3: Add both keys to the other four blocks**

Add the matching pair near each block's `nav.wiki` entry:

`en:` (~line 838)
```ts
    "nav.community": "Community",
    "chat.tab.community": "Community",
```

`es:` (~line 1414)
```ts
    "nav.community": "Comunidad",
    "chat.tab.community": "Comunidad",
```

`fr:` (near `nav.wiki` in the `fr` block)
```ts
    "nav.community": "Communauté",
    "chat.tab.community": "Communauté",
```

`de:` (near `nav.wiki` in the `de` block)
```ts
    "nav.community": "Community",
    "chat.tab.community": "Gemeinschaft",
```

- [ ] **Step 4: Run the parity test to confirm it passes**

Run: `pnpm exec tsx src/lib/i18n.parity.static.test.ts`
Expected: PASS. (This file also enforces the mojibake guard; the new values use only `à`/`é`, which are allowed.)

- [ ] **Step 5: Commit**

```bash
git commit -m "i18n(nav): add nav.community + chat.tab.community in 5 languages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- \
  artifacts/trader-dashboard/src/lib/i18n.ts
```

---

### Task 3: URL-addressable `/chat` tabs (`?t=`)

Moves the `/chat` active tab from `useState` to the URL so the always-mounted bottom bar can deep-link into Social/Chat/Comunità/Classifica. Extracts a pure `parseChatTab` for a real unit test.

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/chatTabs.ts`
- Create: `artifacts/trader-dashboard/src/lib/chatTabs.test.ts`
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx:1-34, 98` (imports, tab state → URL, tab click handler)

**Interfaces:**
- Produces: `export type ChatTab = "social" | "messaggi" | "comunita" | "classifica";` and `export function parseChatTab(search: string): ChatTab;` (defaults to `"social"` for absent/invalid values). Consumed by Chat.tsx now and referenced by BottomNav's tab set in Task 4 (via the `?t=` values).

- [ ] **Step 1: Write the failing unit test**

Create `artifacts/trader-dashboard/src/lib/chatTabs.test.ts`:

```ts
import assert from "node:assert/strict";
import { parseChatTab } from "./chatTabs";

assert.equal(parseChatTab(""), "social", "empty search defaults to social");
assert.equal(parseChatTab("?t=social"), "social");
assert.equal(parseChatTab("?t=messaggi"), "messaggi");
assert.equal(parseChatTab("?t=comunita"), "comunita");
assert.equal(parseChatTab("?t=classifica"), "classifica");
assert.equal(parseChatTab("t=classifica"), "classifica", "leading ? optional");
assert.equal(parseChatTab("?t=bogus"), "social", "unknown value falls back to social");
assert.equal(parseChatTab("?foo=1"), "social", "missing t falls back to social");

console.log("chatTabs unit checks passed");
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm exec tsx src/lib/chatTabs.test.ts`
Expected: FAIL — cannot find module `./chatTabs`.

- [ ] **Step 3: Implement `parseChatTab`**

Create `artifacts/trader-dashboard/src/lib/chatTabs.ts`:

```ts
export type ChatTab = "social" | "messaggi" | "comunita" | "classifica";

const CHAT_TABS: readonly ChatTab[] = ["social", "messaggi", "comunita", "classifica"];

/** Reads the active `/chat` tab from a location search string (`?t=…`). */
export function parseChatTab(search: string): ChatTab {
  const value = new URLSearchParams(search).get("t");
  return CHAT_TABS.includes(value as ChatTab) ? (value as ChatTab) : "social";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm exec tsx src/lib/chatTabs.test.ts`
Expected: PASS — `chatTabs unit checks passed`.

- [ ] **Step 5: Wire Chat.tsx to the URL**

In `src/pages/Chat.tsx`:

1. Add imports. **Keep line 1 unchanged** — `import { useState, useEffect, type ReactNode } from "react";` (`useState` is still used by `pendingChat`). Add after line 5:

```tsx
import { useLocation, useSearch } from "wouter";
import { parseChatTab, type ChatTab } from "@/lib/chatTabs";
```

Also remove the now-unused local `type Tab` declaration (line 17) — `ChatTab` (imported above) replaces it everywhere.

2. Replace the state block (lines 22-34):

```tsx
  const [activeTab, setActiveTab] = useState<Tab>("social");
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

  const handleStartChat = (u: SocialUser) => {
    setActiveTab("messaggi");
    setPendingChat(u);
  };

  useEffect(() => {
    if (activeTab === "messaggi" && pendingChat) {
      setPendingChat(null);
    }
  }, [activeTab]);
```

with:

```tsx
  const [, navigate] = useLocation();
  const activeTab: ChatTab = parseChatTab(useSearch());
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

  const setActiveTab = (tab: ChatTab) => navigate(`/chat?t=${tab}`);

  const handleStartChat = (u: SocialUser) => {
    setPendingChat(u);
    navigate("/chat?t=messaggi");
  };

  useEffect(() => {
    if (activeTab === "messaggi" && pendingChat) {
      setPendingChat(null);
    }
  }, [activeTab, pendingChat]);
```

Keep `import { useState } from "react"` on line 1 (still used by `pendingChat`). Update the `tabs` array type annotation `id: Tab` → `id: ChatTab` (line 66) and the hardcoded Comunità label (line 77) to `t("chat.tab.community")`:

```tsx
    { id: "comunita", label: t("chat.tab.community"), icon: <Radio className="w-4 h-4" /> },
```

The existing `onClick={() => setActiveTab(tab.id)}` (line 98) now navigates via the URL — no further change.

- [ ] **Step 6: Typecheck + unit test**

Run (from repo root): `pnpm typecheck`
Expected: PASS (no unused-import or type errors in Chat.tsx).

Run: `pnpm exec tsx src/lib/chatTabs.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(chat): drive the /chat tab from ?t= so it is deep-linkable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- \
  artifacts/trader-dashboard/src/lib/chatTabs.ts \
  artifacts/trader-dashboard/src/lib/chatTabs.test.ts \
  artifacts/trader-dashboard/src/pages/Chat.tsx
```

---

### Task 4: Two-level contextual `BottomNav` + desktop Tornei

The core change. Root mode (6 tabs incl. Archivio + a Community hub) and community mode (`←` + Social/Chat/Comunità/Classifica/Tornei), derived from the route. Desktop sidebar gains Tornei. Preserves every existing static-test contract, plus a new contract test.

**Files:**
- Create: `artifacts/trader-dashboard/src/components/BottomNav.community-nav.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/components/BottomNav.tsx` (full rewrite of data + render; keep container classes)

**Interfaces:**
- Consumes: `?t=` values `social|messaggi|comunita|classifica` (Task 3), keys `nav.community`/`chat.tab.community` (Task 2), `--safe-top` unaffected here.
- Produces: exported `BottomNav` component (unchanged export). Internal `COMMUNITY_ROUTES = ["/chat", "/tornei"]`.

- [ ] **Step 1: Write the failing contract test**

Create `artifacts/trader-dashboard/src/components/BottomNav.community-nav.static.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm exec tsx src/components/BottomNav.community-nav.static.test.ts`
Expected: FAIL — first Community/Users assertion throws against the current file.

- [ ] **Step 3: Rewrite `BottomNav.tsx`**

Replace the entire file `src/components/BottomNav.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useRoute, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Brain, FlaskConical, Archive, Users,
  Globe, MessageCircle, Radio, Trophy, Award, ArrowLeft,
  Library, Sunrise, Settings, Rocket,
} from "lucide-react";
import { getGetUnreadCountQueryKey, useGetProfile, useGetUnreadCount } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Root hubs (level 0). Archivio is a direct hub; "Community" is a hub that,
// once entered, swaps the mobile bar to the community set below.
const ROOT_ITEMS = [
  { href: "/",         icon: LayoutDashboard, labelKey: "nav.home",      isChat: false },
  { href: "/journal",  icon: BookOpen,        labelKey: "nav.journal",   isChat: false },
  { href: "/backtest", icon: FlaskConical,    labelKey: "nav.backtest",  isChat: false },
  { href: "/zen",      icon: Brain,           labelKey: "nav.zen",       isChat: false },
  { href: "/wiki",     icon: Archive,         labelKey: "nav.wiki",      isChat: false },
  { href: "/chat",     icon: Users,           labelKey: "nav.community", isChat: true  },
] as const;

// Community set (level 1). The four /chat tabs are deep-linked via ?t=;
// `path`/`tab` drive active-state matching. Tornei is its own route.
const COMMUNITY_ITEMS = [
  { href: "/chat?t=social",     path: "/chat",   tab: "social",     icon: Globe,         labelKey: "chat.tab.social" },
  { href: "/chat?t=messaggi",   path: "/chat",   tab: "messaggi",   icon: MessageCircle, labelKey: "chat.tab.messages" },
  { href: "/chat?t=comunita",   path: "/chat",   tab: "comunita",   icon: Radio,         labelKey: "chat.tab.community" },
  { href: "/chat?t=classifica", path: "/chat",   tab: "classifica", icon: Trophy,        labelKey: "chat.tab.leaderboard" },
  { href: "/tornei",            path: "/tornei", tab: undefined,    icon: Award,         labelKey: "tornei.nav" },
] as const;

// Desktop-only secondary group (Archivio lives in the root group now).
const SECONDARY_ITEMS = [
  { href: "/library",  icon: Library,  labelKey: "nav.library"  },
  { href: "/routine",  icon: Sunrise,  labelKey: "nav.routine"  },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;

const COMMUNITY_ROUTES = ["/chat", "/tornei"];
const TORNEI_ITEM = COMMUNITY_ITEMS[4]; // Tornei, reused on the desktop sidebar

function NavItem({
  href,
  path,
  matchTab,
  icon: Icon,
  label,
  badge,
  vertical,
  small,
  compact,
}: {
  href: string;
  /** Route path used for active matching (query stripped). Defaults to href. */
  path?: string;
  /** When set, active also requires the current ?t= to equal this value. */
  matchTab?: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  vertical?: boolean;
  small?: boolean;
  compact?: boolean;
}) {
  const [pathActive] = useRoute(path ?? href);
  const search = useSearch();
  const currentTab = new URLSearchParams(search).get("t") ?? "social";
  const isActive = pathActive && (matchTab == null || currentTab === matchTab);

  // The mobile tab label is hidden by default and only flashes briefly when the
  // user taps the item, then fades away on its own. Declared unconditionally.
  const [flashLabel, setFlashLabel] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = () => {
    setFlashLabel(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setFlashLabel(false), 1600);
  };

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (vertical) {
    if (compact) {
      return (
        <Link
          href={href}
          title={label}
          aria-label={label}
          className={`group relative mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200 ${
            isActive
              ? "bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_10px_26px_hsl(var(--primary)/0.08)]"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="nav-indicator-desktop"
                className="absolute left-[-10px] top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>
          <Icon className={`${small ? "h-4 w-4" : "h-[18px] w-[18px]"} transition-colors duration-200`} />
          {badge != null && badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground"
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </Link>
      );
    }

    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group ${
          small ? "py-2" : ""
        } ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        }`}
      >
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="nav-indicator-desktop"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 shrink-0">
          <motion.div
            animate={{ scale: isActive ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Icon className={`${small ? "w-4 h-4" : "w-[18px] h-[18px]"} transition-colors duration-200`} />
          </motion.div>
          {badge != null && badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </div>
        <span className={`${small ? "text-xs" : "text-sm"} font-medium relative z-10 transition-colors duration-200`}>
          {label}
        </span>
      </Link>
    );
  }

  /* Mobile tab item */
  return (
    <Link
      href={href}
      onClick={handleSelect}
      className={`relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full py-2 transition-colors duration-200 ${
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="nav-indicator-mobile"
            className="absolute inset-x-1.5 bottom-1.5 top-1.5 rounded-full border border-primary/20 bg-primary/10 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_0_22px_hsl(var(--primary)/0.14)]"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10">
        <motion.div
          animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -1 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Icon
            className={`w-5 h-5 sm:w-[22px] sm:h-[22px] transition-colors duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </motion.div>
        {badge != null && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {flashLabel && (
          <motion.span
            key="label"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 overflow-hidden text-[10px] font-medium leading-none text-primary sm:text-[11px]"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const { data: unreadData } = useGetUnreadCount({ query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 5000 } });
  const { data: profile } = useGetProfile();
  const unreadCount = unreadData?.count ?? 0;
  const [location] = useLocation();
  const inCommunity = COMMUNITY_ROUTES.some((r) => location === r || location.startsWith(`${r}/`));

  const avatarSrc =
    profile && profile.avatarUrl
      ? profile.avatarUrl
      : `${import.meta.env.BASE_URL}images/avatar-default.png`;
  const profileName = profile?.name ?? "Trader";

  return (
    <>
      {/* ── Mobile / tablet bottom bar ────────────────────────────────── */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-0 right-0 z-50 px-3 sm:px-4 lg:hidden"
      >
        <div className="mx-auto max-w-lg overflow-hidden rounded-full border border-white/10 bg-card/70 shadow-[0_18px_60px_rgba(0,0,0,0.38),inset_0_1px_0_hsl(var(--foreground)/0.16),inset_0_-1px_0_hsl(var(--background)/0.38)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/55">
          {inCommunity ? (
            <div className="flex items-center px-1">
              {/* Back to Home — exits the Community hub */}
              <Link
                href="/"
                aria-label={t("nav.home")}
                title={t("nav.home")}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="mx-0.5 h-6 w-px shrink-0 bg-border/50" />
              {COMMUNITY_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  path={item.path}
                  matchTab={item.tab}
                  icon={item.icon}
                  label={t(item.labelKey)}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center px-1">
              {ROOT_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  badge={item.isChat ? unreadCount : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </motion.nav>

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <motion.nav
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 }}
        className="fixed bottom-0 left-0 top-0 z-50 hidden w-20 flex-col border-r border-border/45 bg-card/90 shadow-[2px_0_24px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:flex"
      >
        {/* Logo */}
        <div className="px-3 py-4 border-b border-border/30">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="flex items-center justify-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.1)]">
              <Rocket className="h-6 w-6" aria-label="TraderLoading" />
            </div>
          </motion.div>
        </div>

        {/* Primary nav (root hubs) + Tornei */}
        <div className="flex-1 flex flex-col px-2 py-3 gap-1 overflow-y-auto">
          {ROOT_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
            >
              <NavItem
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                badge={item.isChat ? unreadCount : undefined}
                vertical
                compact
              />
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 28 }}
          >
            <NavItem
              href={TORNEI_ITEM.href}
              path={TORNEI_ITEM.path}
              icon={TORNEI_ITEM.icon}
              label={t(TORNEI_ITEM.labelKey)}
              vertical
              compact
            />
          </motion.div>

          {/* Divider */}
          <div className="mx-auto my-2 h-px w-9 bg-border/35" />

          {SECONDARY_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
            >
              <NavItem
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                vertical
                small
                compact
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom user section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="px-3 py-3 border-t border-border/30"
        >
          <Link
            href="/settings"
            aria-label={t("profile.open_settings")}
            title={t("profile.settings")}
            className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-card/70 p-0.5 shadow-[0_0_14px_hsl(var(--primary)/0.08)] transition-colors hover:border-primary hover:bg-primary/10"
          >
            <img
              src={avatarSrc}
              alt={t("profile.alt", { name: profileName })}
              className="h-full w-full rounded-[10px] object-cover"
            />
          </Link>
        </motion.div>
      </motion.nav>
    </>
  );
}
```

- [ ] **Step 4: Run the new contract test to confirm it passes**

Run: `pnpm exec tsx src/components/BottomNav.community-nav.static.test.ts`
Expected: PASS — `bottom nav community-nav static checks passed`.

- [ ] **Step 5: Run the pre-existing nav static tests (must stay green)**

Run each and expect PASS (no edits to these files were needed because the contracts were preserved):

```
pnpm exec tsx src/navigation-backtest.static.test.ts
pnpm exec tsx src/components/BottomNav.liquid-glass.static.test.ts
pnpm exec tsx src/components/ProfileNavigation.static.test.ts
pnpm exec tsx src/bottom-nav-clearance.static.test.ts
```

If any fails, reconcile the source to the assertion (do not weaken the test): confirm the mobile pill container line is byte-identical to the original, the backtest item keeps `isChat: false`, and BottomNav still imports/uses `useGetProfile`, `href="/settings"`, `profile.avatarUrl`, and `images/avatar-default.png`.

- [ ] **Step 6: Typecheck**

Run (repo root): `pnpm typecheck`
Expected: PASS. (Watch for unused imports — every lucide icon imported must be used; `TORNEI_ITEM` uses Award.)

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(nav): two-level contextual bottom bar + desktop Tornei

Root hubs gain Archivio and a Community hub; entering community swaps the
mobile bar to Social/Chat/Comunita/Classifica/Tornei with a back-to-Home
arrow. Desktop sidebar gains Tornei. Archivio moves to the root group.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- \
  artifacts/trader-dashboard/src/components/BottomNav.tsx \
  artifacts/trader-dashboard/src/components/BottomNav.community-nav.static.test.ts
```

---

### Task 5: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run (repo root): `pnpm verify`
Expected: install → codegen → typecheck → test → build all PASS. (`pnpm codegen` is a no-op here — no contract change — but CI checks it's in sync.)

If `pnpm verify` can't complete in this environment (e.g. missing `VITE_CLERK_PUBLISHABLE_KEY` at the build step — a known env-only gap), fall back to and record the results of:

```
pnpm typecheck
pnpm lint
pnpm test
```

Expected: PASS. Note explicitly whether the build step ran or was skipped for the env reason.

- [ ] **Step 2: Manual e2e checklist (record results, do not fake)**

On an installed iOS PWA (notched device) or Safari responsive with a notch profile:
- Header content clears the notch (ticker/avatar not under the status bar).
- Root bar shows 6 tabs incl. Archivio + Community; Community carries the unread badge.
- Tapping Community enters `/chat` → bar swaps to `[←] Social Chat Comunità Classifica Tornei`.
- Each community tab deep-links the correct `/chat?t=…`; Tornei opens `/tornei`; active highlight follows.
- `←` returns to Home and restores the root bar.
- Desktop (`lg`): sidebar shows Tornei; Archivio present; avatar→Settings works.

- [ ] **Step 3: Push the branch**

```bash
git push
```

(If the remote rejects because it advanced, report it — never `--force`.)

---

## Notes for the implementer

- **Shared working tree:** this branch has multiple agents. Always commit with an explicit pathspec (`git commit -m "…" -- <paths>`), never `git add -A`. See the per-task commit commands.
- **wouter query params:** `useLocation()` returns the pathname only; the query is read via `useSearch()`. `navigate("/chat?t=messaggi")` updates both.
- **Why the Chat regex changed (Task 1 Step 7):** the height calc legitimately gained a `--safe-top` term; the sibling test asserts the new, correct expression rather than the stale one.
- **Icons:** `Users` = Community hub, `Globe` = Social, `MessageCircle` = Chat, `Radio` = Comunità, `Trophy` = Classifica, `Award` = Tornei, `ArrowLeft` = back. All from `lucide-react`.
