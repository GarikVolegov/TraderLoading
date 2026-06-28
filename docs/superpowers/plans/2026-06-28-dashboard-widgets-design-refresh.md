# Dashboard Widgets — Design Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Claude Design dashboard kit's visual language onto the 13 real production dashboard widgets, keeping every widget fully functional.

**Architecture:** First build four tokenized shared primitives (`Sparkline`, `Gauge`, `ProgressRing`, `StatTile`) plus a `WidgetHeader` helper in `components/ui/`. Then restyle each widget to compose them, **preserving all data wiring, handlers, i18n keys, gating, and static-test invariants** — restyle is presentation-only. Production widgets are richer than the kit mocks; the kit is the visual target, not a functional replacement.

**Tech Stack:** React 19, TypeScript (strict), Tailwind 4, shadcn-style `components/ui`, Vitest static tests, `cn` from `@/lib/utils`, Lucide icons.

## Global Constraints

- **No raw HSL literals** in new code — colors resolve through tokens: `hsl(var(--primary))` (jade chrome), `hsl(var(--success))` (win/long/positive), `hsl(var(--destructive))` (loss/short/negative), `hsl(var(--warning))` (elevated). Tailwind utilities `text-success`/`bg-success`/`text-destructive`/`text-warning` are available.
- **`@typescript-eslint/no-explicit-any` = error** in non-test source. TS strict on.
- **i18n key parity:** every key in `DICT.it` must exist in all 5 language dicts (`production-copy.static.test.ts` enforces it). When adding a key, add it to **all** languages in `lib/i18n.ts`. No `Ã/â/Â/ð` in dict values (`i18n.parity.static.test.ts`).
- **Preserve existing copy & keys** in already-shipped widgets — do not convert existing strings/keys; only restructure markup around them, to avoid i18n-test churn.
- **Preserve static-test invariants:** each widget's `*.static.test.ts` asserts specific source patterns (hooks, `stopPropagation`, aria keys). Keep those patterns; update the test only where markup it asserts genuinely moves.
- **Layout untouched:** `Dashboard.tsx` registry, masonry, edit mode, `id:` ordering stay. ClockWidget stays a full-width banner.
- **pnpm only.** Toolchain may need PATH export (`export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`).
- **Commits:** semantic, scoped (`feat(ui):`, `refactor:`). Run from repo root.
- Paths below are relative to `artifacts/trader-dashboard/src/` unless absolute.

---

## Phase 0 — Shared primitives

