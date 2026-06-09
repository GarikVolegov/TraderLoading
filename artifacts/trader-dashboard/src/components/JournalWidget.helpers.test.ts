import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  getJournalEntryEffectiveResult,
  getJournalEntryNetPnl,
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

const summary = getJournalWidgetSummary(entries, new Date("2026-06-12T12:00:00.000Z"));
assert.equal(summary.todayCount, 1);
assert.equal(summary.weekly.total, 3);
assert.equal(summary.weekly.wins, 1);
assert.equal(summary.weekly.losses, 1);
assert.equal(summary.weekly.breakevens, 1);
assert.equal(summary.weekly.winRate, 33);
assert.equal(summary.latestEntry?.id, 4);

const rollingSummary = getJournalWidgetSummary(
  [
    {
      id: 10,
      title: "Previous week but inside 7 days",
      content: "",
      tradeDate: "2026-06-04",
      result: "win",
      tags: null,
      images: [],
      createdAt: "2026-06-04T08:00:00.000Z",
      updatedAt: "2026-06-04T08:00:00.000Z",
    },
    {
      id: 11,
      title: "Current week loss",
      content: "",
      tradeDate: "2026-06-09",
      result: "loss",
      tags: null,
      images: [],
      createdAt: "2026-06-09T08:00:00.000Z",
      updatedAt: "2026-06-09T08:00:00.000Z",
    },
  ],
  new Date("2026-06-10T12:00:00.000Z"),
);
assert.equal(rollingSummary.weekly.total, 2, "dashboard label says last 7 days, not current calendar week");
assert.equal(rollingSummary.weekly.wins, 1);
assert.equal(rollingSummary.weekly.losses, 1);
assert.equal(rollingSummary.weekly.winRate, 50);

const netLossSummary = getJournalWidgetSummary(
  [
    {
      id: 12,
      title: "Gross win but net loss",
      content: [
        "Ticket: 12",
        "Source: FX Blue Account Sync",
        "Symbol: XAUUSD",
        "Direction: BUY",
        "Profit: 5.00 EUR",
        "Commission: -8.00 EUR",
        "Swap: 0.00 EUR",
      ].join("\n"),
      tradeDate: "2026-06-10",
      result: "win",
      tags: "account-import,fxblue",
      images: [],
      createdAt: "2026-06-10T08:00:00.000Z",
      updatedAt: "2026-06-10T08:00:00.000Z",
    },
  ],
  new Date("2026-06-10T12:00:00.000Z"),
);
assert.equal(getJournalEntryNetPnl(netLossSummary.latestEntry), -3);
assert.equal(getJournalEntryEffectiveResult(netLossSummary.latestEntry), "loss");
assert.equal(netLossSummary.weekly.wins, 0, "imported trades should use net P&L for outcome");
assert.equal(netLossSummary.weekly.losses, 1);
assert.equal(netLossSummary.weekly.winRate, 0);

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
