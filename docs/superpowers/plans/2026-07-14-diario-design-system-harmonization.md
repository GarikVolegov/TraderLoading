# Diario hub — design-system harmonization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the four non-overview Journal tabs (Trades, Idee, Obiettivi, Recap) onto the Claude Design system primitives the Panoramica already uses, move "Nuovo Trade" into the page header, and verify every flow live.

**Architecture:** Presentational refactor of `pages/Journal.tsx` (single file, four tab components) + a small URL-driven modal change; new i18n keys in all 5 dicts; static tests first, then a live Playwright drive. No data/logic/routing change.

**Tech Stack:** React 19, Tailwind 4, DS primitives (`Card`/`CardHeader`/`CardContent`, `StatTile`, `Progress`, `Badge`), wouter, TanStack Query, Playwright driver.

## Global Constraints

- **Preserve driver selectors** (`scripts/verify-usability/drive-journal.mjs`): trade cards and idea/goal rows MUST keep the `group` class; the "Nuovo Trade" button MUST keep accessible name "Nuovo Trade"; the "Aggiungi" button name stays; idea/goal inputs keep placeholders `journal.add_idea` / `journal.add_goal`; delete buttons keep a `lucide-trash-2` icon.
- **i18n gate** ([[i18n-enforced-new-ui]]): every new copy string via `t()`/`uiText()`, keys added to `dict.{it,en,es,fr,de}.ts`; no mojibake chars `Ã/â/Â/ð` ([[i18n-mojibake-test]]).
- **No `any`** in non-test source; TS strict. Semantic commits with scope, explicit pathspec (never `git add -A`).
- **DS language:** `Card`→`CardHeader`(icon `text-primary`/accent + title `text-sm font-semibold` + subtitle `text-xs text-muted-foreground` + optional `action`/`Badge`)→`CardContent`; `StatTile` for metrics; `Progress` for bars; `Badge` for chips; row lists = `border-t border-border/20 px-4 py-3` inside a `Card`. No `rounded-2xl bg-card/60 backdrop-blur-sm`, no local `StatCard`.
- **Do not touch** `JournalOverview.tsx` (Panoramica already faithful).

---

### Task 1: RecapTab onto DS + drop local StatCard

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Journal.tsx` (`RecapTab` ~782-1101, delete `StatCard` ~1103-1113)
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.{it,en,es,fr,de}.ts` (new card-header keys)
- Test: `artifacts/trader-dashboard/src/pages/Journal.recap-ds.static.test.ts` (new)

**Interfaces:**
- Consumes: `StatTile` from `@/components/ui/StatTile`; `Card`/`CardHeader`/`CardContent` from `@/components/ui/card`; existing `journal.*` keys.
- Produces: none (self-contained tab).

- [ ] **Step 1 — failing test.** Create `Journal.recap-ds.static.test.ts` asserting: `Journal.tsx` imports `StatTile`; contains no `function StatCard`; `RecapTab` region has no `rounded-2xl bg-card/60 backdrop-blur-sm`; new keys `journal.recap.stats_title`, `journal.recap.breakdown_title` (etc.) exist in `dict.it.ts`.
- [ ] **Step 2 — run, expect FAIL** (`pnpm --filter trader-dashboard test Journal.recap-ds`).
- [ ] **Step 3 — implement.** In `RecapTab`: replace the four `<StatCard>` with `<StatTile label value tone>` (Totale→default, Win→success, Loss→destructive, BE→default; value as string). Wrap win-rate, daily-breakdown, top-tags, and recap-editor panels in `Card`/`CardHeader`(+icon)/`CardContent`. Delete the `StatCard` function. Keep all charts/logic. Add new header keys to all 5 dicts.
- [ ] **Step 4 — run, expect PASS**; also run `Journal.recap.static.test.ts` (must still pass).
- [ ] **Step 5 — commit** (`fix(journal): RecapTab onto DS primitives` — pathspec: Journal.tsx + 5 dicts + new test).

### Task 2: IdeasTab (Idee + Obiettivi) onto DS

**Files:**
- Modify: `pages/Journal.tsx` (`IdeasTab` ~313-769)
- Modify: `lib/i18n/dict.{it,en,es,fr,de}.ts` (header title/subtitle keys for idee/obiettivi)
- Test: `pages/Journal.ideas-ds.static.test.ts` (new)

