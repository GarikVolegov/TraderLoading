# Backtest Drawing Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customizable drawing tools and automatic Europe/Rome session indicators to the backtest replay chart.

**Architecture:** Keep `lightweight-charts` responsible for candles, volume histogram, trade markers, and replay scales. Add a focused SVG overlay system for drawings, daily SVP, and Asian session shading, with chart-domain coordinates persisted alongside replay state.

**Tech Stack:** React, TypeScript, Vite, `lightweight-charts`, `lucide-react`, localStorage persistence, Node `assert` tests run with `tsx`.

---

## File Structure

- Create `artifacts/trader-dashboard/src/components/chartDrawingTypes.ts`
  - Owns drawing object types, style types, tool ids, default settings, and Fibonacci levels.
- Create `artifacts/trader-dashboard/src/components/chartDrawingPersistence.ts`
  - Owns safe serialization/parsing for drawings, drawing defaults, SVP settings, and Asian session settings.
- Create `artifacts/trader-dashboard/src/components/chartDrawingPersistence.test.ts`
  - Covers valid restore, malformed restore, and legacy empty state.
- Create `artifacts/trader-dashboard/src/components/chartSessionTime.ts`
  - Owns Europe/Rome local-day and Asian-session boundary helpers.
- Create `artifacts/trader-dashboard/src/components/chartSessionTime.test.ts`
  - Covers normal days and DST transition days.
- Create `artifacts/trader-dashboard/src/components/chartVolumeProfile.ts`
  - Owns daily SVP bucket calculation, POC, VAH, and VAL.
- Create `artifacts/trader-dashboard/src/components/chartVolumeProfile.test.ts`
  - Covers price buckets, POC, value area, and missing volume handling.
- Create `artifacts/trader-dashboard/src/components/chartDrawingGeometry.ts`
  - Owns Fibonacci level generation, screen/domain point helpers, and lightweight hit-test helpers.
- Create `artifacts/trader-dashboard/src/components/chartDrawingGeometry.test.ts`
  - Covers Fibonacci levels and basic line/rectangle hit behavior.
- Create `artifacts/trader-dashboard/src/components/ChartDrawingToolbar.tsx`
  - Renders the left vertical toolbar with icon buttons and tooltips/titles.
- Create `artifacts/trader-dashboard/src/components/ChartDrawingProperties.tsx`
  - Renders contextual settings for selected drawing/SVP/Asian session.
- Create `artifacts/trader-dashboard/src/components/ChartDrawingOverlay.tsx`
  - Renders SVG drawings, SVP, Asian session zones, and handles drawing pointer interactions.
- Modify `artifacts/trader-dashboard/src/components/chartReplayPersistence.ts`
  - Extend replay persistence with optional drawing state while keeping legacy payloads valid.
- Modify `artifacts/trader-dashboard/src/components/chartReplayPersistence.test.ts`
  - Cover persistence with and without drawing state.
- Modify `artifacts/trader-dashboard/src/components/ChartReplay.tsx`
  - Own drawing state, pass chart coordinate callbacks into overlay, render toolbar/properties/overlay, and persist settings.
- Modify `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`
  - Static coverage for toolbar, SVP toggle, Asian session toggle, and overlay presence.

---

### Task 1: Drawing Types and Defaults

**Files:**
- Create: `artifacts/trader-dashboard/src/components/chartDrawingTypes.ts`

- [ ] **Step 1: Create the drawing types module**

Add:

```ts
import type { Time } from "lightweight-charts";

export type DrawingTool = "select" | "rectangle" | "fibonacci" | "arrow" | "line";

export type DrawingLineStyle = "solid" | "dashed" | "dotted";

export interface ChartPoint {
  time: Time;
  price: number;
}

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  lineStyle: DrawingLineStyle;
  fill: string;
  fillOpacity: number;
}

export interface BaseDrawing {
  id: string;
  kind: "rectangle" | "fibonacci" | "arrow" | "line";
  points: [ChartPoint, ChartPoint];
  style: DrawingStyle;
  createdAt: string;
}

export interface FibonacciDrawing extends BaseDrawing {
  kind: "fibonacci";
  levels: number[];
}

export type ChartDrawing = BaseDrawing | FibonacciDrawing;

export interface SvpSettings {
  enabled: boolean;
  rows: number;
  valueAreaPercent: number;
  opacity: number;
  side: "right" | "left";
  barColor: string;
  pocColor: string;
  valueAreaColor: string;
}

export interface AsianSessionSettings {
  enabled: boolean;
  fillColor: string;
  fillOpacity: number;
  showBorders: boolean;
  showLabel: boolean;
}

export interface ChartDrawingState {
  drawings: ChartDrawing[];
  defaultStyle: DrawingStyle;
  svp: SvpSettings;
  asianSession: AsianSessionSettings;
}

export const DEFAULT_FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  stroke: "#22c55e",
  strokeWidth: 2,
  opacity: 0.9,
  lineStyle: "solid",
  fill: "#22c55e",
  fillOpacity: 0.12,
};

export const DEFAULT_SVP_SETTINGS: SvpSettings = {
  enabled: false,
  rows: 24,
  valueAreaPercent: 70,
  opacity: 0.35,
  side: "right",
  barColor: "#3b82f6",
  pocColor: "#f59e0b",
  valueAreaColor: "#60a5fa",
};

export const DEFAULT_ASIAN_SESSION_SETTINGS: AsianSessionSettings = {
  enabled: false,
  fillColor: "#38bdf8",
  fillOpacity: 0.08,
  showBorders: true,
  showLabel: true,
};

export const DEFAULT_CHART_DRAWING_STATE: ChartDrawingState = {
  drawings: [],
  defaultStyle: DEFAULT_DRAWING_STYLE,
  svp: DEFAULT_SVP_SETTINGS,
  asianSession: DEFAULT_ASIAN_SESSION_SETTINGS,
};
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: PASS with `tsc -p tsconfig.json --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartDrawingTypes.ts
git commit -m "feat: add chart drawing types"
```

---

### Task 2: Drawing Persistence

**Files:**
- Create: `artifacts/trader-dashboard/src/components/chartDrawingPersistence.test.ts`
- Create: `artifacts/trader-dashboard/src/components/chartDrawingPersistence.ts`

- [ ] **Step 1: Write the failing persistence test**

Add `chartDrawingPersistence.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  DEFAULT_CHART_DRAWING_STATE,
  DEFAULT_FIBONACCI_LEVELS,
  type ChartDrawingState,
} from "./chartDrawingTypes.js";
import { parseDrawingState, serializeDrawingState } from "./chartDrawingPersistence.js";

