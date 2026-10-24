import {
  defaultChartPreferences,
  parseBacktestChartPreferences,
  type BacktestChartPreferences,
  type BacktestChartSnapshot,
} from "../../../../../contracts/backtestChart";

export type ChartSyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "offline"
  | "error"
  | "conflict"
  | "pending"
  | "local";
export interface ChartSyncState {
  preferences: BacktestChartPreferences;
  revision: number;
  dirty: boolean;
  ready: boolean;
  status: ChartSyncStatus;
  remote: BacktestChartSnapshot | null;
}
export function chartPreferencesCacheKey(userId: string | null): string {
  return `limen:backtest-chart:v1:${userId === null ? "anonymous" : `user:${encodeURIComponent(userId)}`}`;
}
export function readChartPreferencesCache(raw: string | null, legacy?: unknown): ChartSyncState {
  const initial: ChartSyncState = {
    preferences: defaultChartPreferences(legacy),
    revision: 0,
    dirty: false,
    ready: false,
    status: "loading",
    remote: null,
  };
  try {
    const parsed = JSON.parse(raw ?? "null");
    const preferences = parseBacktestChartPreferences(parsed?.preferences);
    if (preferences && Number.isSafeInteger(parsed.revision) && parsed.revision >= 0) {
      return { ...initial, preferences, revision: parsed.revision, dirty: parsed.dirty === true };
    }
  } catch {
    /* Invalid cache is recoverable from account preferences. */
  }
  return initial;
}
/** A dirty cache is never silently replaced by a newer device's preferences. */
export function receiveChartPreferences(
  state: ChartSyncState,
  remote: BacktestChartSnapshot,
): ChartSyncState {
  if (state.dirty && state.revision !== remote.revision)
    return { ...state, ready: true, remote, status: "conflict" };
  if (state.dirty) return { ...state, ready: true, remote: null, status: "pending" };
  if (remote.preferences)
    return {
      ...state,
      preferences: remote.preferences,
      revision: remote.revision,
      dirty: false,
      ready: true,
      status: "saved",
      remote: null,
    };
  return { ...state, revision: 0, dirty: true, ready: true, status: "pending", remote: null };
}
export function resolveChartPreferencesConflict(
  state: ChartSyncState,
  choice: "local" | "remote",
): ChartSyncState {
  if (!state.remote) return state;
  if (choice === "remote")
    return {
      ...state,
      preferences: state.remote.preferences ?? defaultChartPreferences(),
      revision: state.remote.revision,
      dirty: false,
      remote: null,
      status: "saved",
    };
  return {
    ...state,
    revision: state.remote.revision,
    dirty: true,
    remote: null,
    status: "pending",
  };
}
