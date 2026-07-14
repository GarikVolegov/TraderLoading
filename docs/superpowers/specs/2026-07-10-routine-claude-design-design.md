# Routine ("Routine & Programmi") — Claude Design implementation

**Date:** 2026-07-10
**Status:** Approved (design phase)
**Branch:** `feat/community-management` (long-lived multi-feature branch; coordinate before merge)

## 1. Goal

Restyle the existing Routine page (`/routine`) onto a new Claude Design template,
**"Routine & Programmi"**, following the same "mockup → real page" process already used for
Archivio, Diario, Auth and Tornei. This is a **1:1 visual restyle**: every section, every
data source, and every interaction stays exactly as it is today — only the markup/CSS
changes to the design system's glass/aurora visual language. No new features, no removed
sections, no copy changes (i18n keys stay as-is).

## 2. Source of truth

- **Target design (to be created in this pass):** Claude Design project
  "TraderLoading Design System" (`831a2631-…`), new `templates/routine/RoutineProgrammi.dc.html`
  + `data.js`, `@template name="Routine & Programmi"`. Modeled on the existing
  `templates/notizie-macro/` (glass card idiom, segmented pills, chip filters) and
  `templates/tornei/` (rank-accent rows, density prop, multi-section page) templates already
  in the same project.
- **Existing page:** [artifacts/trader-dashboard/src/pages/Routine.tsx](../../../artifacts/trader-dashboard/src/pages/Routine.tsx)
  (294 lines) + [components/routine/](../../../artifacts/trader-dashboard/src/components/routine/)
  (`ProgramCard`, `RoutineStatsPanel`, `FriendCompetitionPanel`, `CreateRoutinePanel`,
  `CustomRoutineCard`, `SessionModal` + step components).
- **Existing data/logic (untouched):** [pages/Routine.storage.ts](../../../artifacts/trader-dashboard/src/pages/Routine.storage.ts),
  [pages/Routine.helpers.ts](../../../artifacts/trader-dashboard/src/pages/Routine.helpers.ts),
  `lib/routineApi.ts`, `components/routine/completion.ts`, `components/routine/sessionSteps.ts`,
  `components/routine/types.ts`.

Routine's friend-competition endpoint is off-contract (direct `apiJSON`, like tornei/journal
recaps) — no `pnpm codegen` impact.

## 3. Approved decisions

| Decision | Choice |
|---|---|
| **Scope** | 1:1 restyle only (user-confirmed) — no layout rethink, no section merges/removals. |
| **Template name** | "Routine & Programmi" (Italian display name, matching the "Notizie Macro"/"Tornei" naming convention). |
| **Morning/evening accent colors** | Kept bespoke (amber `#f59e0b` / indigo `#818cf8`), driven by CSS custom properties like the Tornei template's `--dc`/`--rk` accent pattern — **not** the `SessionBadge` component, whose hues are reserved for Asia/London/NY/closed trading-session meaning. |
| **Stats tiles** | Match `components/data/StatTile.jsx` spec exactly (centered label + mono tabular value, `--tl-radius-lg`, `--tl-shadow-inset-top` raised surface). |
| **Friend leaderboard rows** | Rank-accent coloring reuses the Tornei template's `trn-rk1/2/3` gold/silver/bronze pattern for ranks 1–3, neutral for the rest. |
| **Styling port target** | Same as Archivio/Diario: port the template's *structure* onto the app's existing design system — `components/ui/*` primitives, Tailwind, `--tl-*`/glass tokens already in `index.css` — not a literal copy of the `.dc.html` raw CSS. |

## 4. Template structure (`templates/routine/RoutineProgrammi.dc.html`)

Mirrors the `notizie-macro`/`tornei` scaffold: `helmet` with `ds-base.js` + `support.js`
(shared runtime, copied verbatim) + a new `data.js` mock (`window.ROUTINE = {...}`), props
`tema` (aurora/nebula/ember/abyss/carbon) and `densita` (comoda/compatta, Tornei-style).

Sections, each a restyle of the current page section with identical content:

1. **Header** — title "Routine & Programmi" + subtitle + "Interattivo" badge (`tl-rise` pattern).
2. **Time hero** — glass card, mono clock + date, morning/evening "sessione attiva" pill
   (bespoke amber/indigo, tokenized).
3. **How-it-works strip** — 4 small glass tiles (icon + label + desc): quiz emotivo,
   respirazione, gratitudine, checklist.
4. **Program cards (Mattutino/Serale)** — glass cards with an accent strip (`nm-strip`-style)
   in amber/indigo, step-pill preview, "Inizia programma" CTA, active-state glow + "Attivo ora"/
   "✓ Completato" pills.
5. **Stats panel** — `StatTile`-style grid (completamenti, streak, routine create, ultima
   sessione) + a per-routine breakdown list.
6. **Friend competition** — leader callout + ranked rows (avatar, name, streak, quality %,
   score), rank-accent coloring for top 3.
7. **Create-routine panel** — collapsible glass panel, same form fields (title, description,
   template, timeLabel).
8. **Custom routine cards** — grid of glass cards + dashed-border empty state (matching
   `notizie-macro`'s empty-state pattern).
9. **Footer quote** — unchanged, italic centered.

## 5. Porting plan (implementation phase)

Pure CSS/markup restyle, in place:

- `pages/Routine.tsx` — swap Tailwind classes/inline styles for the new visual language;
  keep all state, effects, handlers, and the `SessionModal` wiring untouched.
- `components/routine/ProgramCard.tsx`, `RoutineStatsPanel.tsx`, `FriendCompetitionPanel.tsx`,
  `CreateRoutinePanel.tsx`, `CustomRoutineCard.tsx` — restyle only; props/signatures unchanged
  so `RoutineWidget.tsx` (dashboard widget, already restyled separately per
  `2026-06-28-dashboard-widgets-claude-design`) keeps working without changes.
- `SessionModal.tsx` + step components (`EmotionQuizStep`, `BreathingStep`, `GratitudeStep`,
  `ChecklistStep`, `GoalsStep`, `VisualizationStep`, `TradeReviewStep`, `ReflectionStep`,
  `TomorrowStep`, `CompleteStep`) — **out of scope for this pass** (already interactive,
  session-modal restyle would be a separate follow-up if wanted).
- `Routine.storage.ts`, `Routine.helpers.ts`, `lib/routineApi.ts`, `completion.ts`,
  `sessionSteps.ts`, `types.ts` — untouched (pure data/logic).

## 6. Quality gates

- **i18n**: no new copy; existing `uiText()` keys stay wired to the same strings. If a class
  restyle needs a literal string it must go through `uiText()` with keys added to all 5
  languages (parity test, no mojibake).
- **Existing tests**: `Routine.helpers.test.ts`, `Routine.storage.test.ts` untouched (pure
  logic, unaffected by restyle). Any `*.static.test.ts` for Routine/BottomNav asserting specific
  class names must be updated to match, not deleted.
- **Gate**: `pnpm verify` (install → codegen → typecheck → test → build) green before done.
- **Lint**: no `any` in non-test source; semantic commit scopes (`feat(ui):`).

## 7. Out of scope (YAGNI)

- No layout rethink or section merge (user-confirmed 1:1 restyle).
- No `SessionModal`/step-component restyle (separate follow-up if desired).
- No backend/API changes — Routine's data flow is unchanged.
- No route/i18n-key renames.
