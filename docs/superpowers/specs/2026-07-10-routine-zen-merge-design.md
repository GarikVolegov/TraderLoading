# Routine + Zen merge — Claude Design implementation

**Date:** 2026-07-10
**Status:** Approved (design phase)
**Branch:** `feat/community-management` (long-lived multi-feature branch; coordinate before merge)

## 1. Goal

Supersede the 2026-07-10 "Routine restyle" (accent-strip/StatTile/rank-color diff — see
[2026-07-10-routine-claude-design-design.md](2026-07-10-routine-claude-design-design.md))
with a faithful port of the *actual* Claude Design mockup for this page: `RoutineView` +
`ZenZone` in `ui_kits/dashboard/views-life.jsx` (Claude Design project "TraderLoading
Design System", `831a2631-…`), found only after the first pass was rejected as "not
extracted." That mockup composes Routine and Zen into a single page — the `/zen` hub is
removed and its breathing + mood check-in are absorbed into a new `ZenZone` section inside
`/routine`. See [[claude-design-port-fidelity]] for the root-cause lesson this spec corrects.

## 2. Source of truth

- **Target design:** `ui_kits/dashboard/views-life.jsx`, `RoutineView()` + `ZenZone()`
  (React/JSX mockup against a `window.DS` component kit — read for composition/section
  structure, not copied verbatim; port onto the app's real `components/ui/*` + Tailwind,
  same convention as the archivio/diario/tornei/auth ports).
- **Existing page:** [artifacts/trader-dashboard/src/pages/Routine.tsx](../../../artifacts/trader-dashboard/src/pages/Routine.tsx),
  `components/routine/*`.
- **Existing Zen page (removed):** [artifacts/trader-dashboard/src/pages/Zen.tsx](../../../artifacts/trader-dashboard/src/pages/Zen.tsx)
  (435 lines, 6 tabs: breathing, meditation, visualization, quotes, gratitude, insight).
- **Nav:** `lib/navHubs.ts`, `components/BottomNav.tsx`, `components/CommandPalette.tsx`,
  `App.tsx`.

## 3. Approved decisions

| Decision | Choice |
|---|---|
| **Sections not in the mockup** (friend leaderboard, create-custom-routine panel, custom routine cards) | **Removed** from Routine — the page becomes exactly what the mockup shows: guided programs + Zen zone + stats. |
| **Zen's 4 tabs not in `ZenZone`** (meditation, visualization, quotes, insight/mood-performance) | **Removed entirely** — only breathing + a simple mood check-in survive, folded into `ZenZone`. |
| **Guided session wizard** (`SessionModal` + 10 step components: emotion-quiz, breathing, gratitude, visualization, checklist, goals, complete, trade-review, reflection, tomorrow) | **Kept as-is, functionally** — real, tested, trading-specific content is richer than the mockup's generic 7-step `RoutinePlayer`. Only the shell (progress bar, card wrapper, Indietro/Continua/Fine buttons) gets restyled to the `RoutinePlayer`'s visual language. |
| **`recordRoutineCompletion`** | Stays (still used by `RoutineWidget.tsx` and needed to persist completions for streak/stats). |
| **`fetchRoutineCompetition` / `routineCompetitionQueryKey` / `RoutineCompetitionEntry`** | Removed from `lib/routineApi.ts` — zero callers once `FriendCompetitionPanel` is deleted (verified: `RoutineWidget.tsx` doesn't use them either). |
| **Backend `routines/competition` endpoint** | Left in place, untouched — out of scope; frontend simply stops calling it. |
| **Styling port target** | Same as prior Claude Design ports: the app's `components/ui/*`, Tailwind, `--tl-*`/glass tokens — not a literal copy of the mockup's inline `style={{...}}` props. |

## 4. New page structure (`pages/Routine.tsx`)

1. **Header** — `PageHeader` title "Routine & Programmi", subtitle "Programmi guidati e
   zona zen per costruire la tua costanza", badge "Interattivo" (unchanged component,
   already matches the mockup's `TopBar`).
2. **"Programmi guidati"** — section label + count ("2 programmi · 7 step ciascuno"), then
   a 2-column grid of a **simplified `ProgramCard`**: 44px icon box (was 48px), label +
   time range, "Attiva" badge when in-session-window, description, footer row
   (`{steps} step` label + "Inizia" button) — **no per-card step-pill list** (that moves to
   one shared row below both cards, per the mockup's "Ogni programma include" chip strip
   reusing the existing 4-icon `ROUTINE_STEPS` glyphs).
3. **`ZenZone`** (new component, `components/routine/ZenZone.tsx`) — a card with a header
   ("Zona Zen" / "Respira, medita e coltiva la mentalità giusta" / badge "Interattivo") and
   a 2-column body:
   - **Left: guided breathing** — idle state shows a glowing circle + "Respirazione
     guidata" + "Avvia sessione"; clicking swaps in the same box-breathing animation
     `BreathingStep` already used inside `Zen.tsx` (4-phase circle scale animation,
     4-4-4-4, 3 cycles) + a "Termina" button. This is a straight port of `Zen.tsx`'s
     existing `BreathingExercise` visual (self-contained, no persistence), not new logic.
   - **Right: mood check-in** — 5 emoji buttons (😣 Teso · 😐 Neutro · 🙂 Calmo · 😄 Carico ·
     😴 Stanco), client-side-only selection (no backend write — the mockup's "correlato alle
     performance nel diario" copy is *not* ported since the mood-performance correlation
     feature (`insight` tab) is being removed; the panel is a lightweight self-reflection
     widget, matching the mockup's actual (non-wired) behavior).
4. **Stats** — a card with 4 `StatTile`-equivalent tiles (Streak / Completate / Mattutine /
   Serali) computed from `getRoutineMetrics()` (already available: `currentStreakDays`,
   `totalCompletions`, and morning/evening completion counts derived from
   `metrics.byRoutine`). Drops the current per-routine breakdown list (not in the mockup).
5. **Footer quote** — unchanged.

Removed entirely: the "how it works" 4-icon strip becomes the shared step-chip row inside
section 2 (not a separate section anymore, per the mockup), `RoutineStatsPanel`'s detailed
list, `FriendCompetitionPanel`, `CreateRoutinePanel`, `CustomRoutineCard` + the custom-
routines grid and its empty state.

## 5. `SessionModal` restyle (shell only)

`components/routine/SessionModal.tsx` (248 lines) keeps its exact step-rendering logic and
the 10 step components untouched. Restyle only:
- Progress bar: thin rounded bar, accent-colored fill, width = `step / (total - 1) * 100%`
  (mirrors `RoutinePlayer`'s `pct` calc) — replace whatever progress indicator exists today
  with this exact treatment if it differs.
- Header row: 40px accent icon box + title + "Passo N di M" subtitle + a close (X) button,
  matching `RoutinePlayer`'s header.
- Footer nav: "Indietro" (ghost, disabled on step 0) / "Continua" (primary, disabled per
  step validation) / "Fine" (primary, last step) — same three-button footer as
  `RoutinePlayer`.

## 6. Zen removal

- **Delete:** `pages/Zen.tsx`, `pages/Zen.hub-tab.static.test.ts`, `lib/zenTabs.ts`,
  `lib/zenTabs.test.ts`, `components/MoodPerformanceInsight.tsx`, `lib/moodPerformance.ts`,
  `lib/moodPerformance.test.ts` (verified zero other callers via grep).
- **`App.tsx`** — remove the `Zen` lazy import and `<Route path="/zen" component={Zen} />`.
- **`components/BottomNav.tsx`** — remove the `/zen` entry from `ROOT_ITEMS` (mobile tab +
  desktop root icon).
- **`components/CommandPalette.tsx`** — repoint the `/zen` command (`zen.title`, Brain
  icon) to `/routine` instead of deleting it outright (users searching "respirazione" /
  "meditazione" / "umore" should still land somewhere relevant — repointing is safer than a
  dead command).
- **`lib/navHubs.ts` (+ `navHubs.test.ts`)** — remove the `ZEN_HUB` entry and its
  `matchHub("/zen")` coverage. `/routine` stays a flat (non-hub) route — the mockup's
  Routine page has no internal tab structure to promote to a hub.
- **i18n:** `zen.*` keys become orphaned (left in the dict — harmless, not enforced by the
  parity test; not worth a 5-language cleanup pass for this change). The `app_tutorial`
  slide and `HelpSection` copy that reference "Zen" as a standalone feature get updated to
  describe it as part of Routine (small copy edits, still through `uiText()`).

## 7. Quality gates

- **i18n**: no removed key may still be referenced (`production-copy.static.test.ts`'s
  "every literal `t()`/`uiText()` key must exist" check only fails on *missing* keys, not
  orphaned ones — safe either way, but double-check no surviving file still calls a key
  that lived only in a deleted component).
- **Tests**: delete `Zen.hub-tab.static.test.ts` and `zenTabs.test.ts` with their source;
  update `navHubs.test.ts`; rewrite `Routine.static.test.ts` (from the prior restyle pass)
  to match the new structure — assert `ZenZone` renders, assert `FriendCompetitionPanel`/
  `CreateRoutinePanel`/`CustomRoutineCard` are no longer imported, assert `/zen` is gone
  from `App.tsx`/`BottomNav.tsx`/`navHubs.ts`.
- **Unit tests**: no change needed to `Routine.helpers.ts`/`Routine.storage.ts` — both stay
  pure and untouched. Morning/Serali stat-tile counts are computed inline in `Routine.tsx`
  from the already-loaded `completionHistory` array (`completionHistory.filter(c =>
  c.template === "morning").length` / `"evening"`), not from `getRoutineMetrics().byRoutine`
  (which groups by `routineId`, not template, and would double-count custom routines still
  present in a user's local storage from before this change).
- **Gate**: `pnpm verify` (install → codegen → typecheck → test → build) green.
- **Lint**: no `any` in non-test source; semantic commit scopes (`feat(ui):`, `refactor(nav):`).

## 8. Out of scope (YAGNI)

- No backend changes (the `routines/competition` route is left in place, unused).
- No i18n dict cleanup pass for orphaned `zen.*`/routine-leaderboard keys.
- No change to the 10 step components' content/logic (goals, visualization, trade-review,
  reflection, tomorrow stay exactly as they are — only `SessionModal`'s shell is restyled).
- No revival of `templates/routine/RoutineProgrammi.dc.html` (the mockup I authored on the
  first, rejected pass) — `ui_kits/dashboard/views-life.jsx` is the actual source of truth
  going forward; the `.dc.html` template stays in the Claude Design project unused/stale
  (not deleted from there — out of scope for a code-side spec).
