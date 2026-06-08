export const ROUTINE_HISTORY_KEY = "tl_routine_completion_history_v1";
export const ROUTINE_CUSTOM_KEY = "tl_custom_routines_v1";

export type RoutineTemplate = "morning" | "evening";

export interface CustomRoutine {
  id: string;
  title: string;
  description: string;
  template: RoutineTemplate;
  timeLabel: string;
  createdAt: string;
}

export interface RoutineCompletionRecord {
  id: string;
  routineId: string;
  routineTitle: string;
  template: RoutineTemplate;
  completedAt: string;
  date: string;
  answers: Record<string, unknown>;
}

export interface RoutineSummaryMetric {
  routineId: string;
  routineTitle: string;
  template: RoutineTemplate;
  completions: number;
  lastCompletedAt: string | null;
}

export interface RoutineMetrics {
  totalCompletions: number;
  customRoutineCount: number;
  currentStreakDays: number;
  lastCompletedAt: string | null;
  byRoutine: RoutineSummaryMetric[];
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readArray<T>(key: string, storage?: Storage): T[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[], storage?: Storage): void {
  const target = getStorage(storage);
  if (!target) return;
  target.setItem(key, JSON.stringify(value));
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

export function loadCustomRoutines(storage?: Storage): CustomRoutine[] {
  return readArray<CustomRoutine>(ROUTINE_CUSTOM_KEY, storage).filter(
    (routine) =>
      typeof routine.id === "string" &&
      typeof routine.title === "string" &&
      (routine.template === "morning" || routine.template === "evening"),
  );
}

export function loadRoutineCompletions(storage?: Storage): RoutineCompletionRecord[] {
  return readArray<RoutineCompletionRecord>(ROUTINE_HISTORY_KEY, storage).filter(
    (record) =>
      typeof record.id === "string" &&
      typeof record.routineId === "string" &&
      typeof record.routineTitle === "string" &&
      typeof record.completedAt === "string" &&
      typeof record.date === "string" &&
      (record.template === "morning" || record.template === "evening"),
  );
}

export function createCustomRoutine(
  input: Pick<CustomRoutine, "title" | "description" | "template" | "timeLabel">,
  storage?: Storage,
  now = new Date(),
): CustomRoutine {
  const routines = loadCustomRoutines(storage);
  const title = input.title.trim();
  const createdAt = now.toISOString();
  const routine: CustomRoutine = {
    id: `custom-${dateKey(now)}-${slugify(title) || "routine"}-${routines.length + 1}`,
    title,
    description: input.description.trim(),
    template: input.template,
    timeLabel: input.timeLabel.trim(),
    createdAt,
  };

  writeArray(ROUTINE_CUSTOM_KEY, [...routines, routine], storage);
  return routine;
}

export function appendRoutineCompletion(
  input: Omit<RoutineCompletionRecord, "id" | "completedAt" | "date">,
  storage?: Storage,
  now = new Date(),
): RoutineCompletionRecord {
  const completions = loadRoutineCompletions(storage);
  const completedAt = now.toISOString();
  const record: RoutineCompletionRecord = {
    ...input,
    id: `${input.routineId}-${completedAt}`,
    completedAt,
    date: dateKey(now),
  };

  writeArray(ROUTINE_HISTORY_KEY, [...completions, record], storage);
  return record;
}

function daysBetween(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00.000Z`);
  const second = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((first - second) / 86_400_000);
}

export function getRoutineMetrics(
  completions: RoutineCompletionRecord[],
  customRoutines: CustomRoutine[],
): RoutineMetrics {
  const sorted = [...completions].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const byRoutineMap = new Map<string, RoutineSummaryMetric>();

  for (const routine of customRoutines) {
    byRoutineMap.set(routine.id, {
      routineId: routine.id,
      routineTitle: routine.title,
      template: routine.template,
      completions: 0,
      lastCompletedAt: null,
    });
  }

  for (const record of sorted) {
    const existing = byRoutineMap.get(record.routineId) ?? {
      routineId: record.routineId,
      routineTitle: record.routineTitle,
      template: record.template,
      completions: 0,
      lastCompletedAt: null,
    };

    existing.completions += 1;
    existing.routineTitle = record.routineTitle;
    existing.template = record.template;
    existing.lastCompletedAt = record.completedAt;
    byRoutineMap.set(record.routineId, existing);
  }

  const uniqueDates = [...new Set(sorted.map((record) => record.date))].sort().reverse();
  let currentStreakDays = 0;
  let previous: string | null = null;

  for (const date of uniqueDates) {
    if (!previous || daysBetween(previous, date) === 1) {
      currentStreakDays += 1;
      previous = date;
      continue;
    }
    break;
  }

  return {
    totalCompletions: completions.length,
    customRoutineCount: customRoutines.length,
    currentStreakDays,
    lastCompletedAt: sorted.at(-1)?.completedAt ?? null,
    byRoutine: [...byRoutineMap.values()].sort((a, b) => {
      if (b.completions !== a.completions) return b.completions - a.completions;
      const aCustom = a.routineId.startsWith("custom-") ? 1 : 0;
      const bCustom = b.routineId.startsWith("custom-") ? 1 : 0;
      if (aCustom !== bCustom) return aCustom - bCustom;
      return a.routineTitle.localeCompare(b.routineTitle);
    }),
  };
}
