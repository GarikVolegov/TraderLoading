import assert from "node:assert/strict";
import {
  chartPreferencesCacheKey,
  readChartPreferencesCache,
  receiveChartPreferences,
  resolveChartPreferencesConflict,
} from "./chartPreferencesSync";
import {
  defaultChartPreferences,
  isChartColor,
  parseBacktestChartPreferences,
  parseBacktestChartUpdate,
  pickChartSettings,
} from "../../../../../contracts/backtestChart";

const preferences = defaultChartPreferences();
assert.ok(parseBacktestChartPreferences(preferences));
assert.equal(parseBacktestChartUpdate({ revision: -1, preferences }), null);
assert.equal(parseBacktestChartUpdate({ revision: 1.5, preferences }), null);
assert.equal(parseBacktestChartPreferences({ ...preferences, version: 2 }), null);
for (const color of ["#abc", "#abcd", "#abcdef", "#abcdef00", "rgba(20, 40, 60, 0.25)"])
  assert.equal(isChartColor(color), true, color);
for (const color of [
  "var(--private)",
  "url(http://example.test)",
  "rgba(256, 0, 0, 1)",
  "rgba(0, 0, 0, 2)",
  "#12345",
])
  assert.equal(isChartColor(color), false, color);
assert.equal(
  parseBacktestChartPreferences({
    ...preferences,
    settings: { ...preferences.settings, candleUpColor: "invalid" },
  }),
  null,
);
assert.equal(
  parseBacktestChartPreferences({ ...preferences, favoriteTools: ["trend", "trend"] }),
  null,
);
assert.equal(
  parseBacktestChartPreferences({ ...preferences, favoriteColors: Array(25).fill("#ffffff") }),
  null,
);
assert.equal(
  parseBacktestChartPreferences({ ...preferences, toolbarPosition: { x: Infinity, y: 0 } }),
  null,
);
assert.equal(
  parseBacktestChartPreferences({
    ...preferences,
    templates: [
      {
        id: "bad",
        name: "bad",
        settings: preferences.settings,
        indicators: [{ id: "x", type: "unknown", on: true, color: "#fff" }],
      },
    ],
  }),
  null,
);
const legacy = {
  ...preferences.settings,
  spreadPips: 999,
  commissionPerLot: 100,
  toolWidth: 3,
  chartBgColor1: "#eeffee",
};
assert.equal("spreadPips" in pickChartSettings(legacy), false);
assert.equal("commissionPerLot" in pickChartSettings(legacy), false);
const migrated = parseBacktestChartPreferences({
  ...preferences,
  templates: [{ id: "a", name: "Template", settings: legacy, indicators: [] }],
});
assert.ok(migrated);
assert.equal("spreadPips" in migrated.templates[0].settings, false);
assert.equal(migrated.templates[0].settings.chartBgColor1, "#eeffee");
assert.notEqual(chartPreferencesCacheKey("account/a"), chartPreferencesCacheKey("account/b"));
assert.notEqual(chartPreferencesCacheKey(null), chartPreferencesCacheKey("guest"));
let state = readChartPreferencesCache(null, legacy);
assert.equal(state.preferences.settings.toolWidth, 3);
assert.equal(state.preferences.settings.chartBgColor1, "#eeffee");
state = receiveChartPreferences(state, { revision: 0, preferences: null });
assert.equal(state.dirty, true, "empty account imports legacy once");
assert.equal(state.status, "pending");
const online = { ...preferences, favoriteTools: ["text"] };
const clean = readChartPreferencesCache(JSON.stringify({ revision: 1, preferences, dirty: false }));
assert.deepEqual(
  receiveChartPreferences(clean, { revision: 2, preferences: online }).preferences,
  online,
);
const dirty = { ...clean, dirty: true };
assert.equal(receiveChartPreferences(dirty, { revision: 1, preferences }).status, "pending");
const conflict = receiveChartPreferences(dirty, { revision: 2, preferences: online });
assert.equal(conflict.status, "conflict");
assert.deepEqual(
  conflict.preferences,
  dirty.preferences,
  "offline changes survive a conflicting remote snapshot",
);
assert.equal(resolveChartPreferencesConflict(conflict, "local").revision, 2);
assert.equal(resolveChartPreferencesConflict(conflict, "local").dirty, true);
assert.deepEqual(resolveChartPreferencesConflict(conflict, "remote").preferences, online);
assert.equal(resolveChartPreferencesConflict(conflict, "remote").dirty, false);
assert.equal(readChartPreferencesCache("broken").revision, 0);
console.log("chart preferences contract, migration and sync transitions passed");
