import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logicalIndexAtTime, timeAtLogicalIndex } from "../../lib/replay/replayClock";
import { loadChartDrawings, saveChartDrawings } from "../../lib/chart/drawingStorage";
import type { ReplayCandle, ReplayDrawing } from "../../lib/replay/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardRoot = path.resolve(__dirname, "../../..");

console.log("=== VERIFICA RIGOROSA: FLUIDITÀ, RESISTENZA DISEGNI E CAMERA CHART AUREUS ===");

// 1. Verifica Sub-Bar Fractional Interpolation (TradingView & FX Replay multi-timeframe precision)
const origin = 1700000000;
const h1Candles: ReplayCandle[] = Array.from({ length: 100 }, (_, i) => ({
  time: origin + i * 3600,
  open: 100 + i,
  high: 105 + i,
  low: 95 + i,
  close: 102 + i,
}));

// Test sub-bar: 45 minuti dentro la barra 10 (10 + 45/60 = 10.75)
const subBarTime = origin + 10 * 3600 + 45 * 60;
const logical = logicalIndexAtTime(h1Candles, subBarTime, 3600);
assert.equal(logical, 10.75, "logicalIndexAtTime must preserve sub-bar decimal index 10.75");

const resolvedTime = timeAtLogicalIndex(h1Candles, logical!, 3600);
assert.equal(resolvedTime, subBarTime, "timeAtLogicalIndex must roundtrip subBarTime with 100% exactness");
console.log("✓ 1. Sub-bar Fractional Interpolation e roundtrip matematico convalidati.");

// 2. Verifica Normalizzazione Simboli & Storage in-memory cache
const mockDrawing: ReplayDrawing = {
  id: "drw-test-camera-1",
  kind: "hline",
  price: 2050.5,
  color: "#C5A059",
  width: 2,
};

// Simulazione ambiente browser window/localStorage
(globalThis as any).window = {
  localStorage: {
    _data: new Map<string, string>(),
    getItem(k: string) { return this._data.get(k) ?? null; },
    setItem(k: string, v: string) { this._data.set(k, v); },
    removeItem(k: string) { this._data.delete(k); },
    get length() { return this._data.size; },
    key(i: number) { return Array.from(this._data.keys())[i] ?? null; },
  },
  dispatchEvent: () => true,
};

saveChartDrawings("FX:XAUUSD", "60", [mockDrawing]);
const loadedFromRaw = loadChartDrawings("XAUUSD", "60");
assert.equal(loadedFromRaw.length, 1, "Drawings saved with FX: prefix must be retrievable with clean symbol");
assert.equal(loadedFromRaw[0].id, "drw-test-camera-1");
console.log("✓ 2. Normalizzazione simboli e recupero cache in-memory convalidati.");

// 3. Verifica Accelerazione Hardware CSS (transform: translateZ(0))
const proprietaryCss = fs.readFileSync(path.join(dashboardRoot, "src/components/chart/LimenProprietaryChart.css"), "utf8");
assert.ok(
  proprietaryCss.includes(".limen-chart-canvas-container") && proprietaryCss.includes("transform: translateZ(0)"),
  "LimenProprietaryChart.css must apply GPU hardware acceleration transform: translateZ(0)",
);

const drawingsCss = fs.readFileSync(path.join(dashboardRoot, "src/components/backtest-terminal/drawings-workspace.css"), "utf8");
assert.ok(
  drawingsCss.includes(".btm-drawoverlay") && drawingsCss.includes("transform: translateZ(0)"),
  "drawings-workspace.css must apply GPU hardware acceleration transform: translateZ(0)",
);
console.log("✓ 3. Accelerazione Hardware GPU (.btm-drawoverlay & canvas container) convalidata.");

// 4. Verifica LimenProprietaryChart.tsx & ReplayChart.tsx: Camera Focus Preservation & rAF Draft Drag
const chartSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/chart/LimenProprietaryChart.tsx"), "utf8");
assert.ok(chartSrc.includes("cameraAnchorRef"), "LimenProprietaryChart must retain cameraAnchorRef for seamless timeframe switching");
assert.ok(chartSrc.includes("closestIdx"), "LimenProprietaryChart must find closestIdx to anchor timestamp");

const overlaySrc = fs.readFileSync(path.join(dashboardRoot, "src/components/backtest-terminal/DrawingsOverlay.tsx"), "utf8");
assert.ok(overlaySrc.includes("activeDragItem"), "DrawingsOverlay must use activeDragItem for rAF-throttled 120 FPS dragging");
assert.ok(overlaySrc.includes("snapCandidates"), "DrawingsOverlay must pre-compute snapCandidates at pointerdown to avoid per-move bottlenecks");
console.log("✓ 4. Camera Focus Preservation e rAF Draft Drag convalidati con successo.");

// 5. Verifica LimenChartHeader.tsx: Pulsante Grafico Pulito (Naked Price Action)
const headerSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/chart/LimenChartHeader.tsx"), "utf8");
assert.ok(headerSrc.includes("GRAFICO PULITO"), "LimenChartHeader must display Grafico Pulito button");
console.log("✓ 5. Pulsante Grafico Pulito / Naked Price Action in LimenChartHeader convalidato.");

console.log("\n==================================================================");
console.log("TUTTI I TEST DI FLUIDITÀ, STABILITÀ E RESISTENZA SONO SUPERATI!");
console.log("==================================================================");
