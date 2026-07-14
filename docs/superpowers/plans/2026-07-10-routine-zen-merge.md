# Routine + Zen merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/routine` to faithfully match `ui_kits/dashboard/views-life.jsx`'s
`RoutineView`+`ZenZone` (Claude Design project "TraderLoading Design System"), removing the
standalone `/zen` hub and folding its breathing + a new mood check-in into Routine.

**Architecture:** Delete the sections the mockup doesn't show (friend leaderboard,
create-custom-routine, custom-routine grid), simplify `ProgramCard`/`RoutineStatsPanel`,
add a new `ZenZone` component (breathing ported verbatim from `Zen.tsx` + a new mood
picker), restyle `SessionModal`'s shell only (guided-session step content is untouched),
and remove every `/zen` reference across routing/nav/command-palette/help-copy.

**Tech Stack:** React 19 + Tailwind, static source-scanning tests (`node --import tsx`,
project convention — no jsdom).

## Global Constraints

- Session-step content (`EmotionQuizStep`, `GoalsStep`, `VisualizationStep`,
  `TradeReviewStep`, `ReflectionStep`, `TomorrowStep`, etc.) is **untouched** — only
  `SessionModal.tsx`'s shell (header, progress bar) changes.
- `recordRoutineCompletion` stays in `lib/routineApi.ts` (used by `RoutineWidget.tsx` too).
  Only `fetchRoutineCompetition`/`routineCompetitionQueryKey`/`RoutineCompetitionEntry` are
  removed (zero callers after this change).
- No backend changes. The `routines/competition` route is left in place, unused.
- `production-copy.static.test.ts` only flags hardcoded `>text<` **on a single source
  line** — keep new literal Italian strings on their own line (existing file convention).
- No `any` in non-test source. Semantic commits, targeted pathspecs (never `git add -A`).
- Gate: `pnpm verify` green before calling this done (final task).

---

## File Structure

- **Create:** `artifacts/trader-dashboard/src/components/routine/ZenZone.tsx` — breathing
  (ported from `Zen.tsx`'s `BreathingExercise`) + a new mood check-in, in a 2-column card.
- **Modify:** `components/routine/ProgramCard.tsx` — simplified per the mockup (44px icon,
  no per-card step pills, single footer row).
- **Modify:** `components/routine/RoutineStatsPanel.tsx` — 4 tiles only (Streak /
  Completate / Mattutine / Serali), no per-routine breakdown list.
- **Modify:** `components/routine/SessionModal.tsx` — shell restyle only.
- **Modify:** `pages/Routine.tsx` — new composition; drops custom-routine creation/display.
- **Modify:** `lib/routineApi.ts` — remove the unused competition-fetch exports.
- **Delete:** `components/routine/FriendCompetitionPanel.tsx`, `CreateRoutinePanel.tsx`,
  `CustomRoutineCard.tsx`.
- **Delete:** `pages/Zen.tsx`, `pages/Zen.hub-tab.static.test.ts`, `lib/zenTabs.ts`,
  `lib/zenTabs.test.ts`, `components/MoodPerformanceInsight.tsx`, `lib/moodPerformance.ts`,
  `lib/moodPerformance.test.ts`.
- **Modify:** `App.tsx`, `components/BottomNav.tsx`, `components/CommandPalette.tsx`,
  `lib/navHubs.ts` (+ `navHubs.test.ts`) — remove all `/zen` wiring; `/routine` takes over
  Zen's old mobile-reachable nav slot.
- **Modify:** `components/settings/HelpSection.tsx`, `lib/i18n/dict.{it,en,es,fr,de}.ts` —
  update the two remaining Zen-as-standalone-feature copy references.
- **Rewrite:** `pages/Routine.static.test.ts` (from the prior, superseded restyle pass) to
  assert the new structure.

---

### Task 1: Build `ZenZone` (breathing ported + new mood check-in)

**Files:**
- Create: `artifacts/trader-dashboard/src/components/routine/ZenZone.tsx`
- Create: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts` (fresh file — the
  prior pass's version is fully superseded)

**Interfaces:**
- Produces: `export function ZenZone(): JSX.Element` — no props, fully self-contained
  (mirrors the mockup's parameterless `ZenZone()`).

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routinePage = readFileSync(new URL("./Routine.tsx", import.meta.url), "utf8");
const zenZone = readFileSync(new URL("../components/routine/ZenZone.tsx", import.meta.url), "utf8");
const programCard = readFileSync(new URL("../components/routine/ProgramCard.tsx", import.meta.url), "utf8");
const statsPanel = readFileSync(new URL("../components/routine/RoutineStatsPanel.tsx", import.meta.url), "utf8");
const sessionModal = readFileSync(new URL("../components/routine/SessionModal.tsx", import.meta.url), "utf8");

// ZenZone: breathing + mood check-in, no Zen-only tabs survive.
assert.match(zenZone, /export function ZenZone/);
assert.match(zenZone, /Respirazione guidata/);
assert.match(zenZone, /Check-in emotivo/);
assert.doesNotMatch(zenZone, /MeditationTimer|MotivationalQuotes|ResultVisualization/);

// Routine page composes ZenZone; the removed sections are gone.
assert.match(routinePage, /<ZenZone/);
assert.doesNotMatch(routinePage, /FriendCompetitionPanel|CreateRoutinePanel|CustomRoutineCard/);

console.log("routine+zen merge static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — `ZenZone.tsx` doesn't exist yet (`ENOENT`).

- [ ] **Step 3: Create `ZenZone.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ChevronRight, Wind, Brain } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Phase = "inspira" | "trattieni" | "espira" | "riposa";

