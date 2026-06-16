import assert from "node:assert/strict";
import { composeEdgeReport } from "./edgeReport.js";
import { type EdgeTrade } from "./tradeAnalytics.js";

// The composed response must keep the exact shape the OpenAPI EdgeReport schema
// (lib/api-spec/openapi.yaml) declares. These guards fail loudly if the service
// drifts from the contract without the spec being updated.

const sample: EdgeTrade[] = [
  {
    symbol: "EURUSD", direction: "buy",
    openTime: "2026-06-15T09:00:00Z", closeTime: "2026-06-15T10:00:00Z",
    entryPrice: 1.1, exitPrice: 1.2, stopLoss: 1.05, profit: 100,
  },
  {
    symbol: "EURUSD", direction: "sell",
    openTime: "2026-06-15T14:00:00Z", closeTime: "2026-06-15T15:00:00Z",
    entryPrice: 1.1, exitPrice: 1.125, stopLoss: 1.15, profit: -50,
  },
];

{
  const report = composeEdgeReport(sample);

  assert.deepEqual(
    Object.keys(report).sort(),
    ["breakdowns", "discipline", "generatedAt", "guard", "highlights", "overall"],
    "EdgeReport top-level keys",
  );
  assert.deepEqual(
    Object.keys(report.overall).sort(),
    ["avgLoss", "avgLossR", "avgWin", "avgWinR", "closedTrades", "expectancyR", "netProfit", "profitFactor", "tradesWithR", "winRate"],
    "EdgeOverall keys",
  );
  assert.deepEqual(
    Object.keys(report.breakdowns).sort(),
    ["byDayOfWeek", "byDirection", "bySession", "bySymbol"],
    "EdgeReportBreakdowns keys",
  );
  assert.deepEqual(
    Object.keys(report.highlights).sort(),
    ["bestSlice", "postLoss", "worstSlice"],
    "EdgeReportHighlights keys",
  );
  assert.deepEqual(
    Object.keys(report.discipline).sort(),
    ["drawdown", "holdTime", "overtrading", "stopDiscipline"],
    "DisciplineReport keys",
  );
  assert.deepEqual(
    Object.keys(report.guard).sort(),
    ["alerts", "evaluatedAt", "todayNetR", "todayTrades", "tradingDay"],
    "RiskGuardReport keys",
  );
}

// Empty input keeps the same shape (no missing keys, no crash).
{
  const report = composeEdgeReport([]);
  assert.equal(report.overall.closedTrades, 0);
  assert.equal(report.discipline.stopDiscipline, null);
  assert.deepEqual(Object.keys(report).sort(), ["breakdowns", "discipline", "generatedAt", "guard", "highlights", "overall"]);
}

console.log("edgeReport.test.ts: all assertions passed");
