# Bottom-nav clearance — design

**Date:** 2026-06-29
**Status:** Approved (brainstorming) — pending implementation plan
**Scope:** `artifacts/trader-dashboard` (frontend only)

## 1. Problem

Pages and sections do not relate consistently to the global navigation, which on
mobile/tablet is a floating bottom bar and on desktop (`lg:`) is an 80px left
sidebar. Two opposite symptoms occur, both from the same root cause:

- **Too little clearance** → buttons/inputs sit *behind* the floating bottom bar
  (hidden/blocked controls, "incomplete" interfaces).
- **Too much clearance** → content ends far above the bar, leaving a large empty
  gap on some screens.

**Root cause:** the bottom-bar clearance is encoded as **per-file magic numbers**
instead of a single shared value, and some pages add their *own* trailing bottom
padding *on top of* the shared `PageLayout` padding (double clearance). When the
bar geometry or a page's padding drifts, the two go out of sync independently.

## 2. Current state (audit)

### Navigation geometry
- **Mobile/tablet** — floating pill bar ([`BottomNav.tsx:229`](../../../artifacts/trader-dashboard/src/components/BottomNav.tsx)):
  starts at `safe-area + 12px` from the bottom, pill height ~64px → occupies the
  band **~12px–76px** above the viewport bottom.
- **Desktop (`lg:`)** — the same nav renders as a **left sidebar, 80px wide**
  (`w-20`).
- **Central clearance** — [`PageLayout.tsx:27`](../../../artifacts/trader-dashboard/src/components/PageLayout.tsx):
  `pb-[calc(5.75rem+safe)]` mobile, `sm:pb-[calc(6rem+safe)]`, `lg:pb-6`,
  `lg:pl-20`. 18 of 22 pages use `PageLayout`; for normal-flow content the
  baseline clearance (~16px above the bar) is correct.

### Findings — content hidden behind the bar (too little clearance)
1. **No shared token (root fragility).** Magic numbers scattered: `5.75rem`/`6rem`
   in `PageLayout`, `180px` in Chat, `16px` in the pair-modal footer, etc.
2. **Chat** ([`Chat.tsx:93`](../../../artifacts/trader-dashboard/src/pages/Chat.tsx)):
   the message area is `height: calc(100dvh - 180px)` with the composer as its
   last child. `180px` is not tied to the bar clearance or safe-area, so on short
   screens / with insets the composer can fall ~30–40px *behind* the bar.
3. **CookieConsentPopup** ([`CookieConsentPopup.tsx:26`](../../../artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx)):
   `fixed bottom-3 z-[80]` sits *on top of* the mobile nav buttons until accepted;
   on desktop it does not offset the sidebar.

### Findings — empty gap above the bar (too much clearance)
Pages that add a trailing `pb-*` *in addition to* `PageLayout`'s clearance:

| Page | Extra trailing padding | Total gap above bar |
|---|---|---|
| Milestones ([`:924`](../../../artifacts/trader-dashboard/src/pages/Milestones.tsx)) | `pb-24` (96px) | ~188px 🔴 |
| ProPage ([`:256`](../../../artifacts/trader-dashboard/src/pages/ProPage.tsx)) | `pb-10` (40px) | ~132px 🟠 |
| Routine ([`:276`](../../../artifacts/trader-dashboard/src/pages/Routine.tsx)) | `pb-4` (16px) | ~108px 🟡 |

### Already correct — no action
- **PairSelectionModal** ([`:351`](../../../artifacts/trader-dashboard/src/components/PairSelectionModal.tsx)):
  bottom-sheet footer uses `paddingBottom: max(16px, env(safe-area-inset-bottom))`
  — reference pattern to imitate.
- `sheet` / `drawer` / Radix `Dialog`: full-screen overlays above the bar.
- **Admin** renders its own shell — `BottomNav` is not mounted there → exempt.
- **LandingPage / LegalPage / not-found**: signed-out (no bar) or centered content
  → no risk.

## 3. Design

**Guiding principle:** there is exactly **one owner** of bottom-bar clearance —
`PageLayout`, via a shared token. No page or section adds its own bottom-bar
padding. Elements that must escape `PageLayout` (fixed/sticky bars, dvh-sized
scroll regions) reference the *same* token.

### 3.1 The token (single source of truth)

Defined once in [`index.css`](../../../artifacts/trader-dashboard/src/index.css),
**responsive** so it adapts mobile↔desktop automatically:

