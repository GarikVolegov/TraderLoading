# Design — PWA safe-area (notch) + contextual Community navbar

- **Date:** 2026-07-02
- **Branch:** `feat/community-management`
- **Surface:** `artifacts/trader-dashboard` (React/Vite SPA)
- **Status:** approved-for-planning

## 1. Problem

Two independent defects/requests on the installed mobile app.

**A. PWA notch.** Installed as a PWA on iOS, the app does not fit the screen: on
notched iPhones the **top of the UI is hidden under the notch / status bar**. Root
cause — the fixed top header [`TopNav`](../../../artifacts/trader-dashboard/src/components/TopNav.tsx)
renders at `fixed top-0` with **no top safe-area inset**, while
[`index.html`](../../../artifacts/trader-dashboard/index.html) runs the PWA with
`apple-mobile-web-app-status-bar-style: black-translucent` + `viewport-fit=cover`.
The bottom bar already honours `env(safe-area-inset-bottom)`; the top does not.

**B. Navigation gaps.** The mobile bottom bar has 5 fixed tabs (Home, Diario,
Backtest, Zen, Chat/"Community"). **Archivio** (`/wiki`) and **Tornei** (`/tornei`)
are only reachable via the `Cmd/Ctrl+K` command palette — unusable by touch. Tornei
is also absent from the desktop sidebar. The user wants Archivio as a direct hub and
Tornei grouped under a **Community** section, with a **contextual** bottom bar that
swaps its destinations when you enter a hub and offers a back arrow to leave it.

## 2. Goals / non-goals

**Goals**
- Installed iOS/Android PWA content clears the notch/status bar (top safe-area).
- Archivio is a direct root hub on the mobile bar.
- A **Community** hub groups the social surfaces (`/chat` tabs) + Tornei.
- Mobile bottom bar is **two-level & contextual**: a root level and a Community
  level, with a back arrow (`←`) that returns to Home.
- Tornei is reachable from the desktop sidebar.

**Non-goals**
- No redesign of the sidebar interaction model on desktop (contextual behaviour is
  mobile-only; desktop keeps the full always-visible sidebar).
- No change to the content/features of `/chat`, `/tornei`, or `/wiki` themselves.
- No new backend/contract work (all client-side; endpoints already exist).

## 3. Design

### 3.1 PWA safe-area (top inset)

Introduce one source of truth in [`index.css`](../../../artifacts/trader-dashboard/src/index.css)
alongside the existing `--bottom-nav-clearance`:

```css
:root { --safe-top: env(safe-area-inset-top, 0px); }
```

- **TopNav** — the fixed glass header pads its top by `var(--safe-top)`. The
  translucent glass background extends up *into* the notch region (so the status-bar
  area is tinted, not a bare gap); the actual content row (ticker, audio, avatar)
  drops below the inset. On desktop (`lg`) the header starts at `lg:left-20` and the
  inset is `0px` on non-notched displays, so nothing changes there.
- **PageLayout** — the content top clearance
  [`pt-[3.85rem]` / `lg:pt-[3.65rem]`](../../../artifacts/trader-dashboard/src/components/PageLayout.tsx)
  becomes `pt-[calc(var(--safe-top)+3.85rem)]` (and the `lg` variant likewise) so
  page content still clears the now-taller header.
- **Chat height calc** — `h-[calc(100dvh-…-var(--bottom-nav-clearance))]` in
  [`Chat.tsx`](../../../artifacts/trader-dashboard/src/pages/Chat.tsx) subtracts
  `var(--safe-top)` as well, so the chat pane doesn't overflow under the header.
- Bottom bar already uses `env(safe-area-inset-bottom)` — unchanged.

`env(safe-area-inset-top)` is `0px` on every non-notched device and in the browser
tab, so this is a no-op everywhere except installed notched PWAs.

### 3.2 Mobile bottom bar — two-level contextual model

The bar renders one of two **modes**, derived purely from the current route
(`useLocation()`), so deep links and back/forward navigation stay consistent:

- `COMMUNITY_ROUTES = ["/chat", "/tornei"]` → **Community mode**.
- everything else → **Root mode**.

**Root mode (6 tabs)** — icon-only tabs, label flashes on tap (existing behaviour):

| # | Tab | Route | Icon | Notes |
|---|-----|-------|------|-------|
| 1 | Home | `/` | LayoutDashboard | |
| 2 | Diario | `/journal` | BookOpen | |
| 3 | Backtest | `/backtest` | FlaskConical | |
| 4 | Zen | `/zen` | Brain | |
| 5 | **Archivio** | `/wiki` | Archive | `nav.wiki` |
| 6 | **Community ▸** | → `/chat` | Users | carries chat **unread badge**; entering flips the bar to Community mode |

**Community mode** — a compact leading `←` back affordance + 5 destination tabs:

| Slot | Item | Target | Icon |
|------|------|--------|------|
| lead | `←` Back | → `/` (Home) | ArrowLeft |
| 1 | Social | `/chat?t=social` | Globe |
| 2 | Chat | `/chat?t=messaggi` | MessageCircle |
| 3 | Comunità | `/chat?t=comunita` | Radio |
| 4 | Classifica | `/chat?t=classifica` | Trophy |
| 5 | Tornei | `/tornei` | Award |

- The **Community** root tab navigates to `/chat` (default tab `social`), which puts
  the route in `COMMUNITY_ROUTES` → the bar swaps to Community mode.
- The `←` back arrow always navigates to `/` (Home) — the simplest, most
  predictable exit (user-chosen).
