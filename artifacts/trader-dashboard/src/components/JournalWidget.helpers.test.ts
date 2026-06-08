import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  getJournalResultMeta,
  getJournalWidgetSummary,
  safeParseJournalDate,
  type JournalWidgetEntry,
} from "./JournalWidget.helpers.js";

const entries: JournalWidgetEntry[] = [
  {
    id: 1,
    title: "London breakout",
    content: "Followed the plan",
    tradeDate: "2026-06-08",
    result: "win",
    tags: "breakout",
    images: [],
    createdAt: "2026-06-08T08:00:00.000Z",
    updatedAt: "2026-06-08T08:00:00.000Z",
  },
  {
    id: 2,
    title: "NY reversal",
    content: "Cut early",
    tradeDate: "2026-06-09",
    result: "loss",
    tags: null,
    images: [],
    createdAt: "2026-06-09T13:00:00.000Z",
    updatedAt: "2026-06-09T13:00:00.000Z",
  },
  {
    id: 3,
    title: "Friday review",
    content: "",
    tradeDate: "2026-06-12",
    result: "breakeven",
    tags: null,
    images: [],
    createdAt: "2026-06-12T16:00:00.000Z",
    updatedAt: "2026-06-12T16:00:00.000Z",
  },
  {
    id: 4,
    title: "Bad date",
    content: "Should not crash stats",
    tradeDate: "not-a-date",
    result: "win",
    tags: null,
    images: [],
    createdAt: "2026-06-13T16:00:00.000Z",
    updatedAt: "2026-06-13T16:00:00.000Z",
  },
];

const parsedTradeDate = safeParseJournalDate("2026-06-08");
assert.equal(parsedTradeDate ? format(parsedTradeDate, "yyyy-MM-dd") : null, "2026-06-08");
assert.equal(safeParseJournalDate("not-a-date"), null);

const summary = getJournalWidgetSummary(entries, new Date("2026-06-08T12:00:00.000Z"));
assert.equal(summary.todayCount, 1);
assert.equal(summary.weekly.total, 3);
assert.equal(summary.weekly.wins, 1);
assert.equal(summary.weekly.losses, 1);
assert.equal(summary.weekly.breakevens, 1);
assert.equal(summary.weekly.winRate, 33);
assert.equal(summary.latestEntry?.id, 4);

const empty = getJournalWidgetSummary([], new Date("2026-06-08T12:00:00.000Z"));
assert.equal(empty.todayCount, 0);
assert.equal(empty.weekly.total, 0);
assert.equal(empty.weekly.winRate, 0);
assert.equal(empty.latestEntry, null);

assert.deepEqual(getJournalResultMeta("win"), { label: "Win", tone: "success" });
assert.deepEqual(getJournalResultMeta("loss"), { label: "Loss", tone: "danger" });
assert.deepEqual(getJournalResultMeta("breakeven"), { label: "Break Even", tone: "warning" });
assert.deepEqual(getJournalResultMeta("none"), { label: "Non segnato", tone: "muted" });

console.log("journal widget helper checks passed");
