import assert from "node:assert/strict";
import {
  getFibonacciLines,
  getLineStyleDashArray,
  hitTestDrawing,
  normalizeRect,
} from "./chartDrawingGeometry.js";
import { DEFAULT_CHART_ANALYSIS_STATE, DEFAULT_FIBONACCI_LEVELS } from "./chartAnalysisTypes.js";

const a = { x: 10, y: 20 };
const b = { x: 50, y: 80 };
assert.deepEqual(normalizeRect(a, b), { x: 10, y: 20, width: 40, height: 60 });
assert.deepEqual(normalizeRect(b, a), { x: 10, y: 20, width: 40, height: 60 });
assert.equal(getLineStyleDashArray("solid"), undefined);
assert.equal(getLineStyleDashArray("dashed"), "8 6");
assert.equal(getLineStyleDashArray("dotted"), "2 5");

const fibLines = getFibonacciLines(
  { time: 1 as never, price: 100 },
  { time: 2 as never, price: 200 },
  DEFAULT_FIBONACCI_LEVELS,
);
assert.equal(fibLines.find((line) => line.level === 0.5)?.price, 150);
assert.equal(fibLines.find((line) => line.level === 1)?.price, 200);

const drawing = {
  id: "line-1",
  kind: "line" as const,
  points: [
    { time: 1 as never, price: 100 },
    { time: 2 as never, price: 200 },
  ],
  style: DEFAULT_CHART_ANALYSIS_STATE.defaultDrawingStyle,
  createdAt: "2026-06-11T10:00:00.000Z",
};

const toScreen = (point: { price: number }) => ({ x: point.price - 90, y: point.price - 90 });
assert.equal(hitTestDrawing(drawing, { x: 60, y: 60 }, toScreen), true);
assert.equal(hitTestDrawing(drawing, { x: 60, y: 80 }, toScreen), false);

console.log("chart drawing geometry checks passed");