- Active-tab highlighting in Community mode is driven by the current path + `?t=`
  query for `/chat`, and by path `/tornei` for Tornei.

```
ROOT:       [Home][Diario][Backtest][Zen][Archivio][Community▸]
                                                     tap ↓
COMMUNITY:  [←][Social][Chat][Comunità][Classifica][Tornei]
             ← → Home
```

Layout notes: 6 icon-only slots fit an iPhone-SE-width floating pill (~58px each,
above the 44px touch-target minimum). The existing mobile-bar container classes
(liquid-glass material + `bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]`)
are preserved so the `BottomNav.liquid-glass` static test stays green. Mode swaps
animate with the existing framer-motion vocabulary (fade/slide), reusing the current
`nav-indicator-mobile` `layoutId` for the active pill.

### 3.3 URL-addressable chat tabs

Today [`Chat.tsx`](../../../artifacts/trader-dashboard/src/pages/Chat.tsx) holds the
active tab in `useState<Tab>("social")`. To let the always-mounted bottom bar
deep-link into a specific tab, the active tab becomes **URL-driven**:

- Read `?t=` on mount and on change → `Tab` (`social | messaggi | comunita |
  classifica`), defaulting to `social` for absent/invalid values.
- Tab clicks in the in-page strip update the URL (`?t=…`) instead of local state.
- **Both** the in-page top tab strip **and** the bottom bar remain visible on mobile
  (user-chosen) and stay in sync because they share the URL as the single source of
  truth.

This is the only change to `Chat.tsx` behaviour; tab contents are untouched.

### 3.4 Desktop sidebar

Contextual swapping is mobile-only. The desktop left sidebar keeps its always-visible
form; the only change is **adding Tornei** (Award icon, `tornei.nav`) to it, placed
adjacent to Chat so Chat + Tornei read as the "Community" cluster. Archivio (`/wiki`)
is already present in `SECONDARY_ITEMS`. The `NAV_ITEMS` / `SECONDARY_ITEMS` arrays
are refactored into the root/community model but the desktop render keeps showing the
full flat set (primary + secondary + Tornei).

### 3.5 i18n

Per the enforced i18n static tests (`production-copy.static`, `i18n.parity.static`),
all surfaced copy uses `t()` with keys present in **all 5 languages** (it/en/es/fr/de):

- **Reuse:** `nav.home`, `nav.journal`, `nav.backtest`, `nav.zen`, `nav.wiki`,
  `tornei.nav`, `chat.tab.social`, `chat.tab.messages`, `chat.tab.leaderboard`.
- **Add:** `nav.community` (root hub + `←` region label) and `chat.tab.community`
  (replaces the hardcoded `"Comunità"` string when surfaced in the bar). Add both
  across all 5 language blocks. Avoid mojibake-flagged chars (no `Ã/â/Â/ð`).

## 4. Components & interfaces

- **`index.css`** — add `--safe-top`; adjust nothing else structurally.
- **`TopNav.tsx`** — wrap/pad header content by `var(--safe-top)`.
- **`PageLayout.tsx`** — fold `--safe-top` into the top padding calc.
- **`Chat.tsx`** — derive `activeTab` from `?t=`; tab clicks push `?t=`; add
  `chat.tab.community` key usage for the Comunità label.
- **`BottomNav.tsx`** — the substantive change:
  - `ROOT_ITEMS` (6) and `COMMUNITY_ITEMS` (5) data arrays + `COMMUNITY_ROUTES`.
  - `mode` derived from `useLocation()`.
  - Mobile bar renders root vs community mode (+ `←` back-to-Home control).
  - Desktop sidebar renders the full flat set incl. Tornei (unchanged interaction).
  - Community root tab keeps the unread badge.
- **i18n.ts** — new keys × 5 languages.

Each unit stays independently testable: safe-area is pure CSS var wiring; the bar is a
pure function of `(location, unreadCount)` → rendered items; chat-tab selection is a
pure `parseTab(search)`.

## 5. Testing (TDD)

- **New:** `BottomNav` two-level contract — asserts root set (Home, Diario, Backtest,
  Zen, Archivio, Community), community set (Social, Chat, Comunità, Classifica,
  Tornei) + `←`, mode derivation from route, and the unread badge on Community.
- **New:** safe-area — assert `--safe-top` var defined and consumed by TopNav +
  PageLayout top padding calc.
- **Update:** `navigation-backtest.static`, `ProfileNavigation.static`,
  `BottomNav.liquid-glass.static`, `bottom-nav-clearance.static` for the new
  structure (bottom clearance formula is unchanged; keep it green).
- **Update/verify:** i18n parity + production-copy static tests pass with the new keys.
- **Gate:** `pnpm verify` (typecheck + test + build) green before done.
- **Manual e2e:** installed iOS PWA on a notched device — header clears the notch;
  root ⇄ community bar swap; `←` → Home; deep links `/chat?t=classifica`, `/tornei`.

## 6. Risks & edge cases

- **`black-translucent` + tinted inset:** extending the glass into the notch must not
  look like a bare gap; verify the header background reaches `top:0` while content is
  padded. (If undesirable, fall back to a solid inset strip in `theme-color`.)
- **6 tabs on very small phones:** icon-only keeps targets ≥44px; verified against
  iPhone-SE width. Labels remain tap-flash only.
- **Landscape / Android notches:** `env(safe-area-inset-top)` covers these too; no
  device-specific code.
- **Back/forward + deep links:** because bar mode and chat tab are both derived from
  the URL, browser history and shared links stay consistent.
- **Static-test churn:** the nav refactor touches several `*.static.test.ts` files;
  update them in the same change to keep the gate green.