### Task 1: `Sparkline` primitive

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/Sparkline.tsx`
- Test: `artifacts/trader-dashboard/src/components/ui/Sparkline.static.test.ts`

**Interfaces:**
- Produces: `Sparkline({ data: number[], tone?: "success" | "destructive" | "primary", width?: number, height?: number, className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`components/ui/Sparkline.static.test.ts`:
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./Sparkline.tsx", import.meta.url), "utf8");

// Token discipline: no raw kit HSL literals.
assert.equal(src.includes("142 71% 45%"), false, "no raw success HSL");
assert.equal(src.includes("0 84% 60%"), false, "no raw destructive HSL");
// Uses tokenized stroke colors.
assert.match(src, /var\(--success\)/);
assert.match(src, /var\(--destructive\)/);
assert.match(src, /var\(--primary\)/);
// Renders an SVG path.
assert.match(src, /<path/);
// Guards a degenerate range (no divide-by-zero).
assert.match(src, /\|\| 1/);
console.log("Sparkline static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/Sparkline.static.test.ts`
Expected: FAIL (file `./Sparkline.tsx` does not exist).

- [ ] **Step 3: Write minimal implementation**

`components/ui/Sparkline.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_VAR: Record<"success" | "destructive" | "primary", string> = {
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  primary: "hsl(var(--primary))",
};

export interface SparklineProps {
  data: number[];
  tone?: "success" | "destructive" | "primary";
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  tone = "primary",
  width = 96,
  height = 28,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const color = TONE_VAR[tone];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / (max - min || 1)) * (height - 4),
  ]);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = React.useId();
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("block", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/Sparkline.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/Sparkline.tsx artifacts/trader-dashboard/src/components/ui/Sparkline.static.test.ts
git commit -m "feat(ui): tokenized Sparkline primitive"
```

---

### Task 2: `ProgressRing` primitive

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/ProgressRing.tsx`
- Test: `artifacts/trader-dashboard/src/components/ui/ProgressRing.static.test.ts`

**Interfaces:**
- Produces: `ProgressRing({ value: number, size?: number, stroke?: number, tone?: "primary" | "success" | "destructive" | "warning", children?: ReactNode, className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`components/ui/ProgressRing.static.test.ts`:
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./ProgressRing.tsx", import.meta.url), "utf8");
assert.match(src, /strokeDashoffset/);
assert.match(src, /var\(--primary\)/);
assert.match(src, /Math\.max\(0, Math\.min\(100/); // value clamped
assert.match(src, /prefers-reduced-motion|reduced/i); // motion guard referenced
console.log("ProgressRing static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/ProgressRing.static.test.ts`
Expected: FAIL (file missing).

- [ ] **Step 3: Write minimal implementation**

`components/ui/ProgressRing.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_VAR: Record<"primary" | "success" | "destructive" | "warning", string> = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
};

export interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "primary" | "success" | "destructive" | "warning";
  children?: React.ReactNode;
  className?: string;
}

export function ProgressRing({
  value,
  size = 58,
  stroke = 6,
  tone = "primary",
  children,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamped / 100);
  // Respect prefers-reduced-motion: skip the dashoffset transition.
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--secondary) / 0.7)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={reduced ? undefined : { transition: "stroke-dashoffset .8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/ProgressRing.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/ProgressRing.tsx artifacts/trader-dashboard/src/components/ui/ProgressRing.static.test.ts
git commit -m "feat(ui): tokenized ProgressRing primitive"
```

---

### Task 3: `Gauge` primitive

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/Gauge.tsx`
- Test: `artifacts/trader-dashboard/src/components/ui/Gauge.static.test.ts`

**Interfaces:**
- Produces: `Gauge({ value: number, width?: number, className?: string }): JSX.Element` — value 0–100 clamped.

- [ ] **Step 1: Write the failing test**

`components/ui/Gauge.static.test.ts`:
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./Gauge.tsx", import.meta.url), "utf8");
assert.equal(src.includes("0 84% 60%"), false, "no raw destructive HSL");
assert.match(src, /var\(--destructive\)/);
assert.match(src, /var\(--warning\)/);
assert.match(src, /var\(--success\)/);
assert.match(src, /Math\.max\(0, Math\.min\(100/); // clamped
console.log("Gauge static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/Gauge.static.test.ts`
Expected: FAIL (file missing).

- [ ] **Step 3: Write minimal implementation**

`components/ui/Gauge.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface GaugeProps {
  value: number;
  width?: number;
  className?: string;
}

export function Gauge({ value, width = 150, className }: GaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const R = width / 2 - 12;
  const cx = width / 2;
  const cy = R + 10;
  const h = cy + 22;
  const ang = (x: number) => Math.PI * (1 - x / 100);
  const pt = (x: number, r: number): [number, number] => [
    cx + r * Math.cos(ang(x)),
    cy - r * Math.sin(ang(x)),
  ];
  const arc = (v0: number, v1: number, r: number) => {
    const [x0, y0] = pt(v0, r);
    const [x1, y1] = pt(v1, r);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const [nx, ny] = pt(v, R - 5);
  const gid = React.useId();
  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      width={width}
      height={h}
      className={cn("block overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--destructive))" />
          <stop offset="50%" stopColor="hsl(var(--warning))" />
          <stop offset="100%" stopColor="hsl(var(--success))" />
        </linearGradient>
      </defs>
      <path d={arc(0, 100, R)} fill="none" stroke="hsl(var(--secondary))" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(0, 100, R)} fill="none" stroke={`url(#${gid})`} strokeWidth="9" strokeLinecap="round" opacity="0.92" />
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="hsl(var(--foreground))" />
      <text x={cx} y={cy + 16} textAnchor="middle" fontWeight="700" fontSize="17" fill="hsl(var(--foreground))" style={{ fontFamily: "var(--font-mono, monospace)" }}>
        {Math.round(v)}%
      </text>
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/Gauge.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/Gauge.tsx artifacts/trader-dashboard/src/components/ui/Gauge.static.test.ts
git commit -m "feat(ui): tokenized Gauge primitive"
```

---

### Task 4: `StatTile` primitive

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/StatTile.tsx`
- Test: `artifacts/trader-dashboard/src/components/ui/StatTile.static.test.ts`

**Interfaces:**
- Produces: `StatTile({ label: string, value: ReactNode, unit?: string, tone?: "default" | "primary" | "success" | "destructive", size?: "md" | "lg", className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`components/ui/StatTile.static.test.ts`:
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./StatTile.tsx", import.meta.url), "utf8");
assert.match(src, /label/);
assert.match(src, /value/);
assert.match(src, /font-mono/); // value uses mono
assert.match(src, /text-success|text-destructive|text-primary/); // tonal classes
console.log("StatTile static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/StatTile.static.test.ts`
Expected: FAIL (file missing).

- [ ] **Step 3: Write minimal implementation**

`components/ui/StatTile.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<"default" | "primary" | "success" | "destructive", string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  destructive: "text-destructive",
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: "default" | "primary" | "success" | "destructive";
  size?: "md" | "lg";
  className?: string;
}

export function StatTile({
  label,
  value,
  unit,
  tone = "default",
  size = "md",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/35 bg-secondary/30 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[0.62rem] font-bold uppercase leading-none text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono font-black leading-none tabular-nums",
          size === "lg" ? "text-xl" : "text-lg",
          TONE_CLASS[tone],
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-xs font-bold text-muted-foreground">{unit}</span> : null}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/StatTile.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/StatTile.tsx artifacts/trader-dashboard/src/components/ui/StatTile.static.test.ts
git commit -m "feat(ui): tokenized StatTile primitive"
```

---

### Task 5: `WidgetHeader` helper

The kit's `CardHeader` exposes `icon`, `iconTone`, `title`, `subtitle`, `action`. Production `card.tsx` has no such helper. Add a focused `WidgetHeader` (does not modify `card.tsx`) so all 13 widgets share one header treatment.

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/WidgetHeader.tsx`
- Test: `artifacts/trader-dashboard/src/components/ui/WidgetHeader.static.test.ts`

**Interfaces:**
- Produces: `WidgetHeader({ icon: ReactNode, iconTone?: "primary" | "accent" | "warning" | "success" | "destructive", title: string, subtitle?: string, action?: ReactNode, className?: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`components/ui/WidgetHeader.static.test.ts`:
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./WidgetHeader.tsx", import.meta.url), "utf8");
assert.match(src, /icon/);
assert.match(src, /title/);
assert.match(src, /subtitle/);
assert.match(src, /action/);
assert.match(src, /iconTone/);
console.log("WidgetHeader static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/WidgetHeader.static.test.ts`
Expected: FAIL (file missing).

- [ ] **Step 3: Write minimal implementation**

`components/ui/WidgetHeader.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<
  "primary" | "accent" | "warning" | "success" | "destructive",
  string
> = {
  primary: "text-primary border-primary/25 bg-primary/10",
  accent: "text-primary border-primary/25 bg-primary/10",
  warning: "text-warning border-warning/25 bg-warning/10",
  success: "text-success border-success/25 bg-success/10",
  destructive: "text-destructive border-destructive/25 bg-destructive/10",
};

export interface WidgetHeaderProps {
  icon: React.ReactNode;
  iconTone?: "primary" | "accent" | "warning" | "success" | "destructive";
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetHeader({
  icon,
  iconTone = "primary",
  title,
  subtitle,
  action,
  className,
}: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-4 sm:p-5", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            TONE_CLASS[iconTone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-mono font-semibold leading-tight text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter trader-dashboard exec vitest run src/components/ui/WidgetHeader.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/WidgetHeader.tsx artifacts/trader-dashboard/src/components/ui/WidgetHeader.static.test.ts
git commit -m "feat(ui): WidgetHeader helper with tonal icon chip"
```

---

## Phases 1–4 — Per-widget restyle

**Every widget task follows the same 6-step shape. Read this contract once; each task below fills in its specifics.**

1. **Read** the current production file in full. Inventory: data hooks/props, event handlers, navigation, gating, i18n keys (`uiText("…")`), and any pattern its `*.static.test.ts` asserts. These are **invariants** — they must survive verbatim.
2. **Restyle** the markup to the kit visual target (referenced per task), composing the new primitives + `WidgetHeader`. Replace bespoke header/stat/ring/spark/bar markup with the primitives. Keep the existing `Card`/`glass-panel` wrapper.
3. **Re-wire real data into the visual slots** — never introduce the kit's mock arrays. Map live values to primitive props.
4. **Update the static test** only where asserted markup moved; keep all invariant assertions (hooks, `stopPropagation`, aria keys). Add an assertion that the new primitive(s) are imported.
5. **Verify:** `pnpm --filter trader-dashboard exec vitest run src/components/<Widget>.static.test.ts` green; `pnpm --filter trader-dashboard typecheck` green.
6. **Commit:** `refactor(ui): restyle <Widget> onto design-system primitives`.

Kit visual references live in the Claude Design project `831a2631-e58c-4c3a-97f8-0c05dedb57e0`, file `ui_kits/dashboard/widgets.jsx` (read via DesignSync `get_file` if needed). Token mapping: kit `hsl(142 71% 45%)`→`success`, `hsl(0 84% 60%)`→`destructive`, `hsl(38 92% 50%)`→`warning`, `hsl(var(--primary))`→jade primary (unchanged).

---

### Task 6 (Phase 1): ClockWidget — banner

**Files:** Modify `components/ClockWidget.tsx`; Test `components/ClockWidget.market-closed.static.test.ts`.

**Invariants:** keep the live `setInterval` tick, `getSessionState`/session palette and Europe/Rome logic, the market-closed branch the test asserts, and full-width banner height. The banner is **not** a `Card` — keep its bespoke bar layout.

**Visual target (kit):** full-width 64px bar — left: bold tabular time; centre (desktop only): italic daily quote + author; divider; date column (day + weekday); right: session pill (colored dot + name/ETA, pulse when active, red when closed). Top 2px primary accent line.

**Specifics:** map the real current time/session into the kit bar layout; route session colors through the existing production session palette (keep as-is, not kit literals). Quote uses the existing daily-quote source if present, else the existing ClockWidget content. Keep `market-closed` test passing — verify which string/branch it asserts and preserve it.

**Commit:** `refactor(ui): restyle ClockWidget banner onto design system`

---

### Task 7 (Phase 2): JournalWidget — KPI tiles

**Files:** Modify `components/JournalWidget.tsx`; Test `components/JournalWidget.static.test.ts`.

**Invariants (verbatim):** `useGetJournalEntries` + `getGetJournalEntriesQueryKey` query; `getJournalWidgetSummary`; `JournalEntryModal` mount; loading/error/empty/loaded states; both buttons with `onPointerDown={(event) => event.stopPropagation()}`; aria keys `uiText("auto.ui.8a919429ca")` and `uiText("journal.open_page")`. The static test asserts all of these — keep them.

**Visual target (kit):** `Card` + header (book icon, "Diario Trading", subtitle) with an `arrow-up-right` action; body is a 2-col `StatTile` grid (Win Rate `success`, Expectancy `primary`, Profit Factor default, Trade count with unit). Production has more (latest-trade detail, buttons) — **keep all of it**, but render the weekly metrics through `StatTile` and the header through `WidgetHeader`.

**Specifics:** replace the inline `Metric` component with `StatTile`; replace the bespoke header block with `WidgetHeader`. Keep the latest-trade card, loading/error/empty branches, and the two action buttons unchanged. Map real `summary.weekly.wins/losses/winRate` + `summary.todayCount` into tiles.

**Commit:** `refactor(ui): restyle JournalWidget onto StatTile + WidgetHeader`

---

### Task 8 (Phase 2): BrokerHubWidget — KPI + equity spark

**Files:** Modify `components/broker-hub/BrokerHubWidget.tsx`; Test (if present) `components/broker-hub/*.static.test.ts` and `production-copy.static.test.ts` (BrokerHubWidget is in its file list — must stay free of forbidden provider copy).

**Invariants:** real broker connection state, balance/equity values, connected/disconnected badge, any existing i18n keys; no forbidden provider/debug strings (see `production-copy.static.test.ts` list). Keep existing data hooks.

**Visual target (kit):** `Card` + header (wallet icon, "Broker Hub", subtitle broker·platform) with a "Connesso" success `Badge`; body: 2-col `StatTile` (Saldo default, Equity `primary`) + an equity panel with a `Sparkline` (`success` tone) and a "+X € · +Y%" delta line.

**Specifics:** feed the real equity series into `Sparkline` (use the live series the widget already has; if none exists, keep the existing balance/equity display and only restyle chrome — do not fabricate a series). Header via `WidgetHeader`, tiles via `StatTile`.

**Commit:** `refactor(ui): restyle BrokerHubWidget onto primitives`

---

### Task 9 (Phase 3): SentimentWidget — Gauge

**Files:** Modify `components/SentimentWidget.tsx`; Test: add/extend `components/SentimentWidget.static.test.ts` if none exists (assert `Gauge` import + real data hook retained).

**Invariants:** real sentiment data source/hook, per-pair long/short values, any aggregate bias calc, i18n keys.

**Visual target (kit):** `Card` + header (gauge icon, warning tone, "Sentiment di Mercato"); body: centered `Gauge` of aggregate long%, a bias pill (Rialzista/Neutrale/Ribassista tinted success/warning/destructive), then per-pair rows with a split long(`success`)/short(`destructive`) bar.

**Specifics:** map real aggregate long% into `Gauge value`; bias thresholds drive the pill tone via tokens. Per-pair bars use real long%. Keep the real data fetch.

**Commit:** `refactor(ui): restyle SentimentWidget onto Gauge primitive`

---

### Task 10 (Phase 3): VolatilityWidget — ProgressRings

**Files:** Modify `components/VolatilityWidget.tsx`; Tests `components/VolatilityWidget.contrast.static.test.ts` and `production-copy.static.test.ts` (file is listed — keep clean).

**Invariants:** real ADR/volatility data, the contrast test's asserted classes/markup, i18n keys, no forbidden copy.

**Visual target (kit):** `Card` + header (gauge icon, primary, "Volatilità & ADR"); body: 2-col grid of tiles, each a `ProgressRing` of % range used (tone by threshold: ≥80 `destructive`, ≥60 `warning`, else `success`) + symbol + status label (Esaurito/Elevato/Spazio).

**Specifics:** route real per-symbol % into `ProgressRing value` and `tone`. Re-run the contrast test after; if it asserts specific color classes that moved, update those assertions to the tokenized equivalents while preserving the contrast intent. Avoid `Ã/â` mojibake in "Volatilità".

**Commit:** `refactor(ui): restyle VolatilityWidget onto ProgressRing`

---

### Task 11 (Phase 3): CotWidget — diverging bars

**Files:** Modify `components/CotWidget.tsx`; Tests any `CotWidget` static test + `production-copy.static.test.ts` (listed — keep clean, no `CFTC ·` / forbidden copy).

**Invariants:** real COT data hook, per-currency net values, i18n keys, no forbidden provider copy.

**Visual target (kit):** `Card` + header (book-marked icon, warning, "COT Report"); a Short◂/▸Long axis legend; per-currency diverging bar centered at 50% (long→`success` right, short→`destructive` left) + signed net value.

**Specifics:** feed real net positioning into the diverging bar width/side and the signed label. Header via `WidgetHeader`.

**Commit:** `refactor(ui): restyle CotWidget diverging bars onto tokens`

---

### Task 12 (Phase 4): MissionsWidget

**Files:** Modify `components/MissionsWidget.tsx`; Test if present.

**Invariants:** real missions data + completion mutation/handlers, XP totals, navigation, i18n keys.

**Visual target (kit):** `Card` + header (target icon, accent, "Missioni Giornaliere", "x/y completate") with an XP `Badge`; an XP summary row with a `ProgressRing` (% of possible XP); mission rows with a complete toggle (check-circle/circle) and a "Completa ›" button on incomplete.

**Specifics:** map real done/total + earned/possible XP into the ring and badge; wire the existing complete handler to the toggle/button. Keep real data.

**Commit:** `refactor(ui): restyle MissionsWidget onto ProgressRing`

---

### Task 13 (Phase 4): RoutineWidget

**Files:** Modify `components/RoutineWidget.tsx`; helpers in `RoutineWidget.helpers.ts` unchanged; Test `RoutineWidget.helpers.test.ts` stays green.

**Invariants:** real routine state (morning/evening done), streak logic via helpers, navigation to `/routine`, i18n keys.

**Visual target (kit):** `Card` + header (sunrise icon, warning, "Routine Giornaliera", "x/2 completate"); a `ProgressRing` (warning tone) summary + two routine rows (icon chip, label, check or "Avvia" pill).

**Specifics:** map real morning/evening completion to the ring (x/2) and row states; "Avvia" triggers the existing navigation/handler.

**Commit:** `refactor(ui): restyle RoutineWidget onto ProgressRing`

---

### Task 14 (Phase 4): ChecklistDashboardWidget

**Files:** Modify `components/ChecklistDashboardWidget.tsx`; Test if present.

**Invariants:** real checklist items + toggle/persistence, any setup-modal trigger, i18n keys.

**Visual target (kit):** `Card` + header (clipboard-check icon, accent, "Checklist Pre-Trade", "x/y verificati"); a `Progress` bar (existing `progress.tsx`); item rows as toggle buttons (check-circle/circle + strike-through when done).

**Specifics:** use the existing `Progress` primitive (already in `ui/progress.tsx`) for the bar; wire real toggle handler to each row. Keep persistence.

**Commit:** `refactor(ui): restyle ChecklistDashboardWidget onto tokens`

---

### Task 15 (Phase 4): CalendarWidget

**Files:** Modify `components/CalendarWidget.tsx`; Tests `CalendarWidget.bank-holiday-filter.static.test.ts`, `CalendarWidget.no-missions.static.test.ts`, `Dashboard.calendar-widget-interaction.static.test.ts` — all must stay green.

**Invariants:** real events data + bank-holiday filter, no-missions branch, the click/interaction behavior the Dashboard test asserts (`bodyHandlesOwnClicks`), i18n keys.

**Visual target (kit):** `Card` + header (calendar-days icon, accent, "Calendario Avanzato", "Eventi di oggi") with `arrow-up-right` action; event rows: mono time, currency chip, title (truncate), impact dots (1–3, colored by impact via `destructive`/`warning`/`success`).

**Specifics:** restyle event rows with the impact-dots helper using tokens; keep filter logic and interaction handlers. Re-run all three asserting tests.

**Commit:** `refactor(ui): restyle CalendarWidget event rows onto tokens`

---

### Task 16 (Phase 4): TradingViewWatchlistWidget — chrome only

**Files:** Modify `components/TradingViewWatchlistWidget.tsx`; Test `TradingViewWatchlistWidget.static.test.ts`.

**Invariants:** the external TradingView embed/script loading is **unchanged**; keep all script/iframe wiring the static test asserts.

**Visual target (kit `WatchlistWidget`):** only the surrounding `Card` chrome — header (activity icon, accent, "Watchlist Realtime", "Prezzi live") + a pulsing "Live" badge. **Do not** replace the embed with the kit's mock sparkline rows.

**Specifics:** wrap/adjust the existing embed container with `WidgetHeader` + Card styling; leave the embed itself intact.

**Commit:** `refactor(ui): align TradingViewWatchlistWidget card chrome`

---

### Task 17 (Phase 4): QuoteWidget

**Files:** Modify `components/QuoteWidget.tsx`; Test `QuoteWidget.animation.static.test.ts` (keep asserted animation/markup).

**Invariants:** real daily-quote source + the animation the test asserts, i18n keys.

**Visual target (kit):** glow `Card` — quote icon (primary, 50% opacity), quote text, mono author line.

**Specifics:** restyle to the glow card; keep the existing quote source and animation. Verify the animation test still matches (adjust selector only if the animated element moved).

**Commit:** `refactor(ui): restyle QuoteWidget glow card`

---

### Task 18 (Phase 4): LotCalculatorWidget

**Files:** Modify `components/LotCalculatorWidget.tsx`; Test if present.

**Invariants:** real lot calculation logic + inputs state, any validation, i18n keys.

**Visual target (kit):** `Card` + header (calculator icon, primary, "Dimensionamento", "Calcolatore lotti"); two `Input`s (risk, stop pips); a result tile (primary-tinted) showing the computed lot in large mono.

**Specifics:** keep the real calculation; render inputs via existing `ui/input` and the result via a primary-tinted tile (compose `StatTile` tone `primary` or a bespoke tinted block matching the kit).

**Commit:** `refactor(ui): restyle LotCalculatorWidget onto primitives`

---

## Phase 5 — Gate

### Task 19: Full verification

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 2: Tests**

Run: `pnpm test`
Expected: PASS — all widget + primitive static tests, i18n parity, contrast, production-copy.

- [ ] **Step 3: Full gate**

Run: `pnpm verify`
Expected: install → codegen → typecheck → test → build all green.

- [ ] **Step 4: Visual review**

Start locally (`./dev-up.sh`, then API + Vite), open `/` dashboard, confirm each of the 13 widgets renders with **real data** and the refreshed look; check `/styleguide` still renders.

- [ ] **Step 5: Push**

```bash
git push
```
(Per project rule: push the branch once the gate is green and work is committed.)

---

## Self-review notes

- **Spec coverage:** all 13 in-scope widgets → Tasks 6–18; 4 primitives + header → Tasks 1–5; token mapping → Global Constraints + per-task; testing/gate → Task 19. TradingView chrome-only → Task 16. CardHeader decision → resolved as new `WidgetHeader` (Task 5). Warning-token name → confirmed `--warning` exists in `index.css` `@theme`.
- **Out-of-scope** (secondary widgets, shell, fallback watchlist) intentionally excluded per spec §9.
- **Invariants** for the two read-in-full exemplars (Journal, and the production-copy-listed Volatility/Cot/BrokerHub) are enumerated; other widget tasks instruct the executor to inventory invariants in step 1 before restyling, since the production files are richer than the kit mocks.