```css
:root {
  /* band occupied by the floating bar: 64px pill + 12px gap */
  --bottom-nav-band: 4.75rem;            /* 76px */
  /* content clearance = band + safe-area + breathing room */
  --bottom-nav-clearance: calc(var(--bottom-nav-band) + env(safe-area-inset-bottom, 0px) + 1rem);
  --app-inset-left: 0px;                 /* desktop sidebar offset */
}
@media (min-width: 1024px) {             /* lg: bar becomes the sidebar */
  :root {
    --bottom-nav-clearance: 1.5rem;
    --app-inset-left: 5rem;              /* 80px */
  }
}
```

Mobile value: `76px + safe + 16px = 92px` — identical to today's `5.75rem`
(no regression), but now a single, auto-adapting value. The `sm:` bump to `6rem`
is dropped (uniform `5.75rem`-equivalent across mobile; the 4px difference is
negligible).

Convenience utilities (Tailwind v4 `@utility`) so consumers read clearly and the
guardrail can grep for them:
- `pb-bottom-nav` → `padding-bottom: var(--bottom-nav-clearance)`
- `bottom-nav-safe` → `bottom: var(--bottom-nav-clearance)` (anchor a fixed
  element *above* the bar)

### 3.2 PageLayout

Replace the hardcoded clearance with the token:
- bottom: `pb-[var(--bottom-nav-clearance)]` (drops the `sm:`/`lg:pb-6` magic
  numbers — the token already collapses to `1.5rem` at `lg`).
- left: `pl-[var(--app-inset-left)]` (replaces `lg:pl-20`; 0 on mobile, 80px on
  desktop).

### 3.3 Fixes — content hidden behind the bar

- **Chat** — replace `calc(100dvh - 180px)` with
  `calc(100dvh - <top> - var(--bottom-nav-clearance))`, where `<top>` is the real
  TopNav + PageHeader height. `<top>` is **measured in the browser during the
  verify step** rather than guessed, then written as a single named constant.
  This keeps the composer above the bar on short screens and removes the gap on
  tall screens.
- **CookieConsentPopup** — `bottom-3` → `bottom-[var(--bottom-nav-clearance)]`
  (lifts above the in-app bar) plus a desktop left offset for the sidebar.
  **Tradeoff (accepted):** on the signed-out landing (no bar) the popup floats a
  little higher than strictly necessary — cosmetic, not broken.

### 3.4 Fixes — empty gap above the bar

Remove redundant trailing bottom padding so `PageLayout` is the sole owner:
- Milestones: drop `pb-24`.
- ProPage: drop the last section's `pb-10`.
- Routine: drop the trailing `pb-4`.

### 3.5 Guardrail (static test)

A static test in the project's `*.static.test.ts` convention (cf.
[`BottomNav.liquid-glass.static.test.ts`](../../../artifacts/trader-dashboard/src/components/BottomNav.liquid-glass.static.test.ts))
asserting:
1. The token is defined in `index.css`.
2. `PageLayout`, `Chat`, `CookieConsentPopup` reference the token (locks the fixes;
   blocks a return to magic numbers).
3. No **new** `fixed`/`sticky` bottom-anchored element uses `bottom-[<number>]`
   or `calc(100dvh - <number>px)` outside a small overlay allowlist — it must use
   the token instead.
4. A heuristic check forbidding large bottom padding (`pb-`/`mb-` ≥ 10) on a
   page's outermost `PageLayout` content wrapper, to catch the double-padding
   regression.

**Honest limitation:** checks 3–4 are heuristic and cannot catch every case. The
durable guarantee is the convention *"PageLayout is the only owner of bottom-bar
clearance"*, documented alongside the test.

## 4. Affected files

- `index.css` — add token + utilities.
- `components/PageLayout.tsx` — use token for bottom + left.
- `pages/Chat.tsx` — token-based height.
- `components/CookieConsentPopup.tsx` — lift above bar + desktop offset.
- `pages/Milestones.tsx`, `pages/ProPage.tsx`, `pages/Routine.tsx` — drop
  redundant trailing bottom padding.
- New `*.static.test.ts` — guardrail.

## 5. Testing & verification

- **Static test first** (red → green) per the project's guardrail convention.
- `pnpm verify` (typecheck + tests + build) before declaring done.
- **Manual browser verification** (per `verification-before-completion`): mobile
  viewport with safe-area emulation — Chat composer clears the bar; cookie popup
  sits above the bar; Milestones/ProPage/Routine no longer leave a large gap;
  spot-check a few normal pages for unchanged baseline.

## 6. Out of scope

- Admin shell (no bottom bar) and signed-out marketing pages (no bar).
- Redesign of the nav itself; only clearance/spacing relative to it.
- Desktop sidebar visual changes (only the content left-offset is tokenized).