const PHASE_CONFIG: Record<Phase, { duration: number; color: string; ringColor: string }> = {
  inspira:   { duration: 4, color: "text-emerald-400", ringColor: "stroke-emerald-400" },
  trattieni: { duration: 4, color: "text-sky-400",     ringColor: "stroke-sky-400" },
  espira:    { duration: 4, color: "text-amber-400",   ringColor: "stroke-amber-400" },
  riposa:    { duration: 2, color: "text-slate-400",   ringColor: "stroke-slate-400" },
};

const PHASES: Phase[] = ["inspira", "trattieni", "espira", "riposa"];
const CIRCUMFERENCE = 2 * Math.PI * 46;

function BreathingExercise() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("inspira");
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - startTimeRef.current) / 1000;
    const dur = PHASE_CONFIG[phaseRef.current].duration;

    if (dt >= dur) {
      const idx = PHASES.indexOf(phaseRef.current);
      const nextIdx = (idx + 1) % PHASES.length;
      if (nextIdx === 0) setCount((c) => c + 1);
      setPhase(PHASES[nextIdx]);
      setElapsed(0);
      startTimeRef.current = now;
    } else {
      setElapsed(dt);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = performance.now();
      setElapsed(0);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, tick]);

  const config = PHASE_CONFIG[phase];
  const progress = elapsed / config.duration;
  const remaining = Math.ceil(config.duration - elapsed);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const scale = phase === "inspira" ? 1 + progress * 0.25
    : phase === "espira" ? 1.25 - progress * 0.25
    : phase === "trattieni" ? 1.25
    : 1;

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/25 bg-card/25 p-4 text-center">
      <p className="font-mono text-sm font-bold">Respirazione guidata</p>
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" strokeWidth="3" className="stroke-muted-foreground/15" />
          <circle
            cx="50" cy="50" r="46"
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            className={`${config.ringColor} transition-[stroke] duration-500`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={isActive ? dashOffset : CIRCUMFERENCE}
            style={{ transition: "stroke-dashoffset 100ms linear, stroke 500ms" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-border/50 bg-gradient-to-br from-card to-card/60 shadow-lg"
          >
            <span className={`text-sm font-bold ${config.color} transition-colors duration-500`}>
              {t(`zen.breathing.${phase}`)}
            </span>
            {isActive && (
              <span className="mt-0.5 font-mono text-2xl font-bold text-foreground">{remaining}</span>
            )}
          </motion.div>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                p === phase ? `${PHASE_CONFIG[p].ringColor.replace("stroke-", "bg-")} scale-125` : "bg-muted-foreground/20"
              }`}
            />
            {i < PHASES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("zen.breathing.cycles")} <span className="font-semibold text-foreground">{count}</span>
      </p>
      <div className="flex gap-3">
        <Button onClick={() => setIsActive(!isActive)} size="sm" className="min-w-[110px] gap-2">
          {isActive ? <><Pause className="h-4 w-4" /> Pausa</> : <><Play className="h-4 w-4" /> Avvia sessione</>}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setIsActive(false); setPhase("inspira"); setCount(0); setElapsed(0); }}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );
}

const MOODS: [string, string][] = [
  ["😣", "Teso"],
  ["😐", "Neutro"],
  ["🙂", "Calmo"],
  ["😄", "Carico"],
  ["😴", "Stanco"],
];

function MoodCheckIn() {
  const [mood, setMood] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/25 bg-card/25 p-4">
      <div>
        <p className="font-mono text-sm font-bold">Check-in emotivo</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Come ti senti in questo momento?</p>
      </div>
      <div className="grid flex-1 grid-cols-5 gap-2">
        {MOODS.map(([emoji, label]) => {
          const active = mood === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setMood(label)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                active ? "border-primary/45 bg-primary/15" : "border-border/25 bg-background/25"
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-[11px] font-bold ${active ? "text-foreground" : "text-muted-foreground/60"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/50">
        {mood ? (
          <>Umore registrato: <strong className="text-foreground">{mood}</strong></>
        ) : (
          "Il check-in ti aiuta a essere consapevole del tuo stato mentale prima di operare."
        )}
      </p>
    </div>
  );
}

export function ZenZone() {
  return (
    <Card className="border-indigo-400/20 bg-card/35">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="font-mono text-base font-bold">Zona Zen</p>
            <p className="text-xs text-muted-foreground/60">Respira, medita e coltiva la mentalità giusta</p>
          </div>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          Interattivo
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BreathingExercise />
          <MoodCheckIn />
        </div>
      </CardContent>
    </Card>
  );
}
```

Note: `Wind` import is unused by this draft — remove it from the `lucide-react` import line
(keep only `Play, Pause, RotateCcw, ChevronRight, Brain`) to avoid an unused-import lint error.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: still FAIL at this point — `routinePage` doesn't render `<ZenZone` yet (that's
Task 5). Confirm the failure is now *only* about `routinePage`/`<ZenZone`, not about
`zenZone` file content (i.e. the `ZenZone.tsx`-specific assertions pass).

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/ZenZone.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): add ZenZone (breathing + mood check-in) for the Routine+Zen merge"
```

---

### Task 2: Simplify `ProgramCard`

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`

