# Trading-session badge (Claude Design) + desktop-only quote — Design

**Date:** 2026-07-02
**Branch:** feat/community-management
**Status:** Approved, ready for implementation

## Problem

Two related polish items on the dashboard clock / quote surfaces:

1. **Session badge.** The `ClockWidget` banner shows the active trading-session as a
   compact badge with a fixed dark background (`bg-[#151b31]`), a fixed dark border
   (`border-[#1d2740]`), and only the status dot tinted by the session colour. Claude
   Design's Command-Center mock ([design-ref/landing/landing-ui.jsx:161-163](../../../design-ref/landing/landing-ui.jsx))
   uses a cleaner, glowing **colour pill**: the session colour tints the text, the
   translucent background, the border, and a soft outer glow, plus a glowing dot. We
   want that badge in place of the current one, in the `ClockWidget` **and** in the
   per-session cards of the dedicated `/clock` page (for visual consistency).

2. **Duplicate quote on desktop.** On desktop (`lg` ≥ 1024px) the daily quote appears
   **twice**: inline inside the `ClockWidget` banner (`lg:flex`) and again as the
   standalone "Citazione del Giorno" grid widget (`QuoteWidget`). On desktop the quote
   should live **only** in the clock banner; the grid widget disappears there (including
   layout-edit mode). On mobile/tablet the banner hides its inline quote, so the grid
   widget must remain.

## Claude Design badge reference

From the landing Command-Center mock, the session pill is:

```
inline-flex, gap 5px, padding 4px 9px, border-radius 8px, font-size 11px, weight 700
color:       hsl(<session>)
background:   hsl(<session> / 0.12)
border:       1px solid hsl(<session> / 0.30)
box-shadow:   0 0 16px hsl(<session> / 0.25)     (outer glow)
dot (6×6):    background hsl(<session>),  box-shadow 0 0 8px hsl(<session>)
```

The app already exposes per-session HSL vars: `--session-asian` (viola),
`--session-london` (arancio ≈ the mock), `--session-ny` (verde), `--session-volume`
(grigio), `--session-closed` (= `--destructive`, rosso), plus `--success` / `--destructive`.

## Design

### 1. Shared pure module `lib/sessionBadge.ts`

A pure, copy-free (i18n-safe), unit-testable helper mapping a **tone** to literal
Tailwind class strings. Class strings must be **literal** (not built by string
interpolation) so the Tailwind JIT scanner emits them.

```ts
export type SessionTone =
  | "session-asian" | "session-london" | "session-ny" | "session-volume"
  | "success" | "destructive" | "muted";

export interface SessionBadgeClasses { container: string; dot: string }
export function sessionBadgeClasses(tone: SessionTone): SessionBadgeClasses;
```

Each coloured tone yields the Claude Design pill (`text` + `bg/0.12` + `border/0.30`
+ `shadow 16px/0.25`) and glowing dot (`bg` + `shadow 8px`). `muted` is a spent pill
(no glow) for inactive `/clock` cards.

### 2. State → tone mapping (unchanged semantics)

| State | Tone |
|---|---|
| Active trading session | its `session.color` (`session-asian/london/ny/volume`) |
| Active *closed* session / weekend | `destructive` |
| Market open, no session | `success` |
| `/clock` inactive card | `muted` |

### 3. `ClockWidget` badge

Replace the fixed dark bg/border in the badge ([ClockWidget.tsx:172-183](../../../artifacts/trader-dashboard/src/components/ClockWidget.tsx))
with `sessionBadgeClasses(tone).container`, and the dot with `.dot`. **Keep** the
compact banner sizing/placement (`h-[1.875rem] w-[5.9rem] justify-self-end`, label
truncation) so the layout is unaffected. Remove the now-dead `colorMap` / `neon-glow-*`
/ `badgeDotClass` / `badgeTextClass` / `badgeBorderClass` logic in favour of the tone.

### 4. `/clock` page session cards

The Attiva / Chiuso / Inattiva badges ([Clock.tsx:132-138](../../../artifacts/trader-dashboard/src/pages/Clock.tsx))
adopt the same pill: **Attiva** = session colour, **Chiuso** = `destructive`,
**Inattiva** = `muted`. The dot beside the session name gains the glow when active.
Text labels are unchanged (i18n intact).

### 5. Desktop-only quote

- New generic hook `hooks/use-media-query.ts` → `useIsDesktop()` =
  `matchMedia("(min-width: 1024px)")` (matches the banner's `lg:flex`).
- Extract a pure function into `pages/Dashboard.layout.ts`:

  ```ts
  export const DESKTOP_HIDDEN_WIDGET_IDS = ["quote"] as const;
  export function visibleWidgetOrder(
    order: string[],
    hidden: Record<string, boolean>,
    opts: { isEditing: boolean; isDesktop: boolean },
  ): string[];
  ```

  On desktop it drops `"quote"` **always** (even in edit mode); then applies the
  visibility filter (edit mode shows hidden as ghosts, normal mode hides them).
  `Dashboard.tsx` uses this in place of the inline `displayOrder` computation.

## Testing

- `lib/sessionBadge.test.ts` — every tone present; coloured tones contain their own
  `--session-*`/`--success`/`--destructive` var and a glow; `muted` has no glow.
- `pages/Dashboard.layout.test.ts` — `visibleWidgetOrder`: desktop drops `"quote"`
  (including `isEditing: true`); mobile keeps it; the `hidden` filter still applies in
  normal mode and is ignored (ghosts) in edit mode.
- Existing static tests stay green (`ClockWidget.market-closed`, `QuoteWidget.animation`,
  `dashboard-pro-widgets`).
- Gate: `pnpm verify`.

## Out of scope

No contract/OpenAPI change, no DB change, no new user-facing copy (i18n static tests
unaffected). No changes to the quote data source or the reorder/persistence model.
