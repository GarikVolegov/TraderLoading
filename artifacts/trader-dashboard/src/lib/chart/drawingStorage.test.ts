import assert from "node:assert/strict";
import test from "node:test";
import { clearChartDrawings, loadChartDrawings, saveChartDrawings } from "./drawingStorage";
import type { ReplayDrawing } from "../replay/types";

// Polyfill window.localStorage for node environment test
const memoryStore = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, val: string) => memoryStore.set(key, val),
    removeItem: (key: string) => memoryStore.delete(key),
  },
};

test("saveChartDrawings and loadChartDrawings roundtrip", () => {
  const drawings: ReplayDrawing[] = [
    {
      id: "drw-1",
      kind: "trend",
      a: { time: 1000, price: 100 },
      b: { time: 2000, price: 110 },
      color: "#d4af37",
      width: 2,
    },
  ];

  saveChartDrawings("XAUUSD", "H1", drawings);
  const loaded = loadChartDrawings("XAUUSD", "H1");
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "drw-1");

  clearChartDrawings("XAUUSD", "H1");
  const cleared = loadChartDrawings("XAUUSD", "H1");
  assert.equal(cleared.length, 0);
});

test("drawings saved on H1 persist when viewing M15 (multi-timeframe)", () => {
  const drawings: ReplayDrawing[] = [
    {
      id: "drw-h1",
      kind: "trend",
      a: { time: 1000, price: 2000 },
      b: { time: 2000, price: 2050 },
      color: "#d4af37",
      width: 2,
    },
  ];

  saveChartDrawings("XAUUSD", "H1", drawings);
  // User switches from H1 to M15
  const loadedOnM15 = loadChartDrawings("XAUUSD", "M15");
  assert.equal(loadedOnM15.length, 1);
  assert.equal(loadedOnM15[0].id, "drw-h1");

  clearChartDrawings("XAUUSD", "M15");
});
