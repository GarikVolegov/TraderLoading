# Routine — Claude Design restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Routine page (`/routine`) onto the new Claude Design "Routine & Programmi" template (`templates/routine/RoutineProgrammi.dc.html` in the "TraderLoading Design System" project) — same content and behavior, new visual accents.

**Architecture:** Pure presentational diffs in four existing components. No new files, no state/prop-signature changes, no backend/data changes. A source-scanning static test (`pages/Routine.static.test.ts`, mirroring the `Wiki.static.test.ts` pattern already used for the Archivio Claude Design port) locks in each visual marker as it's added.

**Tech Stack:** React 19 + Tailwind (existing `components/routine/*`), Vitest-free static tests run via `node --import tsx` (project convention — no jsdom needed since these are regex assertions on source text).

## Global Constraints

- **1:1 restyle only** — no section added/removed/reordered, no copy changes, no prop-signature changes (spec §3, user-confirmed). `RoutineWidget.tsx` only imports `SessionModal`/`saveRoutineCompletion` from `pages/Routine.tsx` and storage helpers from `Routine.storage.ts` — none of the four files below — so it is unaffected and needs no changes or re-testing.
- **Scope reduction found during planning:** `pages/Routine.tsx` (header/time-hero/how-it-works/footer) and `components/routine/CreateRoutinePanel.tsx` were audited against the target template and already match the design language (glass cards, existing token classes) close enough that no code change is needed — confirmed in Task 4's verification step instead of being force-changed for the sake of change. The four files below are where a real, visible delta exists.
- **i18n / production-copy gate:** `production-copy.static.test.ts` only flags hardcoded JSX text that appears as `>text<` **on a single source line**. Keep any new/changed literal strings on their own line (as the existing code already does for "Interattivo", "Riavvia", etc.) — do not compress `>text<` onto one line, or the gate will fail. No new copy is introduced by this plan (all changed strings already exist in the current code).
- **No `any`** in non-test source (`@typescript-eslint/no-explicit-any` = error).
- **Lint:** don't leave unused imports/vars after removing the stat-tile icons (Task 2 removes the `Icon`/`color` fields — drop the now-unused `lucide-react` imports in the same step).
- **Commits:** semantic, scoped `feat(ui):`, targeted pathspecs (never `git add -A`).
- **Gate:** `pnpm verify` (install → codegen → typecheck → test → build) green before calling this done (Task 5).

---

## File Structure

