# Dashboard Widgets — Design Refresh (from Claude Design kit)

**Date:** 2026-06-28
**Branch:** feat/landing-page-rebuild
**Status:** Design approved, pending spec review

## 1. Goal

Bring the visual design of the **Claude Design** dashboard UI kit
(`ui_kits/dashboard/widgets.jsx` in project `TraderLoading Design System`,
`831a2631-e58c-4c3a-97f8-0c05dedb57e0`) onto the **real production dashboard
widgets**, keeping every widget fully functional (real data, real logic) and
reviewing each one. Same workflow already applied to landing and auth.

The kit is a cosmetic recreation with **mocked data**. Production widgets already
exist with **live data wiring**. The work is: graft the kit's *presentation* onto
the production widgets without disturbing their data/logic, i18n, layout, gating,
or deep-links.

## 2. Scope

### In scope — 13 dashboard registry widgets

From `WIDGET_DEFS` in [Dashboard.tsx](../../../artifacts/trader-dashboard/src/pages/Dashboard.tsx),
matched to the kit:

| # | Production component | Kit counterpart | Visual primitives used |
|---|---|---|---|
| 1 | `ClockWidget` | `ClockWidget` | full-width banner: time + daily quote + session pill |
| 2 | `JournalWidget` | `JournalWidget` | 4× `StatTile` |
| 3 | `BrokerHubWidget` | `BrokerHubWidget` | `StatTile` + equity `Sparkline` |
| 4 | `SentimentWidget` | `SentimentWidget` | `Gauge` + long/short bars |
| 5 | `VolatilityWidget` | `VolatilityWidget` | 4× `ProgressRing` |
| 6 | `CotWidget` | `CotWidget` | diverging long/short bars |
| 7 | `MissionsWidget` | `MissionsWidget` | `ProgressRing` + mission list |
| 8 | `RoutineWidget` | `RoutineWidget` | `ProgressRing` + routine rows |
| 9 | `ChecklistDashboardWidget` | `ChecklistWidget` | `ProgressBar` + checklist rows |
| 10 | `CalendarWidget` | `CalendarWidget` | event rows + impact dots |
| 11 | `QuoteWidget` | `QuoteWidget` | glow card, quote + author |
| 12 | `LotCalculatorWidget` | `LotCalculatorWidget` | inputs + result tile |
| 13 | `TradingViewWatchlistWidget` | `WatchlistWidget` | see note below |

**TradingViewWatchlistWidget note:** production renders an external **TradingView**
embed, not the kit's mocked sparkline list. We do **not** replace the embed. We only
align the surrounding **Card chrome** (header with tonal icon, live badge, borders,
spacing) to the kit. The kit's `WatchlistWidget` sparkline-row pattern is **not**
ported into the live TradingView widget; it may inform a future fallback only.

### Out of scope

- Dashboard layout / masonry / "Modifica layout" edit mode / widget registry — unchanged.
- Secondary components not in the registry (`LeaderboardWidget`, `ProfileWidget`,
  `CalendarMissionsWidget`, etc.).
- Any data-source, API, or contract change.
- Functional/behavioural changes beyond what a restyle requires.

## 3. Token mapping (kit → production)

The production design system already defines the tokens. No raw HSL literals in new
code — everything resolves through `hsl(var(--…))`. Verified in
[index.css](../../../artifacts/trader-dashboard/src/index.css):

| Kit literal / token | Meaning | Production token |
|---|---|---|
| `hsl(var(--primary))` | chrome accent | already **jade** (`--primary` = `--accent-jade` = `160 34% 48%`) |
| `hsl(142 71% 45%)` | win / long / positive | `hsl(var(--success))` (`150 64% 46%`) |
| `hsl(0 84% 60%)` | loss / short / negative | `hsl(var(--destructive))` (`0 75% 60%`) |
| `hsl(38 92% 50%)` | warning / elevated | existing warning token (confirm name in plan) |
| `--tl-fg` / `--tl-fg-muted` | text | `--foreground` / `--muted-foreground` |
| `--tl-radius*`, `--tl-shadow*` | radii/shadow | existing radius/shadow tokens / glass tiers |
| session colours (Asia/London/NY) | session pills | keep production `ClockWidget` session palette |

Rationale: keep visual consistency with the already-migrated landing/auth surfaces and
the jade liquid-glass foundation (see §7 design-system foundation in CLAUDE.md). Vivid
P&L semantics stay functional via `--success`/`--destructive`.

## 4. New shared primitives (`artifacts/trader-dashboard/src/components/ui/`)

Four reusable, tokenized primitives, each with a static test. They replace the kit's
inline helpers so widgets compose them instead of duplicating SVG.