const state: ChartDrawingState = {
  ...DEFAULT_CHART_DRAWING_STATE,
  drawings: [
    {
      id: "d1",
      kind: "rectangle",
      points: [
        { time: 1780876800 as never, price: 1.1 },
        { time: 1780880400 as never, price: 1.2 },
      ],
      style: DEFAULT_CHART_DRAWING_STATE.defaultStyle,
      createdAt: "2026-06-08T10:00:00.000Z",
    },
    {
      id: "d2",
      kind: "fibonacci",
      points: [
        { time: 1780876800 as never, price: 1.3 },
        { time: 1780880400 as never, price: 1.1 },
      ],
      style: DEFAULT_CHART_DRAWING_STATE.defaultStyle,
      levels: DEFAULT_FIBONACCI_LEVELS,
      createdAt: "2026-06-08T10:01:00.000Z",
    },
  ],
  svp: { ...DEFAULT_CHART_DRAWING_STATE.svp, enabled: true, rows: 32 },
  asianSession: { ...DEFAULT_CHART_DRAWING_STATE.asianSession, enabled: true },
};

const restored = parseDrawingState(serializeDrawingState(state));
assert.equal(restored.drawings.length, 2);
assert.equal(restored.drawings[1]?.kind, "fibonacci");
assert.equal(restored.svp.enabled, true);
assert.equal(restored.svp.rows, 32);
assert.equal(restored.asianSession.enabled, true);

assert.deepEqual(parseDrawingState(null), DEFAULT_CHART_DRAWING_STATE);
assert.deepEqual(parseDrawingState("{bad json"), DEFAULT_CHART_DRAWING_STATE);
assert.deepEqual(parseDrawingState(JSON.stringify({ version: 999 })), DEFAULT_CHART_DRAWING_STATE);
assert.equal(parseDrawingState(JSON.stringify({ version: 1, drawings: [{ kind: "line" }] })).drawings.length, 0);

