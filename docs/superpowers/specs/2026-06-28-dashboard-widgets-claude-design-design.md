# Dashboard widgets → Claude Design — design

> Status: approved (2026-06-28). Scope: front-end only (`artifacts/trader-dashboard`).
> Branch: `feat/community-management`.

## 1. Goal

Bring four dashboard widgets onto the **Claude Design** system (project
`TraderLoading Design System`, `ui_kits/dashboard/widgets.jsx`) **without inventing
data** — the Claude Design mockups become look-and-feel layered on the existing real
APIs and behaviour. Four independent interventions:

1. **Watchlist Realtime** — stop scrolling; the card grows with the number of selected pairs.
2. **Routine Giornaliera** — adopt the Claude Design layout, keep the streak/social footer.
3. **Volatilità & ADR** — replace the single-pair period view with the Claude Design
   multi-pair "ADR % used" ring-gauge grid, fed by the real volatility API.
4. **COT Report** — adopt the Claude Design diverging long/short bars, keep the
   expandable per-currency detail.

## 2. Constraints (build gates)

- **i18n scanner** (`production-copy.static.test.ts`) scans `components/`, `pages/`,
  `contexts/`, `lib/` and fails the build on **literal JSX text children**
  (`>Esaurito<`) and literal `aria-label` / `placeholder` / `title` attributes. All new
  visible copy must go through `uiText("…")` (an expression, so it never trips the
  scanner) with keys added to **all 5 languages** in `lib/i18n.ts`. `label=` props are
  not scanned but new copy should still be routed through `uiText` for correctness.
- **Mojibake test** (`i18n.parity.static.test.ts`) forbids `Ã`/`â`/`Â`/`ð` in any DICT
  value — keep copy clean (use proper `à è é`, rephrase if needed).
- **Volatility contrast test** (`VolatilityWidget.contrast.static.test.ts`) requires the
  `volatility-contrast-card` class to remain and bans low-contrast
  `text-muted-foreground/40|50|60` and `text-{primary|destructive|blue-400}/60`.
- **TS strict + `no-explicit-any`** in non-test source. **Don't `prettier --write`**
  api-server files (n/a here — front-end only).

## 3. Widget designs

### 3.1 Watchlist Realtime — `TradingViewWatchlistWidget.tsx`

Single change at the symbols container (currently
`max-h-[372px] … overflow-y-auto … pr-1`): drop the `max-h-*` cap and `overflow-y-auto`
so the card stretches with the embeds (≈116px each). **No max cap.** Keep `space-y-1.5`
and `overflow-x-hidden`. Empty/error/invalid states unchanged. Verify and, if needed,
update `TradingViewWatchlistWidget.static.test.ts` and
`Dashboard.tradingview-watchlist.static.test.ts` so no assertion pins the removed classes
(without weakening intent).

### 3.2 Routine Giornaliera — `RoutineWidget.tsx`

Restyle in place; **keep all behaviour** (`SessionModal`, completion persistence,
`recordRoutineCompletion`, the `tl_routine_*` events, streak/friends metrics).

- **Header**: unchanged (Sunrise icon, warning tone, Inizia/Completate action).
- **Top block**: `ProgressRing` (value = `done/2*100`) showing `{done}/2`, beside a text
  block ("Disciplina giornaliera" / "Completa entrambe per lo streak").
- **Session rows**: Claude Design style — 32px icon tile (tone per program) + label +
  check (done) / "Avvia" pill (pending). Replaces the current Completed/Upcoming rows.
  Each row still opens its `SessionModal` via `onStart`.
- **Footer**: **kept** — friends-in-challenge + streak.

### 3.3 Volatilità & ADR — `VolatilityWidget.tsx`

Rewrite the body to the Claude Design multi-pair ADR ring grid, real data.

- **Data**: React Query `useQueries` over the user's supported pairs (`volPairs`), each
  hitting `/api/tools/volatility?pair=X` (15-min cache, as today).
- **ADR % used** = `clamp(todayPips / y1 * 100, 0, 100)` where `y1` is the 1-year average
  daily range and `todayPips` is today's range. Thresholds (Claude Design): `≥80` →
  **Esaurito** (destructive), `≥60` → **Elevato** (warning), `<60` → **Spazio** (success).
- **Layout**: 2-column grid of tiles; each tile = `ProgressRing` (centre `{pct}` + `%`,
  tone by level), pair label, colored status label.
- **Keep**: header + refresh + "X/Y pair supportati" note + `volatility-contrast-card`
  class. **Remove**: pair-selector dropdown, period table, bar chart.
- **States**: skeleton rings while loading; per-tile graceful fallback on error (prod
  reality: Yahoo blocks the Railway datacenter IP, so this API can 500 in prod).

### 3.4 COT Report — `CotWidget.tsx`

Rewrite to diverging bars; the `/api/tools/cot` payload already returns all reports.

- **Layout**: legend row ("◂ Short … Long ▸"); per filtered currency a row = label +
  **diverging bar** (centre line; fill right when `nonCommNet ≥ 0`, left otherwise; width
  ∝ `|nonCommNet|` normalized against the max `|nonCommNet|` in the set) + `±Nk` value.
- **Keep**: currency filter chips, **expandable per-currency detail on click**
  (3 StatTiles + historical area chart), "Aggiornato … ogni venerdì" footer.

## 4. Shared / cross-cutting

- **Pure helpers** (TDD unit tests):
  - `adrPercentUsed(todayPips: number, y1: number): number` — clamp to `[0,100]`,
    guard `y1 <= 0`.
  - `adrLevel(pct: number): { key: "exhausted" | "elevated" | "room"; tone }` — threshold map.
  - `cotBarWidth(net: number, maxAbs: number): number` — `0` when `maxAbs <= 0`,
    else `|net|/maxAbs` → percent of the half-track.
  Place alongside each widget as `*.helpers.ts` (matches the existing
  `RoutineWidget.helpers.ts` pattern).
- **Reuse** `@/components/ui/ProgressRing` (already used by Routine) and
  `@/components/ui/StatTile`. No new shared primitives.
- **i18n**: ~8–10 new keys (e.g. `vol.adr.exhausted/elevated/room`, `cot.legend.short/long`,
  `routine.discipline.title/subtitle`, `routine.session.start`) in all 5 languages.
- **Tests**: TDD on the helpers; update impacted static tests (contrast, watchlist,
  `dashboard-pro-widgets.static.test.ts`) without weakening their intent.

## 5. Out of scope / YAGNI

- No backend/API changes (volatility stays per-pair; COT stays bulk).
- No new dashboard widgets, no registry/order changes.
- No max-height cap on the watchlist (explicit product choice: grow freely).
- No redesign of the period-table/bar-chart concept (intentionally dropped from volatility).

## 6. Verification

`pnpm verify` (codegen → typecheck → test → build) green before declaring done; then
`git push` the branch per the working agreement.