### `Sparkline`
- Props: `data: number[]`, `tone?: "success" | "destructive" | "primary"` (default by sign or `primary`), `width?`, `height?`, `className?`.
- Renders area + line SVG; gradient and stroke derive from the chosen token.
- Edge cases: ≤1 point → render nothing or a flat line; identical values → flat line (no divide-by-zero).

### `Gauge`
- Props: `value: number` (0–100, clamped), `width?`, `label?`, `className?`.
- Semicircular speedometer; track + gradient arc (destructive → warning → success) + needle + centered `%`.

### `ProgressRing`
- Props: `value: number` (0–100, clamped), `size?`, `stroke?`, `tone?` (token name), `children?`, `className?`.
- Circular ring with animated `stroke-dashoffset`; centered children for label. Respects `prefers-reduced-motion` (no transition jump when reduced).

### `StatTile`
- Props: `label: string`, `value: ReactNode`, `unit?: string`, `tone?: "default" | "primary" | "success" | "destructive"`, `size?: "md" | "lg"`, `className?`.
- KPI tile composed over the existing glass surface; mono value, muted label.

**CardHeader/iconTone:** the kit uses `CardHeader` with `icon`, `iconTone`, `title`,
`subtitle`, `action`. Production `card.tsx` is shadcn-style. During the plan, decide
**reuse vs. add**: either add a small `CardHeader` helper variant (tonal icon chip +
title/subtitle + action slot) to `card.tsx`, or compose inline per widget. Prefer a
single shared header helper to avoid duplication across 13 widgets — but only if it
fits the existing `card.tsx` API cleanly. No new `SessionBadge` primitive: reuse the
production `ClockWidget` session logic/palette.

## 5. Per-widget migration procedure

For each widget, in order:

1. **Read** the current production component; inventory its real data inputs (props,
   hooks, queries, computed values) and existing i18n keys.
2. **Map** real data onto the kit's visual slots (e.g. live equity series → `Sparkline`
   data; real win-rate → `StatTile` value). Never introduce mock data.
3. **Restyle** the markup to the kit layout using production tokens and the new
   primitives. Keep all event handlers, navigation, gating, and deep-link behaviour.
4. **i18n**: every visible string goes through `t()`. Reuse existing keys; add new keys
   to **all 5 language dictionaries**. No literals to `title`-type props. No `Ã/â/Â/ð`
   in dictionary values (mojibake test) — rephrase if needed (e.g. accents).
5. **Test**: add or update the widget's static test to match new markup; preserve any
   contrast assertions.
6. **Verify**: typecheck + tests green for the widget; visually sanity-check with real data.

## 6. Execution phases (approach A)

1. **Phase 0 — Primitives.** Build `Sparkline`, `Gauge`, `ProgressRing`, `StatTile`
   (+ optional `CardHeader` helper) with tests. Foundation for everything else.
2. **Phase 1 — Banner.** `ClockWidget`.
3. **Phase 2 — KPI.** `JournalWidget`, `BrokerHubWidget`.
4. **Phase 3 — Viz.** `SentimentWidget`, `VolatilityWidget`, `CotWidget`.
5. **Phase 4 — Lists/simple.** `MissionsWidget`, `RoutineWidget`,
   `ChecklistDashboardWidget`, `CalendarWidget`, `TradingViewWatchlistWidget` (chrome
   only), `QuoteWidget`, `LotCalculatorWidget`.
6. **Phase 5 — Gate.** `pnpm verify` green; review whole dashboard with real data.

Each phase is independently verifiable; a widget is "done" only when its data is live
and its tests pass.

## 7. Testing & quality gates

- Static test per new primitive and per restyled widget (mirror existing neighbours).
- `pnpm typecheck` and `pnpm test` green per phase; `pnpm verify` before completion.
- No `@typescript-eslint/no-explicit-any` in non-test source.
- i18n parity + production-copy static tests must stay green.
- Semantic commits: `feat(ui):` for primitives, `refactor:`/`feat(ui):` per widget.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Contrast tests fail on glass surfaces | Use tokens with sufficient contrast; run `*.contrast.static.test.ts` early. |
| i18n mojibake build break | Author keys without `Ã/â/Â/ð`; rephrase accented copy. |
| TradingView widget mismatch | Restyle Card chrome only; do not replace the embed. |
| Duplicated SVG/header markup | Centralize in shared primitives + optional `CardHeader` helper. |
| Hidden behavioural regressions | Preserve handlers/gating verbatim; restyle is presentation-only. |
| Large diff hard to review | Phased per-widget tasks, verify each. |

## 9. Out-of-scope follow-ups (not now)

- Restyling secondary widgets (Leaderboard/Profile/CalendarMissions).
- A non-TradingView fallback watchlist using the kit's sparkline rows.
- Dashboard shell / sidebar / topbar restyle (kit `shell.jsx`).
