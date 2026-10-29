import test from "node:test";
import assert from "node:assert/strict";
import {
  computeChronosMatrix,
  getSessionFromHour,
  extractTradeHourAndDay,
} from "./chronosMatrix.js";
import type { JournalEntry } from "@workspace/api-client-react";

test("getSessionFromHour maps 24 hours into 4 sovereign sessions", () => {
  assert.strictEqual(getSessionFromHour(3).code, "asia");
  assert.strictEqual(getSessionFromHour(8).code, "london");
  assert.strictEqual(getSessionFromHour(13).code, "london");
  assert.strictEqual(getSessionFromHour(14).code, "ny_overlap");
  assert.strictEqual(getSessionFromHour(17).code, "ny_overlap");
  assert.strictEqual(getSessionFromHour(18).code, "ny_close");
  assert.strictEqual(getSessionFromHour(23).code, "ny_close");
});

test("extractTradeHourAndDay extracts hour and day from openTime or ISO timestamps", () => {
  const entryWithOpenTime: Partial<JournalEntry> = {
    content: "Symbol: EURUSD\nOpen Time: 2026.10.20 15:30:00\nProfit: 150",
  };
  const extracted1 = extractTradeHourAndDay(entryWithOpenTime as JournalEntry);
  assert.strictEqual(extracted1.hour, 15);
  assert.strictEqual(extracted1.dayOfWeek, 2); // 2026-10-20 was Tuesday

  const entryWithIso: Partial<JournalEntry> = {
    createdAt: "2026-10-21T10:15:00.000Z",
  };
  const extracted2 = extractTradeHourAndDay(entryWithIso as JournalEntry);
  assert.ok(typeof extracted2.hour === "number");
});

test("computeChronosMatrix aggregates trades, virtues, leaks and identifies windows", () => {
  const mockEntries: Partial<JournalEntry>[] = [
    // Martedì ore 15 (NY Overlap) - Virtuous Win
    {
      id: 1,
      tradeDate: "2026-10-20",
      content: "Symbol: EURUSD\nOpen Time: 2026.10.20 15:30:00\nProfit: 250",
      result: "win",
      tags: "piano,target",
    },
    // Martedì ore 15 (NY Overlap) - Another Virtuous Win
    {
      id: 2,
      tradeDate: "2026-10-20",
      content: "Symbol: GBPUSD\nOpen Time: 2026.10.20 16:00:00\nProfit: 120",
      result: "win",
      tags: "pazienza",
    },
    // Venerdì ore 20 (NY Close) - Emotional Leak Loss
    {
      id: 3,
      tradeDate: "2026-10-23",
      content: "Symbol: USDJPY\nOpen Time: 2026.10.23 20:30:00\nProfit: -180",
      result: "loss",
      tags: "fomo,revenge",
    },
  ];

  const summary = computeChronosMatrix(mockEntries as JournalEntry[]);

  assert.strictEqual(summary.totalTrades, 3);
  assert.strictEqual(summary.totalVirtues, 3);
  assert.strictEqual(summary.totalLeaks, 2);
  assert.strictEqual(summary.globalIntegrityScore, 60); // 3 / (3 + 2) = 60%

  // Martedì is index 1, NY Overlap is index 2
  const tuesdayOverlap = summary.matrix[1][2];
  assert.strictEqual(tuesdayOverlap.tradesCount, 2);
  assert.strictEqual(tuesdayOverlap.winCount, 2);
  assert.strictEqual(tuesdayOverlap.winRate, 100);
  assert.strictEqual(tuesdayOverlap.netPnl, 370);
  assert.strictEqual(tuesdayOverlap.virtuesCount, 3);
  assert.strictEqual(tuesdayOverlap.integrityScore, 100);

  // Venerdì is index 4, NY Close is index 3
  const fridayClose = summary.matrix[4][3];
  assert.strictEqual(fridayClose.tradesCount, 1);
  assert.strictEqual(fridayClose.lossCount, 1);
  assert.strictEqual(fridayClose.netPnl, -180);
  assert.strictEqual(fridayClose.leaksCount, 2);
  assert.strictEqual(fridayClose.dominantLeak, "fomo");

  // Best & Danger Window detection
  assert.ok(summary.bestExecutionWindow);
  assert.strictEqual(summary.bestExecutionWindow?.dayLabel, "MAR");
  assert.strictEqual(summary.bestExecutionWindow?.sessionLabel, "NY Overlap");

  assert.ok(summary.dangerWindow);
  assert.strictEqual(summary.dangerWindow?.dayLabel, "VEN");
  assert.strictEqual(summary.dangerWindow?.sessionLabel, "NY Close");
});
