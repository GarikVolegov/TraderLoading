export type AdrLevelKey = "exhausted" | "elevated" | "room";

export type AdrTone = "destructive" | "warning" | "success";

/**
 * Percent of the 1-year average daily range (ADR) consumed by today's range.
 * `y1` is the 1-year ADR baseline (avg daily pips); `todayPips` is today's range.
 * Clamped to [0, 100]; returns 0 for non-finite inputs or `y1 <= 0`.
 */
export function adrPercentUsed(todayPips: number, y1: number): number {
  if (!Number.isFinite(todayPips) || !Number.isFinite(y1) || y1 <= 0) return 0;
  const pct = (todayPips / y1) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/** Maps an ADR-used percent to a status key + semantic tone (Claude Design thresholds). */
export function adrLevel(pct: number): { key: AdrLevelKey; tone: AdrTone } {
  if (pct >= 80) return { key: "exhausted", tone: "destructive" };
  if (pct >= 60) return { key: "elevated", tone: "warning" };
  return { key: "room", tone: "success" };
}
