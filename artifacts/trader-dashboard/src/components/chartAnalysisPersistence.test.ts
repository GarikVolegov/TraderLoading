import assert from "node:assert/strict";
import {
  DEFAULT_CHART_ANALYSIS_STATE,
  DEFAULT_FIBONACCI_LEVELS,
  type ChartAnalysisState,
} from "./chartAnalysisTypes.js";
import {
  parseAnalysisState,
  serializeAnalysisState,
} from "./chartAnalysisPersistence.js";

const state: ChartAnalysisState = {
  ...DEFAULT_CHART_ANALYSIS_STATE,
  indicators: {
    ...DEFAULT_CHART_ANALYSIS_STATE.indicators,
    vwap: { ...DEFAULT_CHART_ANALYSIS_STATE.indicators.vwap, enabled: true },
    volumeProfile: {
      ...DEFAULT_CHART_ANALYSIS_STATE.indicators.volumeProfile,
      enabled: true,
      rows: 32,
    },
  },
  sessionBoxes: {
    ...DEFAULT_CHART_ANALYSIS_STATE.sessionBoxes,
    asia: { ...DEFAULT_CHART_ANALYSIS_STATE.sessionBoxes.asia, enabled: true },
    london: { ...DEFAULT_CHART_ANALYSIS_STATE.sessionBoxes.london, enabled: true },
    newYork: { ...DEFAULT_CHART_ANALYSIS_STATE.sessionBoxes.newYork, enabled: false },
  },
  drawings: [
    {
      id: "line-1",
      kind: "line",
      points: [
        { time: 1780876800 as never, price: 1.1 },
        { time: 1780880400 as never, price: 1.2 },
      ],
      style: DEFAULT_CHART_ANALYSIS_STATE.defaultDrawingStyle,
      createdAt: "2026-06-11T10:00:00.000Z",
    },
    {
      id: "fib-1",
      kind: "fibonacci",
      points: [
        { time: 1780876800 as never, price: 1.3 },
        { time: 1780880400 as never, price: 1.1 },
      ],
      style: DEFAULT_CHART_ANALYSIS_STATE.defaultDrawingStyle,
      levels: DEFAULT_FIBONACCI_LEVELS,
      createdAt: "2026-06-11T10:01:00.000Z",
    },
  ],
};

const restored = parseAnalysisState(serializeAnalysisState(state));
assert.equal(restored.indicators.vwap.enabled, true);
assert.equal(restored.indicators.volumeProfile.rows, 32);
assert.equal(restored.sessionBoxes.asia.enabled, true);
assert.equal(restored.sessionBoxes.london.enabled, true);
assert.equal(restored.sessionBoxes.newYork.enabled, false);
assert.equal(restored.drawings.length, 2);
assert.equal(restored.drawings[1]?.kind, "fibonacci");

assert.deepEqual(parseAnalysisState(null), DEFAULT_CHART_ANALYSIS_STATE);
assert.deepEqual(parseAnalysisState("{bad json"), DEFAULT_CHART_ANALYSIS_STATE);
assert.deepEqual(parseAnalysisState(JSON.stringify({ version: 999 })), DEFAULT_CHART_ANALYSIS_STATE);
assert.equal(parseAnalysisState(JSON.stringify({ version: 1, drawings: [{ kind: "line" }] })).drawings.length, 0);

console.log("chart analysis persistence checks passed");
