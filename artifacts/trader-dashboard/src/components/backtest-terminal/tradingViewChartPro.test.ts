import assert from "node:assert/strict";
import { CHART_TOOL_IDS } from "../../../../../contracts/backtestChart";
import { TOOL_KNOWLEDGE_CATALOG } from "./toolKnowledgeCatalog";
import { DRAWING_TOOL_CATEGORIES, DRAWING_TOOLS } from "./toolRailModel";
import {
  computeAnchoredVwap,
  isDrawingVisibleOnInterval,
  loadDrawingToolTemplates,
  saveDrawingToolTemplate,
  deleteDrawingToolTemplate,
} from "../../lib/replay/drawingWorkspace";
import {
  loadChartDrawings,
  saveChartDrawings,
  clearChartDrawings,
  DRAWINGS_SYNC_EVENT,
} from "../../lib/chart/drawingStorage";
import type { ReplayDrawing, ReplayCandle } from "../../lib/replay/types";

// 1. Verifichiamo che tutti i 24 strumenti abbiano catalogo di conoscenza TradingView completo
console.log("Verifica catalogo TradingView per tutti i 24 strumenti...");
for (const toolId of CHART_TOOL_IDS) {
  const item = TOOL_KNOWLEDGE_CATALOG[toolId];
  assert.ok(item, `Manca TOOL_KNOWLEDGE_CATALOG per ${toolId}`);
  assert.ok(item.title && item.title.length > 0, `Titolo mancante per ${toolId}`);
  assert.ok(item.categoryLabel && item.categoryLabel.length > 0, `Categoria mancante per ${toolId}`);
  assert.ok(Array.isArray(item.application) && item.application.length >= 1, `Spiegazione applicazione insufficiente per ${toolId}`);
  assert.ok(typeof item.howToDraw === "string" && item.howToDraw.length > 10, `Guida d'uso mancante per ${toolId}`);
  assert.ok(item.proTip && item.proTip.length > 10, `Consiglio operativo mancante per ${toolId}`);
  assert.ok(item.settingsOverview && item.settingsOverview.style, `Panoramica impostazioni mancante per ${toolId}`);
}
assert.equal(Object.keys(TOOL_KNOWLEDGE_CATALOG).length, 24);

// Verifichiamo che le categorie del ToolRail coprano tutti i 24 strumenti
const toolRailIds = DRAWING_TOOLS.map((t) => t.id);
for (const id of CHART_TOOL_IDS) {
  assert.ok(toolRailIds.includes(id), `ToolRail manca dello strumento ${id}`);
}
assert.equal(DRAWING_TOOL_CATEGORIES.length, 6);

// 2. Test Algoritmo Anchored VWAP (AVWAP)
console.log("Verifica calcolo Anchored VWAP (AVWAP)...");
const sampleBars: ReplayCandle[] = [
  { time: 1000, open: 100, high: 105, low: 98, close: 102, volume: 100 },
  { time: 1060, open: 102, high: 108, low: 101, close: 107, volume: 150 },
  { time: 1120, open: 107, high: 112, low: 106, close: 110, volume: 200 },
  { time: 1180, open: 110, high: 111, low: 104, close: 105, volume: 120 },
];

const vwapSeries = computeAnchoredVwap(sampleBars, 1060, "hlc3", 1);
assert.equal(vwapSeries.length, 3, "AVWAP deve iniziare dalla barra di ancoraggio");
assert.equal(vwapSeries[0].time, 1060);
assert.ok(vwapSeries[0].vwap > 0);
assert.ok(vwapSeries[0].upper != null && vwapSeries[0].lower != null);
assert.ok(vwapSeries[0].upper! >= vwapSeries[0].vwap);
assert.ok(vwapSeries[0].lower! <= vwapSeries[0].vwap);

// 3. Test Filtro Visibilità Multi-Timeframe per Disegni
console.log("Verifica filtro visibilità multi-timeframe dei disegni...");
const sampleDrawing: ReplayDrawing = {
  id: "drw-test-1",
  kind: "trend",
  a: { time: 1000, price: 100 },
  b: { time: 2000, price: 150 },
  visibility: {
    ticks: true,
    seconds: { enabled: true, min: 1, max: 59 },
    minutes: { enabled: true, min: 1, max: 60 },
    hours: { enabled: true, min: 1, max: 4 }, // Visibile solo fino a 4 ore
    days: { enabled: false, min: 1, max: 366 }, // Nascosto su giornaliero
    weeks: { enabled: false, min: 1, max: 52 },
    months: { enabled: false, min: 1, max: 12 },
    ranges: true,
  },
};

