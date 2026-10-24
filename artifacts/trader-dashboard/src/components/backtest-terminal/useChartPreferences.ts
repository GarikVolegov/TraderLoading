import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiFetch";
import {
  createChartTemplateStorageKey,
  parseChartTemplates,
} from "@/lib/replay/terminalPersistence";
import {
  chartPreferencesCacheKey,
  readChartPreferencesCache,
  receiveChartPreferences,
  resolveChartPreferencesConflict,
  type ChartSyncState,
} from "@/lib/replay/chartPreferencesSync";
import {
  DEFAULT_FAVORITE_TOOLS,
  LEGACY_DEFAULT_FAVORITE_TOOLS,
  parseBacktestChartPreferences,
  pickChartSettings,
  type BacktestChartPreferences,
  type BacktestChartSnapshot,
} from "../../../../../contracts/backtestChart";

function upgradeLegacyFavoriteTools(preferences: BacktestChartPreferences): BacktestChartPreferences {
  if (
    preferences.favoriteTools.length === LEGACY_DEFAULT_FAVORITE_TOOLS.length &&
    preferences.favoriteTools.every((id, i) => id === LEGACY_DEFAULT_FAVORITE_TOOLS[i])
  ) {
    return { ...preferences, favoriteTools: [...DEFAULT_FAVORITE_TOOLS] };
  }
  return preferences;
}

function readInitial(userId: string | null, legacy: unknown): ChartSyncState {
  try {
    const raw = localStorage.getItem(chartPreferencesCacheKey(userId));
    const state = readChartPreferencesCache(raw, legacy);
    state.preferences = upgradeLegacyFavoriteTools(state.preferences);
    if (!raw) {
      const templates = parseChartTemplates(localStorage.getItem(createChartTemplateStorageKey()));
      state.preferences.templates = Object.entries(templates)
        .slice(0, 50)
        .map(([name, template], i) => ({
          id: `legacy-${i}`,
          name: name.slice(0, 80),
          settings: pickChartSettings(template.settings),
          indicators: template.indicators,
        }));
      // Migration must also pass the same portable contract as a normal save.
      state.preferences =
        parseBacktestChartPreferences(state.preferences) ??
        readChartPreferencesCache(null, legacy).preferences;
    }
    return state;
  } catch {
    return readChartPreferencesCache(null, legacy);
  }
}
async function fetchSnapshot(signal: AbortSignal): Promise<BacktestChartSnapshot> {
  const response = await apiRequest("settings/backtest-chart", { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return validateSnapshot(await response.json());
}
function validateSnapshot(value: unknown): BacktestChartSnapshot {
  const result = value as BacktestChartSnapshot | null;
  if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0)
    throw new Error("Invalid chart revision");
  const preferences =
    result.preferences === null ? null : parseBacktestChartPreferences(result.preferences);
  if (result.preferences !== null && !preferences) throw new Error("Invalid chart preferences");
  return {
    revision: result.revision,
    preferences: preferences ? upgradeLegacyFavoriteTools(preferences) : null,
  };
}

/** One isolated controller per identity; stale network responses cannot cross account boundaries. */
export function useChartPreferences(legacy: unknown) {
  const { userId, isLoaded } = useAuth();
  const identity = userId ?? null;
  const legacyRef = useRef(legacy);
  const controller = useMemo(
    () => ({ identity, state: readInitial(identity, legacyRef.current), saving: false }),
    [identity],
  );
  const [render, setRender] = useState(0);
  void render;
  const [retryCounter, setRetryCounter] = useState(0);
  const activeRef = useRef(controller);
  activeRef.current = controller;
  const commit = useCallback(
    (next: ChartSyncState) => {
      if (activeRef.current !== controller) return;
      controller.state = next;
      try {
        localStorage.setItem(
          chartPreferencesCacheKey(identity),
          JSON.stringify({
            revision: next.revision,
            preferences: next.preferences,
            dirty: next.dirty,
          }),
        );
      } catch {
        controller.state = { ...next, status: "error" };
      }
      setRender((n) => n + 1);
    },
    [controller, identity],
  );

  const retry = useCallback(() => setRetryCounter((n) => n + 1), []);
  useEffect(() => {
    if (!isLoaded) return;
    if (!identity) {
      commit({ ...controller.state, ready: true, status: "local" });
      return;
    }
    const abort = new AbortController();
    fetchSnapshot(abort.signal)
      .then((snapshot) => {
        if (!abort.signal.aborted) commit(receiveChartPreferences(controller.state, snapshot));
      })
      .catch(() => {
        if (!abort.signal.aborted)
          commit({ ...controller.state, status: navigator.onLine ? "error" : "offline" });
      });
    return () => abort.abort();
  }, [controller, identity, isLoaded, commit, retryCounter]);

  useEffect(() => {
    const onOnline = () => retry();
    const onStorage = (event: StorageEvent) => {
      if (event.key === chartPreferencesCacheKey(identity) && identity) retry();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
    };
  }, [identity, retry]);

  const state = controller.state;
  useEffect(() => {
    if (
      !identity ||
      !state.ready ||
      !state.dirty ||
      state.status !== "pending" ||
      controller.saving
    )
      return;
    // Do not abort an in-flight PUT on every edit: it may already have committed server-side.
    const timer = window.setTimeout(async () => {
      const sent = controller.state;
      if (activeRef.current !== controller || sent.status !== "pending") return;
      controller.saving = true;
      commit({ ...sent, status: "saving" });
      try {
        const response = await apiRequest("settings/backtest-chart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: sent.revision, preferences: sent.preferences }),
        });
        if (activeRef.current !== controller) return;
        if (response.status === 409) {
          commit({
            ...controller.state,
            remote: validateSnapshot(await response.json()),
            status: "conflict",
          });
        } else {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const saved = validateSnapshot(await response.json());
          if (activeRef.current !== controller) return;
          const changed = controller.state.preferences !== sent.preferences;
          commit({
            ...controller.state,
            revision: saved.revision,
            dirty: changed,
            status: changed ? "pending" : "saved",
            remote: null,
          });
        }
      } catch {
        if (activeRef.current === controller)
          commit({ ...controller.state, status: navigator.onLine ? "error" : "offline" });
      } finally {
        controller.saving = false;
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [state, controller, identity, commit]);

  const update = useCallback(
    (updater: (previous: BacktestChartPreferences) => BacktestChartPreferences) => {
      const current = controller.state;
      const preferences = parseBacktestChartPreferences(updater(current.preferences));
      if (!preferences) {
        commit({ ...current, status: "error" });
        return;
      }
      if (JSON.stringify(preferences) === JSON.stringify(current.preferences)) return;
      commit({
        ...current,
        preferences,
        dirty: true,
        status: !identity
          ? "local"
          : current.remote
            ? "conflict"
            : current.status === "saving"
              ? "saving"
              : current.ready
                ? "pending"
                : current.status,
      });
    },
    [controller, identity, commit],
  );
  const resolveConflict = useCallback(
    (choice: "local" | "remote") =>
      commit(resolveChartPreferencesConflict(controller.state, choice)),
    [controller, commit],
  );
  return { preferences: state.preferences, status: state.status, update, resolveConflict, retry };
}
