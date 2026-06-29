# Diario (Journal) redesign — Claude Design overview

**Date:** 2026-06-29
**Status:** Design approved (structure), spec under review
**Source design:** `design-ref/diario/journal-view.jsx` (pulled from the "TraderLoading
Design System" claude.ai/design project, `ui_kits/dashboard` → `JournalView`).

## 1. Goal

Bring the Diario page ([artifacts/trader-dashboard/src/pages/Journal.tsx](../../../artifacts/trader-dashboard/src/pages/Journal.tsx))
onto the downloaded Claude Design: a single, scrollable **overview** as the page's landing
view, wired to the app's **real** data (the kit's numbers are mock — they must be replaced
with live data, not copied). The existing secondary functions are preserved as tabs.

This is a visual/structural redesign of the page shell + a new overview surface. It does
**not** change any backend endpoint or the contract.

## 2. Approved structure — "Overview + secondary tabs"

**All existing tabs are kept; one new tab is added as the default.** Tab set becomes:

- **Panoramica** (new, default) — the Claude Design overview (§3).
- **Trade** — existing `TradesTab`.
- **Edge** — existing `JournalEdge`.
- **Recap settimanale** — existing `RecapTab mode="weekly"`.
- **Recap mensile** — existing `RecapTab mode="four_week"`.
- **Idee** / **Obiettivi** — existing `IdeasTab`.

Nothing is removed or "absorbed" — so no capability can be lost and no detail view needs a new
home. The Panoramica surfaces *headline* edge + 4-week-recap data; its "vedi dettaglio" / "apri
recap" affordances simply switch the active tab (`setTab("edge")` / `setTab("recap-mensile")`),
which is why those tabs must stay. Default tab changes from `trades` → `panoramica`. On mobile
the tab strip already scrolls (`overflow-x-auto`), so the extra tab needs no layout change.

## 3. The overview — sections and data sources

Faithful to the design's five blocks. All copy via `t()` (no literals — see
[[i18n-enforced-new-ui]]). Built on existing `components/ui/*` primitives (Card, StatTile-equivalent,
Badge, Button, progress bar) — the design-system foundation already in `index.css`.

1. **Header** — PageHeader `journal.title` / `journal.subtitle` + "Nuovo Trade" action that
   opens the existing `JournalEntryModal`. (Mobile: title hidden per the prior change; the
   action stays.)
2. **4 KPI tiles** — from `GET /journal/edge` `overall`:
   - Totale Trade ← `closedTrades`
   - Win Rate ← `winRate`
   - P&L netto (R) ← net realized R (sum of per-trade R; derived if not already on the report)
   - Profit Factor ← `profitFactor`
   - Each degrades to "—" when null (no/insufficient trades).
3. **Two-column row:**
   - **Equity Curve** — realized cumulative-R line from the user's closed trades (chronological),
     plus a **Monte Carlo projection** (p10–p90 / p25–p75 bands + dashed median) resampled from
     the user's own R distribution. Pure helper, unit-tested. Header badge = net R.
   - **Edge** — 4 progress bars from the edge/discipline report: Expectancy (`expectancyR`),
     Avg win/Avg loss (`avgWinR`/`avgLossR`), Disciplina (plan-respected % from discipline),
     Revenge-trade (count from analytics/guard). "Vedi dettaglio" → existing `JournalEdge`.
4. **Recap 4 settimane** — 2×2 grid of the latest `four_week` recap's 4 fields
   (`overallJudgment`, `wentWell`, `wentWrong`, `patterns`), AI badge. Empty/!generated →
   prompt to generate (reuse existing recap-generate flow). "Apri recap" → 4-week recap detail.
5. **Trade recenti** — last N entries via `useGetJournalEntries` + `parseTradeContent`
   (pair, LONG/SHORT badge, note, session·date, R). Row click → existing trade detail.

## 4. Components & isolation

- New `components/journal/JournalOverview.tsx` — composes the five blocks; one clear purpose
  (read edge + latest recap + recent trades, render the design). Depends on existing hooks only.
- New pure `lib/equityProjection.ts` — `cumulativeR(trades)` + `monteCarloBands(rSamples, n)`;
  no React, fully unit-tested (mirrors the kit's `mulberry32`/`quantile` deterministically).
- `JournalOverview` is presentational over those; `Journal.tsx` only owns tab state.
- Reuse, don't fork: KPI tiles reuse the StatTile/Card primitives; Edge bars reuse the same
  progress primitive `JournalEdge` uses.

## 5. i18n

Every new string gets a key in all 5 languages; the static copy test
(`production-copy.static.test.ts`) and parity/mojibake tests must stay green. Italian is the
reference copy (matches the kit). No literals passed to `title`/`label` props.

## 6. Testing

- `lib/equityProjection` — unit tests (cumulative R correctness; bands monotonic p10≤p50≤p90;
  deterministic seed).
- `JournalOverview` — a static test asserting it reads the real hooks (not mock arrays) and
  renders the five sections; degrades gracefully on empty/null data.
- Update the Journal page test(s) for the new default tab + tab set.
- `pnpm verify` green before done.

## 7. Out of scope (YAGNI)

- No new endpoints / no contract change. If "net R" isn't on the edge report, derive it
  client-side from the trades already fetched rather than extending the API.
- No change to entry CRUD, idee/obiettivi, or the editable recap forms.
- Monte Carlo is a visual projection only — not advice, not persisted.
