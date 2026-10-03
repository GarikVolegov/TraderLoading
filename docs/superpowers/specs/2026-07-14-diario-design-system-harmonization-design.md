# Diario (Journal) hub — design-system harmonization

**Date:** 2026-07-14 · **Branch:** `feat/community-management`

## Problem

The Diario/Journal hub is only half-ported onto the Claude Design system. The
`Panoramica` tab (`components/journal/JournalOverview.tsx`) is already a faithful
extraction of the Claude Design mockup (`design-ref/diario/journal-view.jsx`,
identical to `JournalView()` in `design-ref/diario/views-trading.jsx`): 4
`StatTile`s, an equity curve + Monte-Carlo projection, Edge progress bars, a
4-week AI recap grid, and a recent-trades row list — all on the DS primitives
(`Card`/`CardHeader`/`CardContent`, `StatTile`, `Progress`, `Badge`). The tabs
are already promoted to the nav-hub mechanism (`JOURNAL_HUB` in `lib/navHubs.ts`
+ `?t=` deep-links in `lib/journalTabs.ts`; no in-page tab bar).

The remaining four tabs — **Trades**, **Idee**, **Obiettivi**, **Recap** — still
use the older bespoke styling (`rounded-2xl bg-card/60 backdrop-blur-sm`, a local
`StatCard`) and read as a different visual language from the mockup/Panoramica.

## Goal

Bring the four non-overview tabs onto the same DS language the Panoramica already
uses, move the mockup's TopBar **"Nuovo Trade"** action into the page header, and
verify every Diario flow end-to-end. Leave the already-correct Panoramica intact.

## Reference visual language (from the mockup / Panoramica)

- **Container:** `Card` → `CardHeader` (icon in `text-primary`/accent + title
  `text-sm font-semibold` + subtitle `text-xs text-muted-foreground` + optional
  right-side `action`/`Badge`) → `CardContent`.
- **Metrics:** `StatTile` (label + mono value + `tone` of
  default/primary/success/destructive + `size`). No local `StatCard`.
- **Bars:** `Progress`. **Chips:** `Badge`. **Row lists:**
  `border-t border-border/20 px-4 py-3` rows inside a `Card`.
- No bespoke `rounded-2xl bg-card/60 backdrop-blur-sm` panels.

## Changes

### 1. Page header (mockup TopBar)
Render **"Nuovo Trade"** in `PageHeader`'s existing `action` slot at page level
(`pages/Journal.tsx`), matching the mockup. Click → `navigate('/journal?t=trades&new=1')`.
Make the new-trade modal **URL-driven**: `TradesTab`'s open effect keys on
`useSearch()` (not mount-only) so it opens whether the user was on Panoramica or
already on Trades, then clears the `new` param. `CsvImportButton` stays inside the
Trades tab (trade-specific). Remove the now-duplicate in-tab "Nuovo Trade" button.

### 2. TradesTab
Keep the rich card grid (images, tags, notes, edit/delete — real functionality
beyond the mockup) but align it to DS tokens: `Card` wrapper, DS `Badge` for
direction/result, consistent border/radius. Empty and error states unchanged in
behaviour.

### 3. IdeasTab (Idee + Obiettivi)
Add a `CardHeader` (Lightbulb "Idee" / Target "Obiettivi" + subtitle + count
`Badge`). Move item rows onto DS tokens with `Badge` for
importance/cadence/recurrence/deadline chips. **All goal controls stay**: deadline
picker, reminder time, cadence, recurrence, ICS export.

### 4. RecapTab
Replace the local `StatCard` with DS `StatTile` (Totale/Win/Loss/BE → tone
default/success/destructive/default; no icon, closer to the mockup). Convert the
four bespoke panels (win-rate, daily breakdown, top tags, recap editor) to
`Card`/`CardHeader`/`CardContent`; the recap editor gets a `Sparkles + "Recap"`
header with an AI / edit-window `Badge`. Keep the W/L/BE stacked bar and daily
breakdown visuals — re-container only. Delete the unused `StatCard` component.

## Cross-cutting

- **i18n** ([[i18n-enforced-new-ui]]): any new copy (new CardHeader titles/subtitles)
  via `t()` with keys added to all 5 languages; accents verified against the mojibake
  gate ([[i18n-mojibake-test]]).
- **No data/logic change:** all queries, mutations, `?t=` routing, and the
  off-contract recap endpoints are untouched. This is a presentational + header pass.

## Testing

- **TDD static tests first:** assert `StatTile` used (and local `StatCard` gone)
  in Recap, `Card`/`CardHeader` structure on the restyled tabs, new i18n keys
  present in every dict, and "Nuovo Trade" wired in the page header. Watch fail →
  implement.
- **Live verification:** extend `scripts/verify-usability/drive-journal.mjs`
  (Clerk test user) to drive: each tab renders on `?t=`, header "Nuovo Trade"
  opens the modal (from Panoramica and from Trades), add idea, add goal + deadline,
  recap generate, deep-links. Screenshot per tab.
- **Gate:** `pnpm verify` (typecheck + test + build) green before completion.

## Out of scope

Panoramica (already faithful), global design-token divergences, unrelated refactors.