**Interfaces:**
- Produces: `ProgramCard` props shrink to `{ program, label, timeLabel, description,
  totalSteps, isActive, accentColor, accentClass, icon, delay, onStart }` — **removes**
  `steps: SessionStep[]` and `borderActiveClass` (no more per-card step-pill list or a
  separate active-border class; active state now only tints the icon/badge, matching the
  mockup). Callers (Task 5) pass `totalSteps={7}` instead of the full step array.

- [ ] **Step 1: Add the failing assertion**

In `Routine.static.test.ts`, add:

```ts
// ProgramCard: simplified per the mockup — 44px icon, no per-card step-pill list.
assert.match(programCard, /h-11 w-11/); // 44px = h-11/w-11 in Tailwind's 4px scale
assert.doesNotMatch(programCard, /steps\.filter/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — current `ProgramCard.tsx` has `w-12 h-12` (48px) and the `steps.filter(...)` step-pill loop.

- [ ] **Step 3: Rewrite `ProgramCard.tsx`**

```tsx
import { useState, useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { CheckCircle2, RotateCcw, Play } from "lucide-react";
import type { Program } from "./types";
import { loadCompletion } from "./completion";

export function ProgramCard({
  program,
  label,
  timeLabel,
  description,
  totalSteps,
  isActive,
  accentColor,
  accentClass,
  icon: CardIcon,
  delay,
  onStart,
}: {
  program: Program;
  label: string;
  timeLabel: string;
  description: string;
  totalSteps: number;
  isActive: boolean;
  accentColor: string;
  accentClass: string;
  icon: ElementType;
  delay: number;
  onStart: () => void;
}) {
  const [completed, setCompleted] = useState(() => loadCompletion(program));

  useEffect(() => {
    const handler = () => setCompleted(loadCompletion(program));
    window.addEventListener(`tl_routine_${program}_done`, handler);
    return () => window.removeEventListener(`tl_routine_${program}_done`, handler);
  }, [program]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className="flex flex-col gap-3.5 rounded-3xl border border-border/35 p-5"
      style={isActive ? { borderColor: `${accentColor}4d` } : {}}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClass}`}>
          <CardIcon className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base font-bold tracking-tight">{label}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{timeLabel}</p>
        </div>
        {isActive && !completed && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            Attiva
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground/65">{description}</p>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground/50">{totalSteps} step</span>
        {completed ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary/80">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {uiText("auto.ui.15d05cfce6")}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem(`tl_session_${program}_v2`);
                setCompleted(false);
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/35 transition-colors hover:text-muted-foreground/60"
            >
              <RotateCcw className="h-3 w-3" />
              Riavvia
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: accentColor }}
          >
            <Play className="h-3.5 w-3.5" />
            Inizia
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: the two new assertions pass (the file will still fail overall until Task 5 wires
everything together — that's expected; confirm the failure, if any, is unrelated to these
two new lines).

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/ProgramCard.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): simplify ProgramCard per the Claude Design mockup (44px icon, no per-card step list)"
```

---

### Task 3: Simplify `RoutineStatsPanel` (4 tiles, no breakdown list)

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`

**Interfaces:**
- Consumes: new prop shape `{ streakDays: number; totalCompletions: number; morningCount:
  number; eveningCount: number }` (replaces the old `{ metrics: ReturnType<typeof
  getRoutineMetrics> }` — the caller in Task 5 computes these four numbers directly).

- [ ] **Step 1: Add the failing assertion**

```ts
// RoutineStatsPanel: 4 tiles only (Streak/Completate/Mattutine/Serali), no per-routine list.
assert.match(statsPanel, /Mattutine/);
assert.match(statsPanel, /Serali/);
assert.doesNotMatch(statsPanel, /byRoutine/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — current file has no "Mattutine"/"Serali" tiles and does reference `byRoutine`.

- [ ] **Step 3: Rewrite `RoutineStatsPanel.tsx`**

```tsx
import { motion } from "framer-motion";

export function RoutineStatsPanel({
  streakDays,
  totalCompletions,
  morningCount,
  eveningCount,
}: {
  streakDays: number;
  totalCompletions: number;
  morningCount: number;
  eveningCount: number;
}) {
  const stats = [
    { label: "Streak", value: `${streakDays}g` },
    { label: "Completate", value: String(totalCompletions) },
    { label: "Mattutine", value: String(morningCount) },
    { label: "Serali", value: String(eveningCount) },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5"
    >
      <p className="font-mono text-base font-bold tracking-tight">Le tue statistiche</p>
      <p className="mt-0.5 text-xs text-muted-foreground/50">Costanza nella routine</p>

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
    </motion.section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/RoutineStatsPanel.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): simplify RoutineStatsPanel to 4 tiles per the Claude Design mockup"
```

---

### Task 4: Restyle `SessionModal`'s shell

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/routine/SessionModal.tsx:78-128`
- Modify: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`

**Interfaces:** unchanged (`{ program, onClose, onComplete }`) — this task only touches
the header/progress-bar markup, not props, state, or step-rendering logic.

- [ ] **Step 1: Add the failing assertion**

```ts
// SessionModal: single prominent progress bar + "Passo N di M" label (no segmented pills).
assert.match(sessionModal, /Passo \{stepIdx \+ 1\} di \{steps\.length\}/);
assert.doesNotMatch(sessionModal, /Step pills/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — current file has the `{/* Step pills */}` segmented-dots block and shows
`{stepIdx + 1}/{steps.length}` (a bare fraction, not the "Passo N di M" sentence).

- [ ] **Step 3: Replace the top bar + progress bar block**

Replace lines 78-128 of `SessionModal.tsx` (the `{/* Top bar */}` through `{/* Progress
bar */}` divs) with:

```tsx
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-sm font-bold font-mono leading-tight">
              {program === "morning" ? "Programma Mattutino" : "Programma Serale"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Passo {stepIdx + 1} di {steps.length}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center hover:border-border/70 hover:bg-card/40 transition-all"
        >
          <X className="w-4 h-4 text-muted-foreground/60" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[5px] bg-secondary/50 shrink-0 mx-4 sm:mx-6 mt-3 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: accentColor }}
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
```

The rest of the file (step header, step body, bottom nav) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

- [ ] **Step 5: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/routine/SessionModal.tsx artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): restyle SessionModal shell (bigger icon, single progress bar) per RoutinePlayer"
```

---

### Task 5: Rewrite `pages/Routine.tsx`, delete the 3 removed components, trim `routineApi.ts`

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Routine.tsx`
- Modify: `artifacts/trader-dashboard/src/lib/routineApi.ts`
- Delete: `components/routine/FriendCompetitionPanel.tsx`, `CreateRoutinePanel.tsx`,
  `CustomRoutineCard.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Routine.static.test.ts`

**Interfaces:**
- Consumes: `ZenZone()` (Task 1), `ProgramCard({ program, label, timeLabel, description,
  totalSteps, isActive, accentColor, accentClass, icon, delay, onStart })` (Task 2),
  `RoutineStatsPanel({ streakDays, totalCompletions, morningCount, eveningCount })` (Task 3).

- [ ] **Step 1: Add the failing assertions**

```ts
// Removed sections are gone from routineApi.ts too.
const routineApi = readFileSync(new URL("../lib/routineApi.ts", import.meta.url), "utf8");
assert.doesNotMatch(routineApi, /fetchRoutineCompetition|routineCompetitionQueryKey|RoutineCompetitionEntry/);

// Routine.tsx composes the new sections in order and drops custom-routine UI.
assert.match(routinePage, /<ProgramCard\b/);
assert.match(routinePage, /<ZenZone/);
assert.match(routinePage, /<RoutineStatsPanel\b/);
assert.match(routinePage, /<SessionModal\b/);
assert.doesNotMatch(routinePage, /loadCustomRoutines|createCustomRoutine|CreateRoutinePanel|CustomRoutineCard|FriendCompetitionPanel/);

console.log("routine+zen merge static checks passed");
```

(Remember: `readFileSync` calls for `routinePage`/`programCard`/etc. were declared once at
the top of the file in Task 1 — only add the new `routineApi` declaration and these new
assertions above the final `console.log`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL on multiple fronts (old `Routine.tsx` still imports the removed components;
`routineApi.ts` still exports the competition fetch).

- [ ] **Step 3: Trim `lib/routineApi.ts`**

Replace its full contents with:

```ts
import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface RoutineCompletionPayload {
  routineId: string;
  routineTitle: string;
  template: "morning" | "evening";
  answers: Record<string, unknown>;
}

export function recordRoutineCompletion(
  payload: RoutineCompletionPayload,
  options?: RelativeApiOptions,
): Promise<{ id: number; qualityScore: number; completionDate: string }> {
  return apiJSON("routines/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, options);
}
```

- [ ] **Step 4: Delete the 3 removed components**

```bash
git rm -- \
  artifacts/trader-dashboard/src/components/routine/FriendCompetitionPanel.tsx \
  artifacts/trader-dashboard/src/components/routine/CreateRoutinePanel.tsx \
  artifacts/trader-dashboard/src/components/routine/CustomRoutineCard.tsx
```

- [ ] **Step 5: Rewrite `pages/Routine.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { getRoutineStartProgram } from "./Routine.helpers";
import { uiText } from "@/contexts/LanguageContext";
import { getRoutineMetrics, loadCustomRoutines, loadRoutineCompletions } from "./Routine.storage";
import { recordRoutineCompletion } from "@/lib/routineApi";
import { Sunrise, Moon } from "lucide-react";
import type { Program, Answers, ActiveRoutineSession } from "@/components/routine/types";
import { saveRoutineCompletion } from "@/components/routine/completion";
import { MORNING_STEPS, EVENING_STEPS } from "@/components/routine/sessionSteps";
import { SessionModal } from "@/components/routine/SessionModal";
import { ProgramCard } from "@/components/routine/ProgramCard";
import { ZenZone } from "@/components/routine/ZenZone";
import { RoutineStatsPanel } from "@/components/routine/RoutineStatsPanel";

// Re-exported for @/pages/Routine consumers (RoutineWidget).
export { SessionModal };
export type { Program, Answers };
export { saveRoutineCompletion };

export default function Routine() {
  const [activeSession, setActiveSession] = useState<ActiveRoutineSession | null>(null);
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useLocation();
  const [completionHistory, setCompletionHistory] = useState(() => loadRoutineCompletions());

  const refreshRoutineData = useCallback(() => {
    setCompletionHistory(loadRoutineCompletions());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    refreshRoutineData();
    window.addEventListener("storage", refreshRoutineData);
    window.addEventListener("tl_routine_history_updated", refreshRoutineData);
    return () => {
      window.removeEventListener("storage", refreshRoutineData);
      window.removeEventListener("tl_routine_history_updated", refreshRoutineData);
    };
  }, [refreshRoutineData]);

  useEffect(() => {
    const requested = getRoutineStartProgram(location) ?? getRoutineStartProgram(window.location.search);
    if (!requested) return;

    setActiveSession({
      program: requested,
      routineId: requested,
      routineTitle: requested === "morning" ? "Programma Mattutino" : "Programma Serale",
      markDailyProgram: true,
    });
    setLocation("/routine", { replace: true });
  }, [location, setLocation]);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const metrics = getRoutineMetrics(completionHistory, loadCustomRoutines());
  const morningCount = completionHistory.filter((c) => c.template === "morning").length;
  const eveningCount = completionHistory.filter((c) => c.template === "evening").length;

  const startBaseProgram = (program: Program) => {
    setActiveSession({
      program,
      routineId: program,
      routineTitle: program === "morning" ? "Programma Mattutino" : "Programma Serale",
      markDailyProgram: true,
    });
  };

  const handleComplete = (session: ActiveRoutineSession, answers: Answers) => {
    saveRoutineCompletion(session.program, answers, {
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      markDailyProgram: session.markDailyProgram,
    });
    void recordRoutineCompletion({
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      template: session.program,
      answers,
    }).catch(() => {});
    window.dispatchEvent(new Event("tl_routine_history_updated"));
    if (session.markDailyProgram) {
      window.dispatchEvent(new Event(`tl_routine_${session.program}_done`));
    }
    refreshRoutineData();
    setActiveSession(null);
  };

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Routine & Programmi"
          subtitle="Programmi guidati e zona zen per costruire la tua costanza"
          badge={
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              Interattivo
            </span>
          }
        />

        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">Programmi guidati</h2>
          <span className="font-mono text-[11px] text-muted-foreground/60">2 programmi · 7 step ciascuno</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          <ProgramCard
            program="morning"
            label="Programma Mattutino"
            timeLabel="05:00 – 13:00"
            description="7 step interattivi per centrare la mente, caricare l'energia e definire il piano prima di aprire i mercati."
            totalSteps={MORNING_STEPS.length}
            isActive={isMorningActive}
            accentColor="#f59e0b"
            accentClass="bg-amber-500/10 text-amber-400"
            icon={Sunrise}
            delay={0.06}
            onStart={() => startBaseProgram("morning")}
          />
          <ProgramCard
            program="evening"
            label="Programma Serale"
            timeLabel="17:00 – 23:00"
            description="7 step interattivi per analizzare la sessione, decomprimersi e preparare la mente al riposo e al giorno dopo."
            totalSteps={EVENING_STEPS.length}
            isActive={isEveningActive}
            accentColor="#818cf8"
            accentClass="bg-indigo-500/10 text-indigo-400"
            icon={Moon}
            delay={0.12}
            onStart={() => startBaseProgram("evening")}
          />
        </div>

        <ZenZone />

        <RoutineStatsPanel
          streakDays={metrics.currentStreakDays}
          totalCompletions={metrics.totalCompletions}
          morningCount={morningCount}
          eveningCount={eveningCount}
        />

        <p className="text-center text-sm italic text-muted-foreground/30">
          &ldquo;Il trading di successo è il 20% tecnica e l&apos;80% psicologia.&rdquo;
        </p>
      </PageLayout>

      <AnimatePresence>
        {activeSession && (
          <SessionModal
            program={activeSession.program}
            onClose={() => setActiveSession(null)}
            onComplete={(answers) => handleComplete(activeSession, answers)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
```

Note: `uiText` import stays because `ProgramCard.tsx`'s "Completato" label still uses it
internally — but `pages/Routine.tsx` itself no longer calls `uiText()` directly. Remove the
`import { uiText } from "@/contexts/LanguageContext";` line from this file if your editor's
lint flags it as unused (it does become unused here — the badge/quote/subtitle strings are
now inline literals per the mockup, not `uiText()` keys).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: PASS — `routine+zen merge static checks passed`.

- [ ] **Step 7: Commit**

```bash
git add -- artifacts/trader-dashboard/src/pages/Routine.tsx artifacts/trader-dashboard/src/lib/routineApi.ts artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "feat(ui): rewrite Routine page onto the Claude Design mockup, drop custom-routine + leaderboard UI"
```

---

### Task 6: Delete Zen entirely, remove all `/zen` wiring

**Files:**
- Delete: `pages/Zen.tsx`, `pages/Zen.hub-tab.static.test.ts`, `lib/zenTabs.ts`,
  `lib/zenTabs.test.ts`, `components/MoodPerformanceInsight.tsx`, `lib/moodPerformance.ts`,
  `lib/moodPerformance.test.ts`
- Modify: `App.tsx`, `components/BottomNav.tsx`, `components/CommandPalette.tsx`,
  `lib/navHubs.ts`, `lib/navHubs.test.ts`
- Modify: `pages/Routine.static.test.ts`

- [ ] **Step 1: Add the failing assertions**

Add these `readFileSync` declarations near the top of `Routine.static.test.ts`, alongside
the existing ones:

```ts
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const commandPalette = readFileSync(new URL("../components/CommandPalette.tsx", import.meta.url), "utf8");
const navHubs = readFileSync(new URL("../lib/navHubs.ts", import.meta.url), "utf8");
```

Then add the assertions:

```ts
// /zen is gone from routing, nav, command palette, and hubs.
assert.doesNotMatch(app, /pages\/Zen|path="\/zen"/);
assert.doesNotMatch(bottomNav, /href: "\/zen"/);
const rootItemsBlock = bottomNav.slice(bottomNav.indexOf("const ROOT_ITEMS"), bottomNav.indexOf("const SECONDARY_ITEMS"));
assert.match(rootItemsBlock, /href: "\/routine"/, "routine takes over zen's old root-level mobile nav slot");
assert.doesNotMatch(commandPalette, /zen\.title/);
assert.doesNotMatch(navHubs, /ZEN_HUB|\/zen/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts`

Expected: FAIL — all five `/zen` references still exist.

- [ ] **Step 3: Delete the Zen files**

```bash
git rm -- \
  artifacts/trader-dashboard/src/pages/Zen.tsx \
  artifacts/trader-dashboard/src/pages/Zen.hub-tab.static.test.ts \
  artifacts/trader-dashboard/src/lib/zenTabs.ts \
  artifacts/trader-dashboard/src/lib/zenTabs.test.ts \
  artifacts/trader-dashboard/src/components/MoodPerformanceInsight.tsx \
  artifacts/trader-dashboard/src/lib/moodPerformance.ts \
  artifacts/trader-dashboard/src/lib/moodPerformance.test.ts
```

- [ ] **Step 4: `App.tsx`**

Remove the lazy import line:

```ts
const Zen = lazy(() => import("./pages/Zen"));
```

Remove the route line:

```tsx
<Route path="/zen" component={Zen} />
```

- [ ] **Step 5: `components/BottomNav.tsx`**

Replace the `ROOT_ITEMS`/`SECONDARY_ITEMS` declarations (current lines 16-30) with:

```tsx
// Root hubs (level 0). Archivio is a direct hub; Community/Journal are hubs
// that, once entered, swap the bar to their own sub-nav (see navHubs.ts).
const ROOT_ITEMS = [
  { href: "/",         icon: LayoutDashboard, labelKey: "nav.home",      isChat: false },
  { href: "/journal",  icon: BookOpen,        labelKey: "nav.journal",   isChat: false },
  { href: "/backtest", icon: FlaskConical,    labelKey: "nav.backtest",  isChat: false },
  { href: "/routine",  icon: Sunrise,         labelKey: "nav.routine",   isChat: false },
  { href: "/wiki",     icon: Archive,         labelKey: "nav.wiki",      isChat: false },
  { href: "/chat",     icon: Users,           labelKey: "nav.community", isChat: true  },
] as const;

// Desktop-only secondary group (Archivio lives in the root group now).
const SECONDARY_ITEMS = [
  { href: "/library",  icon: Library,  labelKey: "nav.library"  },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;
```

The `Brain` icon import (line 5) becomes unused after this — remove it from the
`lucide-react` import list at the top of the file.

- [ ] **Step 6: `components/CommandPalette.tsx`**

Remove line 18 (`{ href: "/zen", labelKey: "zen.title", ... }`) and change the `/routine`
entry's `keywords` to include the ex-Zen terms:

```ts
{ href: "/routine", labelKey: "nav.routine", icon: Sunrise, keywords: "programma mattutino serale respirazione meditazione umore" },
```

The `Brain` icon import becomes unused — remove it from the `lucide-react` import list.

- [ ] **Step 7: `lib/navHubs.ts`**

Remove the `ZEN_HUB` constant (lines 49-60) and its unused icon imports (`Wind, Clock, Eye,
Heart, BrainCircuit` — keep `Globe, MessageCircle, Radio, Trophy, Award, TrendingUp,
BookOpen, Lightbulb, Target, BarChart3, Calendar`, all still used by `COMMUNITY_HUB`/
`JOURNAL_HUB`). Change:

```ts
export const HUBS: readonly Hub[] = [COMMUNITY_HUB, JOURNAL_HUB, ZEN_HUB];
```

to:

```ts
export const HUBS: readonly Hub[] = [COMMUNITY_HUB, JOURNAL_HUB];
```

- [ ] **Step 8: `lib/navHubs.test.ts`**

Remove the line `assert.equal(matchHub("/zen")?.id, "zen");` and the `zen` constant +
its 2 assertions (`zen.items.length` block), and update:

```ts
assert.equal(HUBS.length, 3, "three hubs registered: community, journal, zen");
assert.deepEqual(
  HUBS.map((h) => h.id).sort(),
  ["community", "journal", "zen"],
);
```

to:

```ts
assert.equal(HUBS.length, 2, "two hubs registered: community, journal");
assert.deepEqual(
  HUBS.map((h) => h.id).sort(),
  ["community", "journal"],
);
```

Also add, next to the existing "flat page" assertions near the top of the file:

```ts
assert.equal(matchHub("/zen"), undefined, "zen no longer exists as a route");
assert.equal(matchHub("/routine"), undefined, "routine has no hub (flat page, absorbed zen's content instead)");
```

- [ ] **Step 9: Run test to verify it passes**

Run:
```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/pages/Routine.static.test.ts
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/lib/navHubs.test.ts
```

Expected: both PASS.

- [ ] **Step 10: Commit**

```bash
git add -- artifacts/trader-dashboard/src/App.tsx artifacts/trader-dashboard/src/components/BottomNav.tsx artifacts/trader-dashboard/src/components/CommandPalette.tsx artifacts/trader-dashboard/src/lib/navHubs.ts artifacts/trader-dashboard/src/lib/navHubs.test.ts artifacts/trader-dashboard/src/pages/Routine.static.test.ts
git commit -m "refactor(nav): remove standalone /zen route, hub, and nav entries (merged into Routine)"
```

---

### Task 7: Update the two remaining Zen-as-standalone-feature copy references

**Files:**
- Modify: `components/settings/HelpSection.tsx:56`
- Modify: `lib/i18n/dict.it.ts`, `dict.en.ts`, `dict.es.ts`, `dict.fr.ts`, `dict.de.ts`
  (the `app_tutorial.slide_zen_community_title`/`_body` keys)

- [ ] **Step 1: `HelpSection.tsx`**

Replace line 56:

```ts
{ keys: ["Zen"], action: "Mood tracking e meditazione" },
```

with:

```ts
{ keys: ["Routine", "→", "Zona Zen"], action: "Respirazione guidata e check-in emotivo" },
```

- [ ] **Step 2: Update the tutorial-slide copy (all 5 languages)**

In `lib/i18n/dict.it.ts`, replace:

```ts
"app_tutorial.slide_zen_community_body": "Zen e' lo spazio mentale; Community e' dove confrontarti con altri trader senza uscire dal flusso dell'app.",
"app_tutorial.slide_zen_community_title": "Zen e Community aiutano disciplina e confronto",
```

with:

```ts
"app_tutorial.slide_zen_community_body": "La Zona Zen dentro Routine e' lo spazio mentale; Community e' dove confrontarti con altri trader senza uscire dal flusso dell'app.",
"app_tutorial.slide_zen_community_title": "Routine e Community aiutano disciplina e confronto",
```

Apply the equivalent English/Spanish/French/German rewording (swap "Zen"/"Zen zone" for
"the Zen zone inside Routine" or that language's equivalent) to the same two keys in
`dict.en.ts`, `dict.es.ts`, `dict.fr.ts`, `dict.de.ts` — keep each language's existing
phrasing style, just relocate "Zen" from a standalone feature to "inside Routine".

- [ ] **Step 3: Run the i18n parity + mojibake static tests**

Run:
```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/lib/i18n/parity.static.test.ts
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/production-copy.static.test.ts
```

Expected: both PASS (no missing keys across languages, no mojibake characters, no new
hardcoded-copy files flagged — `HelpSection.tsx`'s `SHORTCUT_ITEMS` array literal isn't JSX
`>text<` so the hardcoded-copy scan doesn't apply to it, consistent with the file's
existing convention).

- [ ] **Step 4: Commit**

```bash
git add -- artifacts/trader-dashboard/src/components/settings/HelpSection.tsx artifacts/trader-dashboard/src/lib/i18n/dict.it.ts artifacts/trader-dashboard/src/lib/i18n/dict.en.ts artifacts/trader-dashboard/src/lib/i18n/dict.es.ts artifacts/trader-dashboard/src/lib/i18n/dict.fr.ts artifacts/trader-dashboard/src/lib/i18n/dict.de.ts
git commit -m "docs(i18n): update help/tutorial copy to describe Zen as part of Routine, not standalone"
```

---

### Task 8: Full verification gate + manual smoke check + docs

**Files:** `CLAUDE.md` (§7 update).

- [ ] **Step 1: Run the full local test suite**

Run: `pnpm test`

Expected: all tests pass except the pre-existing, unrelated `billing.test.ts` date-edge
failure (confirmed in the prior session — a hardcoded fixture date matching "today"; not
touched by this branch of work). If any *other* test fails, stop and fix before proceeding.

- [ ] **Step 2: Run the full gate**

Run: `pnpm verify`

Expected: install → codegen → typecheck → test → build all succeed. Watch specifically for:
- No leftover references to deleted files (`RoutineCompetitionEntry`, `zenTabs`,
  `MoodPerformanceInsight`, `moodPerformance`) anywhere else in the codebase.
- No unused-import lint errors (`Brain` in `BottomNav.tsx`/`CommandPalette.tsx`, `Wind` in
  `ZenZone.tsx`, `uiText` in `Routine.tsx` if actually unused, `borderActiveClass`/`steps`
  callers of the old `ProgramCard` signature).

- [ ] **Step 3: Manual smoke check**

Start the app locally, and confirm:
- `/routine` shows: header → "Programmi guidati" (2 simplified program cards) → **Zona
  Zen** (breathing + mood check-in) → stats (4 tiles) → footer quote. No friend
  leaderboard, no "crea routine" panel, no custom-routine grid.
- `/zen` returns a 404/not-found (route no longer exists).
- Mobile bottom nav shows a Routine tab in the root bar (where Zen used to be); Zen icon is
  gone.
- Starting a morning/evening session still opens `SessionModal` with the restyled shell
  (bigger icon, single progress bar, "Passo N di M") and the same 7-step flow content as
  before.
- Command palette (Cmd+K): searching "meditazione" or "respirazione" surfaces "Routine"
  (not a broken/missing "Zen" result).

- [ ] **Step 4: Update `CLAUDE.md` §7**

Replace the "Routine → Claude Design restyle (2026-07-10, done)" entry (added in the prior,
superseded pass) with an entry describing the actual shipped state: Routine rebuilt onto
`ui_kits/dashboard/views-life.jsx`'s `RoutineView`+`ZenZone`, `/zen` removed and merged in,
friend-leaderboard/custom-routine UI dropped, `SessionModal` shell restyled. Note the
root-cause lesson (checked the wrong Claude Design folder the first time — `templates/`
instead of `ui_kits/dashboard/`) so a future session doesn't repeat the miss.

- [ ] **Step 5: Final commit**

```bash
git add -- CLAUDE.md
git commit -m "docs(claude): record Routine+Zen merge in §7, supersedes the prior restyle-only entry"
```

## Self-Review

**Spec coverage:** every §4-§6 item in the spec maps to a task — `ZenZone` (Task 1),
`ProgramCard` (Task 2), `RoutineStatsPanel` (Task 3), `SessionModal` shell (Task 4), page
composition + removed components + `routineApi.ts` trim (Task 5), Zen deletion + nav/route
cleanup (Task 6), copy updates (Task 7), gate + docs (Task 8).

**Placeholder scan:** no TBD; every step has exact code or an exact command.

**Type consistency:** `ProgramCard`'s new prop `totalSteps: number` is defined in Task 2
and consumed with `MORNING_STEPS.length`/`EVENING_STEPS.length` in Task 5 — consistent.
`RoutineStatsPanel`'s new props (`streakDays`, `totalCompletions`, `morningCount`,
`eveningCount`) are defined in Task 3 and supplied from `metrics`/`completionHistory`
filters in Task 5 — consistent. `ZenZone()` takes no props in both Task 1 (definition) and
Task 5 (`<ZenZone />` call) — consistent.