console.log("chart drawing persistence checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingPersistence.test.ts`

Expected: FAIL because `chartDrawingPersistence.js` does not exist.

- [ ] **Step 3: Implement persistence**

Add `chartDrawingPersistence.ts`:

```ts
import {
  DEFAULT_ASIAN_SESSION_SETTINGS,
  DEFAULT_CHART_DRAWING_STATE,
  DEFAULT_DRAWING_STYLE,
  DEFAULT_FIBONACCI_LEVELS,
  DEFAULT_SVP_SETTINGS,
  type AsianSessionSettings,
  type ChartDrawing,
  type ChartDrawingState,
  type DrawingStyle,
  type SvpSettings,
} from "./chartDrawingTypes";

interface PersistedDrawingState {
  version: 1;
  drawings: ChartDrawing[];
  defaultStyle: DrawingStyle;
  svp: SvpSettings;
  asianSession: AsianSessionSettings;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStyle(value: unknown): value is DrawingStyle {
  const style = value as Partial<DrawingStyle>;
  return Boolean(
    style &&
    typeof style.stroke === "string" &&
    isFiniteNumber(style.strokeWidth) &&
    isFiniteNumber(style.opacity) &&
    (style.lineStyle === "solid" || style.lineStyle === "dashed" || style.lineStyle === "dotted") &&
    typeof style.fill === "string" &&
    isFiniteNumber(style.fillOpacity),
  );
}

function isPoint(value: unknown): value is ChartDrawing["points"][number] {
  const point = value as Partial<ChartDrawing["points"][number]>;
  return Boolean(point && (typeof point.time === "number" || typeof point.time === "string") && isFiniteNumber(point.price));
}

function isDrawing(value: unknown): value is ChartDrawing {
  const drawing = value as Partial<ChartDrawing>;
  const validKind = drawing.kind === "rectangle" || drawing.kind === "fibonacci" || drawing.kind === "arrow" || drawing.kind === "line";
  const validPoints = Array.isArray(drawing.points) && drawing.points.length === 2 && drawing.points.every(isPoint);
  if (!drawing || typeof drawing.id !== "string" || !validKind || !validPoints || !isStyle(drawing.style) || typeof drawing.createdAt !== "string") {
    return false;
  }
  if (drawing.kind === "fibonacci") {
    const fib = drawing as Partial<Extract<ChartDrawing, { kind: "fibonacci" }>>;
    return Array.isArray(fib.levels) && fib.levels.every(isFiniteNumber);
  }
  return true;
}

function parseSvp(value: unknown): SvpSettings {
  const svp = value as Partial<SvpSettings>;
  return {
    ...DEFAULT_SVP_SETTINGS,
    ...(svp && typeof svp === "object" ? svp : {}),
    enabled: typeof svp?.enabled === "boolean" ? svp.enabled : DEFAULT_SVP_SETTINGS.enabled,
    rows: isFiniteNumber(svp?.rows) ? Math.max(4, Math.min(80, Math.floor(svp.rows))) : DEFAULT_SVP_SETTINGS.rows,
    valueAreaPercent: isFiniteNumber(svp?.valueAreaPercent) ? Math.max(1, Math.min(100, svp.valueAreaPercent)) : DEFAULT_SVP_SETTINGS.valueAreaPercent,
  };
}

function parseAsianSession(value: unknown): AsianSessionSettings {
  const session = value as Partial<AsianSessionSettings>;
  return {
    ...DEFAULT_ASIAN_SESSION_SETTINGS,
    ...(session && typeof session === "object" ? session : {}),
    enabled: typeof session?.enabled === "boolean" ? session.enabled : DEFAULT_ASIAN_SESSION_SETTINGS.enabled,
    fillOpacity: isFiniteNumber(session?.fillOpacity) ? Math.max(0, Math.min(1, session.fillOpacity)) : DEFAULT_ASIAN_SESSION_SETTINGS.fillOpacity,
  };
}

export function serializeDrawingState(state: ChartDrawingState): string {
  const persisted: PersistedDrawingState = {
    version: 1,
    drawings: state.drawings.filter(isDrawing),
    defaultStyle: isStyle(state.defaultStyle) ? state.defaultStyle : DEFAULT_DRAWING_STYLE,
    svp: parseSvp(state.svp),
    asianSession: parseAsianSession(state.asianSession),
  };
  return JSON.stringify(persisted);
}

export function parseDrawingState(raw: string | null): ChartDrawingState {
  if (!raw) return DEFAULT_CHART_DRAWING_STATE;
  try {
    const data = JSON.parse(raw) as Partial<PersistedDrawingState>;
    if (data.version !== 1) return DEFAULT_CHART_DRAWING_STATE;
    return {
      drawings: Array.isArray(data.drawings) ? data.drawings.filter(isDrawing) : [],
      defaultStyle: isStyle(data.defaultStyle) ? data.defaultStyle : DEFAULT_DRAWING_STYLE,
      svp: parseSvp(data.svp),
      asianSession: parseAsianSession(data.asianSession),
    };
  } catch {
    return DEFAULT_CHART_DRAWING_STATE;
  }
}

export function createDrawing(kind: ChartDrawing["kind"], points: ChartDrawing["points"], style: DrawingStyle): ChartDrawing {
  const base = {
    id: crypto.randomUUID(),
    kind,
    points,
    style,
    createdAt: new Date().toISOString(),
  };
  return kind === "fibonacci" ? { ...base, kind, levels: DEFAULT_FIBONACCI_LEVELS } : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingPersistence.test.ts`

Expected: PASS and prints `chart drawing persistence checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartDrawingPersistence.ts artifacts/trader-dashboard/src/components/chartDrawingPersistence.test.ts
git commit -m "feat: add chart drawing persistence"
```

---

### Task 3: Europe/Rome Session Boundaries

**Files:**
- Create: `artifacts/trader-dashboard/src/components/chartSessionTime.test.ts`
- Create: `artifacts/trader-dashboard/src/components/chartSessionTime.ts`

- [ ] **Step 1: Write the failing session-time test**

Add:

```ts
import assert from "node:assert/strict";
import type { Time } from "lightweight-charts";
import {
  getAsianSessionRangeForTime,
  getEuropeRomeDayRangeForTime,
  isTimeInsideRange,
  selectCandlesInRange,
} from "./chartSessionTime.js";

const utc = (iso: string) => Date.parse(iso) / 1000;

const winterDay = getEuropeRomeDayRangeForTime(utc("2026-01-15T12:00:00Z"));
assert.equal(new Date(winterDay.start * 1000).toISOString(), "2026-01-14T23:00:00.000Z");
assert.equal(new Date(winterDay.end * 1000).toISOString(), "2026-01-15T23:00:00.000Z");

const winterAsia = getAsianSessionRangeForTime(utc("2026-01-15T03:00:00Z"));
assert.equal(new Date(winterAsia.start * 1000).toISOString(), "2026-01-14T23:00:00.000Z");
assert.equal(new Date(winterAsia.end * 1000).toISOString(), "2026-01-15T07:00:00.000Z");

const summerDay = getEuropeRomeDayRangeForTime(utc("2026-06-15T12:00:00Z"));
assert.equal(new Date(summerDay.start * 1000).toISOString(), "2026-06-14T22:00:00.000Z");
assert.equal(new Date(summerDay.end * 1000).toISOString(), "2026-06-15T22:00:00.000Z");

const summerAsia = getAsianSessionRangeForTime(utc("2026-06-15T03:00:00Z"));
assert.equal(new Date(summerAsia.start * 1000).toISOString(), "2026-06-14T22:00:00.000Z");
assert.equal(new Date(summerAsia.end * 1000).toISOString(), "2026-06-15T06:00:00.000Z");

assert.equal(isTimeInsideRange(utc("2026-06-15T05:59:00Z"), summerAsia), true);
assert.equal(isTimeInsideRange(utc("2026-06-15T06:00:00Z"), summerAsia), false);

const candles = [
  { time: utc("2026-06-14T21:45:00Z") as Time },
  { time: utc("2026-06-14T22:00:00Z") as Time },
  { time: utc("2026-06-15T05:45:00Z") as Time },
  { time: utc("2026-06-15T06:00:00Z") as Time },
];
assert.deepEqual(selectCandlesInRange(candles, summerAsia).map((c) => c.time), [candles[1].time, candles[2].time]);

console.log("chart session time checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartSessionTime.test.ts`

Expected: FAIL because `chartSessionTime.js` does not exist.

- [ ] **Step 3: Implement Europe/Rome boundary helpers**

Add:

```ts
import type { Time } from "lightweight-charts";

const ROME_TIME_ZONE = "Europe/Rome";

export interface TimeRange {
  start: number;
  end: number;
}

function getRomeParts(ts: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts * 1000));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function compareLocal(a: ReturnType<typeof getRomeParts>, target: { year: number; month: number; day: number; hour: number; minute: number }): number {
  const av = [a.year, a.month, a.day, a.hour, a.minute];
  const bv = [target.year, target.month, target.day, target.hour, target.minute];
  for (let i = 0; i < av.length; i++) {
    if (av[i] < bv[i]) return -1;
    if (av[i] > bv[i]) return 1;
  }
  return 0;
}

function findUtcForRomeLocal(target: { year: number; month: number; day: number; hour: number; minute: number }): number {
  const approximate = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute) / 1000;
  let low = approximate - 36 * 60 * 60;
  let high = approximate + 36 * 60 * 60;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const cmp = compareLocal(getRomeParts(mid), target);
    if (cmp < 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

function addRomeDays(parts: ReturnType<typeof getRomeParts>, days: number): ReturnType<typeof getRomeParts> {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: parts.hour, minute: parts.minute };
}

export function getEuropeRomeDayRangeForTime(ts: number): TimeRange {
  const parts = getRomeParts(ts);
  const start = findUtcForRomeLocal({ year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0 });
  const nextDay = addRomeDays({ ...parts, hour: 0, minute: 0 }, 1);
  const end = findUtcForRomeLocal({ ...nextDay, hour: 0, minute: 0 });
  return { start, end };
}

export function getAsianSessionRangeForTime(ts: number): TimeRange {
  const day = getEuropeRomeDayRangeForTime(ts);
  const parts = getRomeParts(day.start);
  const end = findUtcForRomeLocal({ year: parts.year, month: parts.month, day: parts.day, hour: 8, minute: 0 });
  return { start: day.start, end };
}

export function isTimeInsideRange(ts: number, range: TimeRange): boolean {
  return ts >= range.start && ts < range.end;
}

export function selectCandlesInRange<T extends { time: Time }>(candles: T[], range: TimeRange): T[] {
  return candles.filter((candle) => isTimeInsideRange(candle.time as number, range));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartSessionTime.test.ts`

Expected: PASS and prints `chart session time checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartSessionTime.ts artifacts/trader-dashboard/src/components/chartSessionTime.test.ts
git commit -m "feat: add europe rome session helpers"
```

---

### Task 4: Daily SVP Calculation

**Files:**
- Create: `artifacts/trader-dashboard/src/components/chartVolumeProfile.test.ts`
- Create: `artifacts/trader-dashboard/src/components/chartVolumeProfile.ts`

- [ ] **Step 1: Write the failing SVP test**

Add:

```ts
import assert from "node:assert/strict";
import type { Time } from "lightweight-charts";
import { calculateVolumeProfile } from "./chartVolumeProfile.js";

const candles = [
  { time: 1 as Time, open: 1, high: 1.1, low: 1, close: 1.05, volume: 10 },
  { time: 2 as Time, open: 1.1, high: 1.2, low: 1.1, close: 1.15, volume: 30 },
  { time: 3 as Time, open: 1.2, high: 1.3, low: 1.2, close: 1.25, volume: 20 },
  { time: 4 as Time, open: 1.3, high: 1.4, low: 1.3, close: 1.35 },
];

const profile = calculateVolumeProfile(candles, { rows: 4, valueAreaPercent: 70 });
assert.equal(profile?.buckets.length, 4);
assert.equal(profile?.totalVolume, 60);
assert.equal(profile?.poc.priceLow, 1.1);
assert.equal(profile?.poc.priceHigh, 1.2);
assert.ok(profile?.valueAreaLow != null);
assert.ok(profile?.valueAreaHigh != null);

assert.equal(calculateVolumeProfile([], { rows: 24, valueAreaPercent: 70 }), null);
assert.equal(calculateVolumeProfile([{ time: 1 as Time, open: 1, high: 1, low: 1, close: 1 }], { rows: 24, valueAreaPercent: 70 }), null);

console.log("chart volume profile checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartVolumeProfile.test.ts`

Expected: FAIL because `chartVolumeProfile.js` does not exist.

- [ ] **Step 3: Implement SVP calculation**

Add:

```ts
import type { CandlestickData, Time } from "lightweight-charts";

export interface VolumeProfileInputOptions {
  rows: number;
  valueAreaPercent: number;
}

export interface VolumeProfileBucket {
  priceLow: number;
  priceHigh: number;
  volume: number;
  inValueArea: boolean;
}

export interface VolumeProfileResult {
  buckets: VolumeProfileBucket[];
  totalVolume: number;
  poc: VolumeProfileBucket;
  valueAreaLow: number;
  valueAreaHigh: number;
}

type CandleWithVolume = CandlestickData<Time> & { volume?: number };

export function calculateVolumeProfile(candles: CandleWithVolume[], options: VolumeProfileInputOptions): VolumeProfileResult | null {
  const usable = candles.filter((c) => Number.isFinite(c.volume) && c.volume! > 0 && Number.isFinite(c.high) && Number.isFinite(c.low));
  if (usable.length === 0) return null;

  const low = Math.min(...usable.map((c) => c.low));
  const high = Math.max(...usable.map((c) => c.high));
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;

  const rows = Math.max(4, Math.min(80, Math.floor(options.rows)));
  const step = (high - low) / rows;
  const buckets: VolumeProfileBucket[] = Array.from({ length: rows }, (_, index) => ({
    priceLow: Number((low + step * index).toFixed(10)),
    priceHigh: Number((low + step * (index + 1)).toFixed(10)),
    volume: 0,
    inValueArea: false,
  }));

  for (const candle of usable) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    const index = Math.min(rows - 1, Math.max(0, Math.floor((typical - low) / step)));
    buckets[index].volume += candle.volume!;
  }

  const totalVolume = buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
  if (totalVolume <= 0) return null;

  const poc = buckets.reduce((best, bucket) => (bucket.volume > best.volume ? bucket : best), buckets[0]);
  const targetValueArea = totalVolume * (Math.max(1, Math.min(100, options.valueAreaPercent)) / 100);
  const pocIndex = buckets.indexOf(poc);
  let left = pocIndex;
  let right = pocIndex;
  let areaVolume = poc.volume;
  buckets[pocIndex].inValueArea = true;

  while (areaVolume < targetValueArea && (left > 0 || right < buckets.length - 1)) {
    const leftVolume = left > 0 ? buckets[left - 1].volume : -1;
    const rightVolume = right < buckets.length - 1 ? buckets[right + 1].volume : -1;
    if (rightVolume >= leftVolume && right < buckets.length - 1) {
      right += 1;
      areaVolume += buckets[right].volume;
      buckets[right].inValueArea = true;
    } else if (left > 0) {
      left -= 1;
      areaVolume += buckets[left].volume;
      buckets[left].inValueArea = true;
    } else {
      break;
    }
  }

  return {
    buckets,
    totalVolume,
    poc,
    valueAreaLow: buckets[left].priceLow,
    valueAreaHigh: buckets[right].priceHigh,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartVolumeProfile.test.ts`

Expected: PASS and prints `chart volume profile checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartVolumeProfile.ts artifacts/trader-dashboard/src/components/chartVolumeProfile.test.ts
git commit -m "feat: add daily volume profile calculation"
```

---

### Task 5: Drawing Geometry

**Files:**
- Create: `artifacts/trader-dashboard/src/components/chartDrawingGeometry.test.ts`
- Create: `artifacts/trader-dashboard/src/components/chartDrawingGeometry.ts`

- [ ] **Step 1: Write the failing geometry test**

Add:

```ts
import assert from "node:assert/strict";
import { DEFAULT_FIBONACCI_LEVELS } from "./chartDrawingTypes.js";
import { getFibonacciLines, getLineStyleDashArray, isPointNearLine, normalizeRect } from "./chartDrawingGeometry.js";

const fib = getFibonacciLines({ time: 1 as never, price: 1.2 }, { time: 2 as never, price: 1.0 }, DEFAULT_FIBONACCI_LEVELS);
assert.equal(fib.length, 7);
assert.equal(fib[0].price, 1.2);
assert.equal(fib[6].price, 1.0);
assert.equal(fib[3].label, "50.0%");

assert.deepEqual(normalizeRect({ x: 20, y: 10 }, { x: 5, y: 30 }), { x: 5, y: 10, width: 15, height: 20 });
assert.equal(getLineStyleDashArray("solid"), undefined);
assert.equal(getLineStyleDashArray("dashed"), "6 4");
assert.equal(getLineStyleDashArray("dotted"), "2 4");
assert.equal(isPointNearLine({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 2), true);
assert.equal(isPointNearLine({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 2), false);

console.log("chart drawing geometry checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingGeometry.test.ts`

Expected: FAIL because `chartDrawingGeometry.js` does not exist.

- [ ] **Step 3: Implement geometry helpers**

Add:

```ts
import type { ChartPoint, DrawingLineStyle } from "./chartDrawingTypes";

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeRect(a: ScreenPoint, b: ScreenPoint): NormalizedRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function getLineStyleDashArray(style: DrawingLineStyle): string | undefined {
  if (style === "dashed") return "6 4";
  if (style === "dotted") return "2 4";
  return undefined;
}

export function getFibonacciLines(start: ChartPoint, end: ChartPoint, levels: number[]): Array<{ level: number; label: string; price: number }> {
  const diff = end.price - start.price;
  return levels.map((level) => ({
    level,
    label: `${(level * 100).toFixed(1)}%`,
    price: Number((start.price + diff * level).toFixed(10)),
  }));
}

export function isPointNearLine(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint, tolerance: number): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - start.x, point.y - start.y) <= tolerance;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y) <= tolerance;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingGeometry.test.ts`

Expected: PASS and prints `chart drawing geometry checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartDrawingGeometry.ts artifacts/trader-dashboard/src/components/chartDrawingGeometry.test.ts
git commit -m "feat: add chart drawing geometry helpers"
```

---

### Task 6: Extend Replay Persistence With Drawing State

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/chartReplayPersistence.test.ts`
- Modify: `artifacts/trader-dashboard/src/components/chartReplayPersistence.ts`

- [ ] **Step 1: Add failing persistence assertions**

In `chartReplayPersistence.test.ts`, import default drawing state and add `drawingState` to the existing serialized payload:

```ts
import { DEFAULT_CHART_DRAWING_STATE } from "./chartDrawingTypes.js";
```

Add this property to the `serializeReplayState({ ... })` input:

```ts
  drawingState: {
    ...DEFAULT_CHART_DRAWING_STATE,
    svp: { ...DEFAULT_CHART_DRAWING_STATE.svp, enabled: true },
    asianSession: { ...DEFAULT_CHART_DRAWING_STATE.asianSession, enabled: true },
  },
```

Add assertions after `restored`:

```ts
assert.equal(restored?.drawingState?.svp.enabled, true);
assert.equal(restored?.drawingState?.asianSession.enabled, true);
assert.equal(parsePersistedReplayState(JSON.stringify({
  version: 1,
  symbol: "EUR/USD",
  activeInterval: "H1",
  revealedCount: 120,
  startIndex: 0,
  balance: 10000,
  lotSize: "0.01",
  trades: [],
  openTrade: null,
}), "EUR/USD")?.drawingState.drawings.length, 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartReplayPersistence.test.ts`

Expected: FAIL because `drawingState` is not part of the replay persistence types.

- [ ] **Step 3: Extend replay persistence**

In `chartReplayPersistence.ts`, import:

```ts
import { DEFAULT_CHART_DRAWING_STATE, type ChartDrawingState } from "./chartDrawingTypes";
import { parseDrawingState, serializeDrawingState } from "./chartDrawingPersistence";
```

Add `drawingState: ChartDrawingState;` to `PersistedReplayState` and `ReplayStateDraft`.

In `serializeReplayState`, add:

```ts
    drawingState: parseDrawingState(serializeDrawingState(draft.drawingState)),
```

In `parsePersistedReplayState`, add:

```ts
      drawingState: parseDrawingState(data.drawingState ? JSON.stringify(data.drawingState) : null),
```

If TypeScript complains about older payloads, use:

```ts
const rawDrawingState = (data as Partial<PersistedReplayState> & { drawingState?: unknown }).drawingState;
```

and pass `rawDrawingState ? JSON.stringify(rawDrawingState) : null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartReplayPersistence.test.ts`

Expected: PASS and prints `chart replay persistence checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/chartReplayPersistence.ts artifacts/trader-dashboard/src/components/chartReplayPersistence.test.ts
git commit -m "feat: persist chart drawing state"
```

---

### Task 7: Toolbar Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ChartDrawingToolbar.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`

- [ ] **Step 1: Add failing static test coverage**

In `ChartReplay.mobile-layout.test.ts`, add:

```ts
const toolbar = readFileSync("src/components/ChartDrawingToolbar.tsx", "utf8");
assert.match(toolbar, /aria-label="Strumenti grafico backtest"/);
assert.match(toolbar, /Rettangolo/);
assert.match(toolbar, /Fibonacci/);
assert.match(toolbar, /Freccia/);
assert.match(toolbar, /Linea/);
assert.match(toolbar, /SVP/);
assert.match(toolbar, /Sessione asiatica/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: FAIL because `ChartDrawingToolbar.tsx` does not exist.

- [ ] **Step 3: Implement toolbar**

Add:

```tsx
import { ArrowUpRight, BarChart3, ChartNoAxesColumn, Eraser, Hand, Minus, MousePointer2, PanelsTopLeft, Square, Undo2 } from "lucide-react";
import type { DrawingTool } from "./chartDrawingTypes";

interface ChartDrawingToolbarProps {
  activeTool: DrawingTool;
  svpEnabled: boolean;
  asianSessionEnabled: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onToggleSvp: () => void;
  onToggleAsianSession: () => void;
  onUndo: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}

const toolButtons: Array<{ tool: DrawingTool; label: string; icon: typeof MousePointer2 }> = [
  { tool: "select", label: "Seleziona", icon: MousePointer2 },
  { tool: "rectangle", label: "Rettangolo", icon: Square },
  { tool: "fibonacci", label: "Fibonacci", icon: ChartNoAxesColumn },
  { tool: "arrow", label: "Freccia", icon: ArrowUpRight },
  { tool: "line", label: "Linea", icon: Minus },
];

export function ChartDrawingToolbar({
  activeTool,
  svpEnabled,
  asianSessionEnabled,
  onToolChange,
  onToggleSvp,
  onToggleAsianSession,
  onUndo,
  onDeleteSelected,
  onClearAll,
}: ChartDrawingToolbarProps) {
  const buttonClass = (active: boolean) =>
    `h-8 w-8 rounded-md border text-[10px] transition-all grid place-items-center ${
      active ? "border-primary/60 bg-primary/20 text-primary" : "border-border/50 bg-card/80 text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div aria-label="Strumenti grafico backtest" className="absolute left-2 top-2 z-20 flex flex-col gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-xl backdrop-blur">
      {toolButtons.map(({ tool, label, icon: Icon }) => (
        <button key={tool} type="button" title={label} aria-label={label} className={buttonClass(activeTool === tool)} onClick={() => onToolChange(tool)}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <div className="my-1 h-px bg-border/60" />
      <button type="button" title="SVP" aria-label="SVP" className={buttonClass(svpEnabled)} onClick={onToggleSvp}>
        <BarChart3 className="h-4 w-4" />
      </button>
      <button type="button" title="Sessione asiatica" aria-label="Sessione asiatica" className={buttonClass(asianSessionEnabled)} onClick={onToggleAsianSession}>
        <PanelsTopLeft className="h-4 w-4" />
      </button>
      <div className="my-1 h-px bg-border/60" />
      <button type="button" title="Annulla" aria-label="Annulla" className={buttonClass(false)} onClick={onUndo}>
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" title="Elimina selezionato" aria-label="Elimina selezionato" className={buttonClass(false)} onClick={onDeleteSelected}>
        <Eraser className="h-4 w-4" />
      </button>
      <button type="button" title="Cancella tutto" aria-label="Cancella tutto" className={buttonClass(false)} onClick={onClearAll}>
        <Hand className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: PASS and prints `mobile backtest layout checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ChartDrawingToolbar.tsx artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts
git commit -m "feat: add backtest drawing toolbar"
```

---

### Task 8: Properties Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ChartDrawingProperties.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`

- [ ] **Step 1: Add failing static assertions**

In `ChartReplay.mobile-layout.test.ts`, add:

```ts
const properties = readFileSync("src/components/ChartDrawingProperties.tsx", "utf8");
assert.match(properties, /Proprietà/);
assert.match(properties, /Value Area/);
assert.match(properties, /Sessione asiatica/);
assert.match(properties, /Opacità/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: FAIL because `ChartDrawingProperties.tsx` does not exist.

- [ ] **Step 3: Implement properties component**

Add:

```tsx
import type { AsianSessionSettings, ChartDrawing, DrawingStyle, SvpSettings } from "./chartDrawingTypes";

interface ChartDrawingPropertiesProps {
  selectedDrawing: ChartDrawing | null;
  defaultStyle: DrawingStyle;
  svp: SvpSettings;
  asianSession: AsianSessionSettings;
  onDefaultStyleChange: (style: DrawingStyle) => void;
  onSvpChange: (settings: SvpSettings) => void;
  onAsianSessionChange: (settings: AsianSessionSettings) => void;
}

export function ChartDrawingProperties({
  selectedDrawing,
  defaultStyle,
  svp,
  asianSession,
  onDefaultStyleChange,
  onSvpChange,
  onAsianSessionChange,
}: ChartDrawingPropertiesProps) {
  const style = selectedDrawing?.style ?? defaultStyle;

  return (
    <div className="absolute left-12 top-2 z-20 w-56 rounded-lg border border-border/60 bg-background/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 font-bold text-foreground">Proprietà</div>
      <label className="mb-2 block">
        <span className="mb-1 block text-muted-foreground">Colore</span>
        <input className="h-8 w-full rounded border border-border bg-background px-2" type="color" value={style.stroke} onChange={(event) => onDefaultStyleChange({ ...defaultStyle, stroke: event.target.value, fill: event.target.value })} />
      </label>
      <label className="mb-2 block">
        <span className="mb-1 block text-muted-foreground">Spessore</span>
        <input className="w-full" type="range" min={1} max={6} value={style.strokeWidth} onChange={(event) => onDefaultStyleChange({ ...defaultStyle, strokeWidth: Number(event.target.value) })} />
      </label>
      <label className="mb-2 block">
        <span className="mb-1 block text-muted-foreground">Opacità</span>
        <input className="w-full" type="range" min={0.1} max={1} step={0.05} value={style.opacity} onChange={(event) => onDefaultStyleChange({ ...defaultStyle, opacity: Number(event.target.value) })} />
      </label>
      <div className="my-2 h-px bg-border/60" />
      <label className="mb-2 block">
        <span className="mb-1 block text-muted-foreground">SVP righe</span>
        <input className="w-full" type="range" min={8} max={60} value={svp.rows} onChange={(event) => onSvpChange({ ...svp, rows: Number(event.target.value) })} />
      </label>
      <label className="mb-2 block">
        <span className="mb-1 block text-muted-foreground">Value Area</span>
        <input className="w-full" type="range" min={50} max={90} value={svp.valueAreaPercent} onChange={(event) => onSvpChange({ ...svp, valueAreaPercent: Number(event.target.value) })} />
      </label>
      <div className="my-2 h-px bg-border/60" />
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Sessione asiatica</span>
        <input type="checkbox" checked={asianSession.enabled} onChange={(event) => onAsianSessionChange({ ...asianSession, enabled: event.target.checked })} />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: PASS and prints `mobile backtest layout checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ChartDrawingProperties.tsx artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts
git commit -m "feat: add drawing properties panel"
```

---

### Task 9: Overlay Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ChartDrawingOverlay.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`

- [ ] **Step 1: Add failing static assertions**

In `ChartReplay.mobile-layout.test.ts`, add:

```ts
const overlay = readFileSync("src/components/ChartDrawingOverlay.tsx", "utf8");
assert.match(overlay, /data-testid="chart-drawing-overlay"/);
assert.match(overlay, /calculateVolumeProfile/);
assert.match(overlay, /getAsianSessionRangeForTime/);
assert.match(overlay, /getFibonacciLines/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: FAIL because `ChartDrawingOverlay.tsx` does not exist.

- [ ] **Step 3: Implement first overlay**

Add:

```tsx
import type { CandlestickData, Time } from "lightweight-charts";
import { calculateVolumeProfile } from "./chartVolumeProfile";
import { getAsianSessionRangeForTime, getEuropeRomeDayRangeForTime, selectCandlesInRange } from "./chartSessionTime";
import { getFibonacciLines, getLineStyleDashArray, normalizeRect, type ScreenPoint } from "./chartDrawingGeometry";
import type { ChartDrawing, ChartDrawingState, ChartPoint, DrawingTool } from "./chartDrawingTypes";

interface CoordinateApi {
  timeToCoordinate: (time: Time) => number | null;
  priceToCoordinate: (price: number) => number | null;
  coordinateToTime: (x: number) => Time | null;
  coordinateToPrice: (y: number) => number | null;
}

interface ChartDrawingOverlayProps {
  width: number;
  height: number;
  visibleCandles: Array<CandlestickData<Time> & { volume?: number }>;
  allCandles: Array<CandlestickData<Time> & { volume?: number }>;
  currentTime: number | null;
  drawingState: ChartDrawingState;
  activeTool: DrawingTool;
  coordinateApi: CoordinateApi;
  selectedDrawingId: string | null;
  onCreateDrawing: (drawing: Omit<ChartDrawing, "id" | "createdAt">) => void;
  onSelectDrawing: (id: string | null) => void;
}

function toScreen(point: ChartPoint, api: CoordinateApi): ScreenPoint | null {
  const x = api.timeToCoordinate(point.time);
  const y = api.priceToCoordinate(point.price);
  return x == null || y == null ? null : { x, y };
}

export function ChartDrawingOverlay({
  width,
  height,
  visibleCandles,
  allCandles,
  currentTime,
  drawingState,
  activeTool,
  coordinateApi,
  selectedDrawingId,
  onCreateDrawing,
  onSelectDrawing,
}: ChartDrawingOverlayProps) {
  const currentDailyRange = currentTime == null ? null : getEuropeRomeDayRangeForTime(currentTime);
  const currentDayCandles = currentDailyRange ? selectCandlesInRange(allCandles, currentDailyRange) : [];
  const svp = drawingState.svp.enabled ? calculateVolumeProfile(currentDayCandles, drawingState.svp) : null;
  const asianRange = currentTime == null ? null : getAsianSessionRangeForTime(currentTime);
  const asianStartX = asianRange ? coordinateApi.timeToCoordinate(asianRange.start as Time) : null;
  const asianEndX = asianRange ? coordinateApi.timeToCoordinate(asianRange.end as Time) : null;
  const firstVisible = visibleCandles[0]?.time as number | undefined;
  const lastVisible = visibleCandles.at(-1)?.time as number | undefined;
  const showAsian = drawingState.asianSession.enabled && asianRange && firstVisible != null && lastVisible != null && asianRange.end > firstVisible && asianRange.start < lastVisible;

  return (
    <svg data-testid="chart-drawing-overlay" className="pointer-events-none absolute inset-0 z-10 h-full w-full" width={width} height={height}>
      {showAsian && asianStartX != null && asianEndX != null && (
        <g>
          <rect x={Math.max(0, asianStartX)} y={0} width={Math.max(0, Math.min(width, asianEndX) - Math.max(0, asianStartX))} height={height} fill={drawingState.asianSession.fillColor} opacity={drawingState.asianSession.fillOpacity} />
          {drawingState.asianSession.showBorders && <line x1={asianStartX} x2={asianStartX} y1={0} y2={height} stroke={drawingState.asianSession.fillColor} strokeOpacity={0.35} strokeDasharray="4 4" />}
          {drawingState.asianSession.showLabel && <text x={Math.max(6, asianStartX + 6)} y={18} fill={drawingState.asianSession.fillColor} fontSize={11}>Asia</text>}
        </g>
      )}
      {svp && currentDailyRange && (
        <g opacity={drawingState.svp.opacity}>
          {svp.buckets.map((bucket) => {
            const y1 = coordinateApi.priceToCoordinate(bucket.priceHigh);
            const y2 = coordinateApi.priceToCoordinate(bucket.priceLow);
            if (y1 == null || y2 == null) return null;
            const maxVolume = Math.max(...svp.buckets.map((b) => b.volume));
            const barWidth = maxVolume > 0 ? (bucket.volume / maxVolume) * 90 : 0;
            const x = drawingState.svp.side === "right" ? width - barWidth - 8 : 8;
            return <rect key={`${bucket.priceLow}-${bucket.priceHigh}`} x={x} y={Math.min(y1, y2)} width={barWidth} height={Math.max(1, Math.abs(y2 - y1))} fill={bucket.inValueArea ? drawingState.svp.valueAreaColor : drawingState.svp.barColor} />;
          })}
          {(() => {
            const pocY = coordinateApi.priceToCoordinate((svp.poc.priceLow + svp.poc.priceHigh) / 2);
            return pocY == null ? null : <line x1={0} x2={width} y1={pocY} y2={pocY} stroke={drawingState.svp.pocColor} strokeWidth={1} strokeDasharray="5 4" />;
          })()}
        </g>
      )}
      {drawingState.drawings.map((drawing) => {
        const a = toScreen(drawing.points[0], coordinateApi);
        const b = toScreen(drawing.points[1], coordinateApi);
        if (!a || !b) return null;
        const common = {
          stroke: drawing.style.stroke,
          strokeWidth: drawing.style.strokeWidth,
          opacity: drawing.style.opacity,
          strokeDasharray: getLineStyleDashArray(drawing.style.lineStyle),
        };
        if (drawing.kind === "rectangle") {
          const rect = normalizeRect(a, b);
          return <rect key={drawing.id} {...rect} {...common} fill={drawing.style.fill} fillOpacity={drawing.style.fillOpacity} />;
        }
        if (drawing.kind === "fibonacci") {
          return (
            <g key={drawing.id}>
              {getFibonacciLines(drawing.points[0], drawing.points[1], drawing.levels).map((line) => {
                const y = coordinateApi.priceToCoordinate(line.price);
                return y == null ? null : <line key={line.level} x1={Math.min(a.x, b.x)} x2={Math.max(a.x, b.x)} y1={y} y2={y} {...common} />;
              })}
            </g>
          );
        }
        return <line key={drawing.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} markerEnd={drawing.kind === "arrow" ? "url(#drawing-arrow)" : undefined} />;
      })}
      <defs>
        <marker id="drawing-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: PASS and prints `mobile backtest layout checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ChartDrawingOverlay.tsx artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts
git commit -m "feat: add chart drawing overlay"
```

---

### Task 10: Integrate Drawing UI Into ChartReplay

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`

- [ ] **Step 1: Add failing static test assertions**

In `ChartReplay.mobile-layout.test.ts`, add:

```ts
assert.match(chartReplay, /<ChartDrawingToolbar/);
assert.match(chartReplay, /<ChartDrawingOverlay/);
assert.match(chartReplay, /<ChartDrawingProperties/);
assert.match(chartReplay, /drawingState/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: FAIL because `ChartReplay.tsx` does not render the new components.

- [ ] **Step 3: Add imports and state**

In `ChartReplay.tsx`, import:

```ts
import { ChartDrawingOverlay } from "./ChartDrawingOverlay";
import { ChartDrawingProperties } from "./ChartDrawingProperties";
import { ChartDrawingToolbar } from "./ChartDrawingToolbar";
import { DEFAULT_CHART_DRAWING_STATE, type ChartDrawing, type ChartDrawingState, type DrawingTool } from "./chartDrawingTypes";
import { createDrawing } from "./chartDrawingPersistence";
```

Add state near replay state:

```ts
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingTool>("select");
  const [drawingState, setDrawingState] = useState<ChartDrawingState>(restoredState?.drawingState ?? DEFAULT_CHART_DRAWING_STATE);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const drawingHistoryRef = useRef<ChartDrawingState[]>([]);
```

Add drawing callbacks:

```ts
  const pushDrawingHistory = useCallback(() => {
    drawingHistoryRef.current = [...drawingHistoryRef.current.slice(-20), drawingState];
  }, [drawingState]);

  const handleCreateDrawing = useCallback((draft: Omit<ChartDrawing, "id" | "createdAt">) => {
    pushDrawingHistory();
    setDrawingState((prev) => ({
      ...prev,
      drawings: [...prev.drawings, createDrawing(draft.kind, draft.points, draft.style)],
    }));
  }, [pushDrawingHistory]);

  const handleUndoDrawing = useCallback(() => {
    const previous = drawingHistoryRef.current.pop();
    if (previous) setDrawingState(previous);
  }, []);

  const selectedDrawing = useMemo(
    () => drawingState.drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null,
    [drawingState.drawings, selectedDrawingId],
  );
```

- [ ] **Step 4: Preserve volume on candle data**

Change the `allCandles` state type from:

```ts
  const [allCandles, setAllCandles] = useState<CandlestickData<Time>[]>([]);
```

to:

```ts
  const [allCandles, setAllCandles] = useState<Array<CandlestickData<Time> & { volume?: number }>>([]);
```

In the candle mapping inside `fetchReplayCandles(...).then(...)`, include volume on each candle:

```ts
        const candles: Array<CandlestickData<Time> & { volume?: number }> = data.candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
```

Keep the existing `allVolumes` state for the built-in lower volume histogram.

- [ ] **Step 5: Persist drawing state**

In the `serializeReplayState` call, add:

```ts
        drawingState,
```

Add `drawingState` to the persistence `useEffect` dependency array.

- [ ] **Step 6: Track chart size**

Inside the existing `handleResize`, after `chart.applyOptions(...)`, add:

```ts
        setChartSize({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
```

- [ ] **Step 7: Create coordinate API**

Add before return:

```ts
  const coordinateApi = useMemo(() => ({
    timeToCoordinate: (time: Time) => chartRef.current?.timeScale().timeToCoordinate(time) ?? null,
    priceToCoordinate: (price: number) => candleSeriesRef.current?.priceToCoordinate(price) ?? null,
    coordinateToTime: (x: number) => chartRef.current?.timeScale().coordinateToTime(x) ?? null,
    coordinateToPrice: (y: number) => candleSeriesRef.current?.coordinateToPrice(y) ?? null,
  }), []);
```

- [ ] **Step 8: Render toolbar, overlay, and properties**

Inside the chart container wrapper, before the `chartContainerRef` div, add:

```tsx
          {!loading && !error && (
            <>
              <ChartDrawingToolbar
                activeTool={activeDrawingTool}
                svpEnabled={drawingState.svp.enabled}
                asianSessionEnabled={drawingState.asianSession.enabled}
                onToolChange={setActiveDrawingTool}
                onToggleSvp={() => setDrawingState((prev) => ({ ...prev, svp: { ...prev.svp, enabled: !prev.svp.enabled } }))}
                onToggleAsianSession={() => setDrawingState((prev) => ({ ...prev, asianSession: { ...prev.asianSession, enabled: !prev.asianSession.enabled } }))}
                onUndo={handleUndoDrawing}
                onDeleteSelected={() => {
                  if (!selectedDrawingId) return;
                  pushDrawingHistory();
                  setDrawingState((prev) => ({ ...prev, drawings: prev.drawings.filter((drawing) => drawing.id !== selectedDrawingId) }));
                  setSelectedDrawingId(null);
                }}
                onClearAll={() => {
                  pushDrawingHistory();
                  setDrawingState((prev) => ({ ...prev, drawings: [] }));
                  setSelectedDrawingId(null);
                }}
              />
              <ChartDrawingOverlay
                width={chartSize.width}
                height={chartSize.height}
                visibleCandles={visibleCandles}
                allCandles={allCandles}
                currentTime={replayPointCloseTime}
                drawingState={drawingState}
                activeTool={activeDrawingTool}
                coordinateApi={coordinateApi}
                selectedDrawingId={selectedDrawingId}
                onCreateDrawing={handleCreateDrawing}
                onSelectDrawing={setSelectedDrawingId}
              />
              {(selectedDrawing || drawingState.svp.enabled || drawingState.asianSession.enabled) && (
                <ChartDrawingProperties
                  selectedDrawing={selectedDrawing}
                  defaultStyle={drawingState.defaultStyle}
                  svp={drawingState.svp}
                  asianSession={drawingState.asianSession}
                  onDefaultStyleChange={(style) => setDrawingState((prev) => ({ ...prev, defaultStyle: style }))}
                  onSvpChange={(svp) => setDrawingState((prev) => ({ ...prev, svp }))}
                  onAsianSessionChange={(asianSession) => setDrawingState((prev) => ({ ...prev, asianSession }))}
                />
              )}
            </>
          )}
```

- [ ] **Step 9: Run static test**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: PASS and prints `mobile backtest layout checks passed`.

- [ ] **Step 10: Run typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: PASS with `tsc -p tsconfig.json --noEmit`.

- [ ] **Step 11: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ChartReplay.tsx artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts
git commit -m "feat: integrate drawing tools into chart replay"
```

---

### Task 11: Pointer Creation for Manual Drawings

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ChartDrawingOverlay.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts`

- [ ] **Step 1: Add failing static assertion**

In `ChartReplay.mobile-layout.test.ts`, add:

```ts
assert.match(overlay, /onPointerDown/);
assert.match(overlay, /pendingPoint/);
assert.match(overlay, /coordinateToPrice/);
assert.match(overlay, /coordinateToTime/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts`

Expected: FAIL because pointer placement is not implemented yet.

- [ ] **Step 3: Implement two-click placement**

In `ChartDrawingOverlay.tsx`, import `useState`:

```ts
import { useState } from "react";
```

Add inside the component:

```ts
  const [pendingPoint, setPendingPoint] = useState<ChartPoint | null>(null);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === "select") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = coordinateApi.coordinateToTime(x);
    const price = coordinateApi.coordinateToPrice(y);
    if (time == null || price == null) return;
    const point = { time, price };
    if (!pendingPoint) {
      setPendingPoint(point);
      return;
    }
    onCreateDrawing({
      kind: activeTool,
      points: [pendingPoint, point],
      style: drawingState.defaultStyle,
      ...(activeTool === "fibonacci" ? { levels: drawingState.drawings.find((drawing) => drawing.kind === "fibonacci")?.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] } : {}),
    } as Omit<ChartDrawing, "id" | "createdAt">);
    setPendingPoint(null);
  };
```

Update the root SVG:

```tsx
    <svg
      data-testid="chart-drawing-overlay"
      className={`absolute inset-0 z-10 h-full w-full ${activeTool === "select" ? "pointer-events-none" : "pointer-events-auto cursor-crosshair"}`}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
    >
```

- [ ] **Step 4: Run test and typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ChartDrawingOverlay.tsx artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts
git commit -m "feat: add two click drawing placement"
```

---

### Task 12: Full Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingPersistence.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartSessionTime.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartVolumeProfile.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartDrawingGeometry.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartReplayPersistence.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/chartReplayWindow.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/ChartReplay.mobile-layout.test.ts
```

Expected: every command exits 0 and prints its success line.

- [ ] **Step 2: Run dashboard typecheck**

Run: `pnpm --filter @workspace/trader-dashboard run typecheck`

Expected: PASS with `tsc -p tsconfig.json --noEmit`.

- [ ] **Step 3: Run broader repo test command**

Run: `pnpm test`

Expected: PASS. If unrelated dirty-worktree tests fail, capture the exact failing file and error before deciding whether the failure is related.

- [ ] **Step 4: Manual QA**

Start the app with the existing local flow:

```bash
pnpm start:local
```

Open the dashboard, navigate to Backtest, open a session, and verify:

- replay still starts from 120 candles;
- progress display is still visible;
- toolbar is visible on the left side of the chart;
- rectangle, line, arrow, and Fibonacci can be placed with two clicks;
- SVP toggles on and renders the current Europe/Rome daily volume profile;
- Asian session toggles on and highlights 00:00-08:00 Europe/Rome;
- refresh preserves drawings and indicator settings;
- BUY/SELL, SL/TP click mode, play/pause, step forward/back, reset, and timeframe changes still work.

- [ ] **Step 5: Commit final verification notes if any docs changed**

If no docs changed during verification, do not create a commit. If a README or QA note is updated, commit only that file:

```bash
git add <changed-doc-file>
git commit -m "docs: add drawing tools qa notes"
```