// 15 minuti = 900 secondi -> visibile
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 900), true);
// 1 ora = 3600 secondi -> visibile
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 3600), true);
// 4 ore = 14400 secondi -> visibile
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 14400), true);
// 1 giorno = 86400 secondi -> nascosto
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 86400), false);
// 1 settimana = 604800 secondi -> nascosto
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 604800), false);

// 4. Test Modelli di Disegno (Drawing Tool Templates)
console.log("Verifica salvataggio e recupero modelli di disegno...");
// Mock window e localStorage per Node environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  key: () => null,
  length: 0,
};
let syncEventFired = false;
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: (event: any) => {
    if (event.type === DRAWINGS_SYNC_EVENT) syncEventFired = true;
    return true;
  },
  CustomEvent: class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
} as any;

saveDrawingToolTemplate("frvp", "Intraday POC", { id: "test", kind: "frvp", a: { time: 0, price: 0 }, b: { time: 0, price: 0 }, rows: 48, valueAreaPct: 0.68, widthPct: 50 });
const frvpTemplates = loadDrawingToolTemplates("frvp");
assert.equal(frvpTemplates.length, 1);
assert.equal(frvpTemplates[0].name, "Intraday POC");
assert.equal(frvpTemplates[0].props.rows, 48);

deleteDrawingToolTemplate(frvpTemplates[0].id, "frvp");
assert.equal(loadDrawingToolTemplates("frvp").length, 0);

// 5. Test Sincronizzazione Disegni per Simbolo (drawingStorage)
console.log("Verifica persistenza condivisa disegni tra Il Varco e Backtest...");

saveChartDrawings("EURUSD", [sampleDrawing]);
assert.equal(syncEventFired, true);

const loaded = loadChartDrawings("EURUSD");
assert.equal(loaded.length, 1);
assert.equal(loaded[0].id, "drw-test-1");

clearChartDrawings("EURUSD", "ALL");
const empty = loadChartDrawings("EURUSD");
assert.equal(empty.length, 0);

// 6. Test Ridimensionamento Avanzato Posizioni (Punto 7)
console.log("Verifica maniglie e ridimensionamento Posizione Long/Short...");
import { resizeDrawing } from "../../lib/replay/drawingWorkspace";

const posDrawing: ReplayDrawing = {
  id: "pos-1",
  kind: "position",
  direction: "buy",
  entry: { time: 1000, price: 2000 },
  slPrice: 1980,
  tpPrice: 2060,
  endTime: 1200,
};

// Drag TP: modifica solo tpPrice
const resizedTp = resizeDrawing(posDrawing, "tp", { time: 1000, price: 2080 });
assert.equal(resizedTp.kind === "position" && resizedTp.tpPrice, 2080);
assert.equal(resizedTp.kind === "position" && resizedTp.slPrice, 1980);

// Drag SL: modifica solo slPrice
const resizedSl = resizeDrawing(posDrawing, "sl", { time: 1000, price: 1970 });
assert.equal(resizedSl.kind === "position" && resizedSl.slPrice, 1970);
assert.equal(resizedSl.kind === "position" && resizedSl.tpPrice, 2060);

// Drag Entry: sposta l'intera posizione preservando il risk:reward in pips
const movedEntry = resizeDrawing(posDrawing, "entry", { time: 1050, price: 2010 });
assert.equal(movedEntry.kind === "position" && movedEntry.entry.price, 2010);
assert.equal(movedEntry.kind === "position" && movedEntry.slPrice, 1990); // 1980 + 10
assert.equal(movedEntry.kind === "position" && movedEntry.tpPrice, 2070); // 2060 + 10
assert.equal(movedEntry.kind === "position" && movedEntry.endTime, 1250); // 1200 + 50

console.log("Tutti i test di precisione TradingView Pro per Il Varco e Backtest sono passati con successo!");