**Interfaces:**
- Consumes: `CardHeader`, `Badge`, `Lightbulb`/`Target` icons (already imported).
- Produces: none.

- [ ] **Step 1 — failing test.** Assert the list region uses a `CardHeader`, keeps the `group` class on item rows, keeps placeholders bound to `journal.add_idea`/`journal.add_goal`, and new keys `journal.ideas.list_title`/`journal.goals.list_title` (+subtitles) exist.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement.** Add a `CardHeader` above the item list (icon Lightbulb/Target + title + subtitle + count `Badge`). Convert item rows to DS tokens; keep `group` class, all goal controls (deadline/reminder/cadence/recurrence/ICS export), and use `Badge` for importance/cadence/recurrence chips. Add `aria-label` (via `uiText("common.delete")`) to the icon-only trash button. Add keys to all 5 dicts.
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** (`fix(journal): IdeasTab onto DS primitives`).

### Task 3: TradesTab tokens + move "Nuovo Trade" to page header (URL-driven modal)

**Files:**
- Modify: `pages/Journal.tsx` (`TradesTab` ~131-311, `Journal` default export ~1115-1143)
- Test: `pages/Journal.header-newtrade.static.test.ts` (new)

**Interfaces:**
- Consumes: `PageHeader` `action` slot; `useSearch()` from wouter (already imported).
- Produces: URL `?t=trades&new=1` opens the modal.

- [ ] **Step 1 — failing test.** Assert: `Journal` default export renders `<PageHeader ... action={` with a "Nuovo Trade" button that navigates to `/journal?t=trades&new=1`; `TradesTab` opens its modal from a `useSearch()`-keyed effect (not `useEffect(..., [])` reading `window.location`); the in-tab duplicate "Nuovo Trade" button is gone; trade cards keep `className` containing `group`.
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement.** (a) In `Journal`, pass `action={<Button onClick={() => navigate('/journal?t=trades&new=1')}>Nuovo Trade</Button>}` to `PageHeader`. (b) In `TradesTab`, replace the mount-only `new=1` effect with one keyed on `useSearch()`: when `new=1`, open modal + `navigate('/journal?t=trades', {replace:true})`. (c) Remove the in-tab "Nuovo Trade" button (keep `CsvImportButton`). (d) Wrap trade cards in DS tokens, keep `group` + `lucide-trash-2` + existing `aria-label`.
- [ ] **Step 4 — run, expect PASS**; run `Journal.hub-tab.static.test.ts` + `Journal.cardActionsA11y.static.test.ts` (must still pass).
- [ ] **Step 5 — commit** (`fix(journal): Nuovo Trade in page header + TradesTab DS tokens`).

### Task 4: Live verification

**Files:**
- Modify: `scripts/verify-usability/drive-journal.mjs` (extend to open modal from header + assert each tab renders DS)

- [ ] **Step 1 — extend driver.** After sign-in, go to `/journal?t=panoramica`, click header "Nuovo Trade", assert modal opens (cross-tab). Keep existing idea/goal/image/cleanup flow. Add a screenshot per tab (trades/idee/obiettivi/recap/panoramica).
- [ ] **Step 2 — run app + driver.** Start local dev (DB+API+frontend), run `node scripts/verify-usability/drive-journal.mjs`, confirm 0 `alta` findings + review screenshots.
- [ ] **Step 3 — fix any regression** surfaced (selector drift, broken flow) and re-run until clean.

### Task 5: Gate + review + wrap-up

- [ ] **Step 1 — adversarial self-review** of the full diff (a11y regressions, lost functionality, i18n parity, driver-selector drift).
- [ ] **Step 2 — gate:** `pnpm verify` green (typecheck + test + build).
- [ ] **Step 3 — commit** any review fixes (pathspec) + **push** the branch.
- [ ] **Step 4 — update** CLAUDE.md §7 + memory.

## Self-Review

- **Spec coverage:** header move → Task 3; TradesTab → Task 3; IdeasTab → Task 2; RecapTab + StatCard removal → Task 1; i18n → Tasks 1-2; live verify → Task 4; gate → Task 5. ✓
- **Placeholders:** none — each task names exact files, invariants, and the concrete DS mapping.
- **Type consistency:** `StatTile` tones limited to default/primary/success/destructive (BE→default). `navigate('/journal?t=trades&new=1')` matches `TradesTab`'s `new=1` read. ✓