- **Modify:** `artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx` — add a 3px accent-color top strip (mirrors the template's `rt-prog-strip`).
- **Modify:** `artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx` — swap the icon+left-aligned tiles for the design system's `StatTile` spec (centered uppercase label over a large mono tabular value, `components/data/StatTile.jsx` in the Claude Design project).
- **Modify:** `artifacts/trader-dashboard/src/components/routine/FriendCompetitionPanel.tsx` — extend the rank-1 gold-crown accent to silver (rank 2) / bronze (rank 3), mirroring the Tornei template's `trn-rk1/2/3` pattern.
- **Modify:** `artifacts/trader-dashboard/src/components/routine/CustomRoutineCard.tsx` — add the same 3px accent strip as `ProgramCard`, for visual consistency between the two card families.
- **Create:** `artifacts/trader-dashboard/src/pages/Routine.static.test.ts` — source-scanning assertions for all four markers above, plus the "no accidental section removal" route/import checks.

---

### Task 1: `ProgramCard` accent strip + static test scaffold

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx:44-62`

**Interfaces:**
- Consumes: nothing new — `ProgramCard` keeps its existing prop signature (`program, label, timeLabel, description, steps, isActive, accentColor, accentClass, borderActiveClass, icon, delay, onStart`).
- Produces: nothing new for other tasks — each task's static-test assertions are independent additions to the same file.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routinePage = readFileSync(new URL("./Routine.tsx", import.meta.url), "utf8");
const programCard = readFileSync(new URL("../components/routine/ProgramCard.tsx", import.meta.url), "utf8");
const statsPanel = readFileSync(new URL("../components/routine/RoutineStatsPanel.tsx", import.meta.url), "utf8");
const friendPanel = readFileSync(new URL("../components/routine/FriendCompetitionPanel.tsx", import.meta.url), "utf8");
const customCard = readFileSync(new URL("../components/routine/CustomRoutineCard.tsx", import.meta.url), "utf8");

// Route/section wiring stays intact (1:1 restyle — nothing removed).
assert.match(routinePage, /<ProgramCard\b/);
assert.match(routinePage, /<RoutineStatsPanel\b/);
assert.match(routinePage, /<FriendCompetitionPanel\b/);
assert.match(routinePage, /<CreateRoutinePanel\b/);
assert.match(routinePage, /<CustomRoutineCard\b/);
assert.match(routinePage, /<SessionModal\b/);

// ProgramCard: accent-color top strip.
assert.match(programCard, /h-\[3px\] w-full shrink-0/);

console.log("routine page static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — `AssertionError` on the `h-\[3px\] w-full shrink-0` match (the strip doesn't exist yet).

- [ ] **Step 3: Add the accent strip**

In `artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx`, the component currently returns (lines 45-62):

```tsx
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className={`relative rounded-3xl border overflow-hidden flex flex-col ${
        isActive ? borderActiveClass : "border-border/35"
      }`}
      style={isActive ? { boxShadow: `0 0 60px -12px ${accentColor}25` } : {}}
    >
      {/* Glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${accentColor}0c 0%, transparent 70%)` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-5 sm:p-6">
```

Insert the strip as the first child, right after the opening `<motion.div ...>` tag and before the `{/* Glow */}` comment:

```tsx
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className={`relative rounded-3xl border overflow-hidden flex flex-col ${
        isActive ? borderActiveClass : "border-border/35"
      }`}
      style={isActive ? { boxShadow: `0 0 60px -12px ${accentColor}25` } : {}}
    >
      {/* Accent strip */}
      <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: accentColor }} />

      {/* Glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${accentColor}0c 0%, transparent 70%)` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-5 sm:p-6">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: PASS — `routine page static checks passed` printed, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): add accent strip to Routine ProgramCard (Claude Design restyle)"
```

---

### Task 2: `RoutineStatsPanel` → StatTile-spec tiles

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx`

**Interfaces:**
- Consumes: `metrics: ReturnType<typeof getRoutineMetrics>` (unchanged prop).
- Produces: nothing new for other tasks.

- [ ] **Step 1: Add the failing assertion**

In `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`, add after the `programCard` assertion:

```ts
// RoutineStatsPanel: centered StatTile-spec tiles (no icon, mono tabular value).
assert.match(statsPanel, /shadow-\[inset_0_1px_0_hsl\(var\(--foreground\)\/0\.04\)\]/);
assert.doesNotMatch(statsPanel, /CheckCircle2/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — the `shadow-[inset_...]` pattern isn't present yet.

- [ ] **Step 3: Rewrite the stats grid**

Replace the full contents of `artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx` with:

```tsx
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { getRoutineMetrics } from "@/pages/Routine.storage";

function formatRoutineDate(value: string | null): string {
  if (!value) return "Mai";
  try {
    return new Date(value).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Dato non valido";
  }
}

export function RoutineStatsPanel({
  metrics,
}: {
  metrics: ReturnType<typeof getRoutineMetrics>;
}) {
  const stats = [
    { label: "Completamenti", value: String(metrics.totalCompletions) },
    { label: "Streak routine", value: `${metrics.currentStreakDays}d` },
    { label: "Routine create", value: String(metrics.customRoutineCount) },
    { label: "Ultima sessione", value: formatRoutineDate(metrics.lastCompletedAt) },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{uiText("auto.ui.4a1b499566")}</p>
          <h2 className="mt-1 text-xl font-bold font-mono tracking-tight">{uiText("auto.ui.8f36b4e767")}</h2>
        </div>
        <p className="text-xs text-muted-foreground/50">{uiText("auto.ui.1932f475b0")}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-border/40 bg-secondary/55 p-2.5 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">{label}</span>
            <span className="font-mono text-lg font-bold tabular-nums tracking-tight">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/25">
        {metrics.byRoutine.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground/50">
            Completa una routine per iniziare a vedere le metriche dettagliate.
          </div>
        ) : (
          metrics.byRoutine.map((routine) => (
            <div
              key={routine.routineId}
              className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{routine.routineTitle}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/45">
                  {routine.template === "morning" ? "Template mattutino" : "Template serale"} · ultima:{" "}
                  {formatRoutineDate(routine.lastCompletedAt)}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                {routine.completions}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}
```

(This drops the now-unused `CheckCircle2`/`Flame`/`Clock`/`Layers` icon imports and the per-metric `icon`/`color` fields — the StatTile spec is icon-free by design, per the approved template §3.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): restyle Routine stats panel onto the StatTile spec (Claude Design restyle)"
```

---

### Task 3: `FriendCompetitionPanel` rank 2/3 accents

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/FriendCompetitionPanel.tsx:1-20`

**Interfaces:**
- Consumes: `rows: RoutineCompetitionEntry[]`, `loading: boolean` (unchanged props).
- Produces: nothing new for other tasks.

- [ ] **Step 1: Add the failing assertion**

In `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`, add:

```ts
// FriendCompetitionPanel: silver/bronze accents for rank 2/3, not just gold rank 1.
assert.match(friendPanel, /RANK_ACCENT/);
assert.match(friendPanel, /slate-300/);
assert.match(friendPanel, /amber-700/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — `RANK_ACCENT` doesn't exist yet.

- [ ] **Step 3: Extend `FriendRankBadge`**

Replace lines 1-20 of `artifacts/trader-dashboard/src/components/routine/FriendCompetitionPanel.tsx` (the imports and `FriendRankBadge` function) with:

```tsx
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import type { RoutineCompetitionEntry } from "@/lib/routineApi";
import { Crown, Trophy, User } from "lucide-react";

const RANK_ACCENT: Record<number, string> = {
  2: "border-slate-300/45 bg-slate-300/15 text-slate-200",
  3: "border-amber-700/45 bg-amber-700/20 text-amber-500",
};

function FriendRankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-yellow-500/45 bg-yellow-500/15 text-yellow-300">
        <Crown className="h-4 w-4" />
      </div>
    );
  }

  const accent = RANK_ACCENT[rank] ?? "border-border/35 bg-background/35 text-muted-foreground";

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${accent}`}>
      <span className="font-mono text-xs font-bold">#{rank}</span>
    </div>
  );
}
```

Everything from `export function FriendCompetitionPanel(...)` onward (currently starting at line 22) stays exactly as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/FriendCompetitionPanel.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): add silver/bronze rank accents to Routine friend leaderboard (Claude Design restyle)"
```

---

### Task 4: `CustomRoutineCard` accent strip + no-op verification

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/CustomRoutineCard.tsx`

**Interfaces:**
- Consumes: `routine: CustomRoutine`, `metric?: ...`, `onStart: () => void` (unchanged props).
- Produces: nothing new.

- [ ] **Step 1: Add the failing assertion**

In `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`, insert this assertion directly above the existing final `console.log("routine page static checks passed");` line (added by Task 1 — leave that line where it is, at the very end of the file):

```ts
// CustomRoutineCard: same accent-strip treatment as ProgramCard, for visual consistency.
assert.match(customCard, /h-\[3px\] w-full/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — the strip pattern isn't in `CustomRoutineCard.tsx` yet.

- [ ] **Step 3: Add the strip, wrapping the existing content**

Replace the full contents of `artifacts/trader-dashboard/src/components/routine/CustomRoutineCard.tsx` with:

```tsx
import { motion } from "framer-motion";
import { getRoutineMetrics, type CustomRoutine } from "@/pages/Routine.storage";
import { Sunrise, Moon, Play } from "lucide-react";

export function CustomRoutineCard({
  routine,
  metric,
  onStart,
}: {
  routine: CustomRoutine;
  metric?: ReturnType<typeof getRoutineMetrics>["byRoutine"][number];
  onStart: () => void;
}) {
  const isMorning = routine.template === "morning";
  const accentColor = isMorning ? "#f59e0b" : "#818cf8";
  const Icon = isMorning ? Sunrise : Moon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-border/30 bg-card/30"
    >
      <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{routine.title}</p>
            <p className="mt-1 text-xs text-muted-foreground/50">
              {routine.timeLabel} · {isMorning ? "mattutina" : "serale"} · {metric?.completions ?? 0} completamenti
            </p>
          </div>
        </div>
        {routine.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground/60">{routine.description}</p>
        )}
        <button
          type="button"
          onClick={onStart}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: accentColor }}
        >
          <Play className="h-4 w-4" />
          Avvia routine
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: PASS — `routine page static checks passed` printed once.

- [ ] **Step 5: Verify the no-op files, manually**

Run:

```bash
grep -n "rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm" artifacts/trader-dashboard/src/pages/Routine.tsx
grep -n "rounded-3xl border border-border/30 bg-card/35" artifacts/trader-dashboard/src/components/routine/CreateRoutinePanel.tsx
```

Expected: both `grep` calls print a matching line — confirming the time-hero card (`Routine.tsx`) and the create-routine panel (`CreateRoutinePanel.tsx`) already use the same glass-card token language as the newly-styled cards, so no change is needed there (this is the scope reduction noted in Global Constraints, verified concretely rather than asserted).

- [ ] **Step 6: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/CustomRoutineCard.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): add accent strip to Routine custom-routine cards (Claude Design restyle)"
```

---

### Task 5: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full local test suite**

Run: `pnpm test`

Expected: all tests pass, including the new `Routine.static.test.ts`, and the pre-existing `Routine.helpers.test.ts` / `Routine.storage.test.ts` / `RoutineWidget.helpers.test.ts` (untouched, still green — confirms `RoutineWidget.tsx` is unaffected).

- [ ] **Step 2: Run the full gate**

Run: `pnpm verify`

Expected: install → codegen → typecheck → test → build all succeed with no errors. Pay attention to:
- No TypeScript errors from the removed `icon`/`color` fields in `RoutineStatsPanel.tsx`'s `stats` array (Task 2).
- No lint errors from unused `lucide-react` imports (`CheckCircle2`, `Flame`, `Clock`, `Layers` were removed from `RoutineStatsPanel.tsx` in Task 2 — confirm no other file in `components/routine/` still imports them for this panel).

- [ ] **Step 3: Manual smoke check**

Start the app locally (`pnpm start:local` or equivalent per [README-BRAIN.md](../../README-BRAIN.md)), open `/routine`, and confirm:
- Morning and evening program cards show the new colored top strip (amber / indigo).
- The stats panel shows 4 centered tiles (label above value, no icons).
- If any friends are seeded in the friend-competition data, ranks 2 and 3 show silver/bronze badges instead of a plain gray `#N` badge.
- Custom routine cards (if any exist) show the same colored top strip.
- Starting/completing a program still works (`SessionModal` untouched — this is the regression check for Task 1/2/3/4 not having touched shared state).

- [ ] **Step 4: Update CLAUDE.md §7**

Add a short entry to `CLAUDE.md` §7 (Active work) noting the Routine Claude Design restyle is done, mirroring the existing "Watchlist widget → native Claude Design rows" entry's format (one paragraph: what shipped, which files, that it followed the archivio/diario/tornei precedent).

- [ ] **Step 5: Final commit**

```bash
git add -- CLAUDE.md
git commit -m "docs(claude): record Routine Claude Design restyle in §7"
```

---

## Self-Review

**Spec coverage:** Every §4 template section from the design spec maps to a task or an explicit no-op verification: header/hero/how-it-works/footer → verified no-op (Task 4 Step 5); program cards → Task 1; stats panel → Task 2; friend competition → Task 3; create-routine panel → verified no-op (Task 4 Step 5); custom routine cards → Task 4; footer quote → part of the verified-no-op `Routine.tsx`.

**Placeholder scan:** No TBD/TODO; every step has complete, exact code and exact commands.

**Type consistency:** `RoutineStatsPanel`'s `stats` array changes from `{ label, value, icon, color }` to `{ label, value }` consistently across Task 2's Step 1 assertion (checks `icon`-derived `CheckCircle2` import is gone) and Step 3 (the full rewritten file). `FriendRankBadge`'s `RANK_ACCENT` map and its consumption are defined together in Task 3 Step 3 — no forward reference to an undefined symbol.
