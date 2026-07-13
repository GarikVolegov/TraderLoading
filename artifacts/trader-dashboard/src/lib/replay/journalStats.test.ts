import assert from "node:assert/strict";
import { computeJournalStats } from "./journalStats";
import type { ClosedTrade, TradeResult } from "./types";

function trade(input: { pips: number; profit: number; r: number | null; id: number }): ClosedTrade {
  const result: TradeResult = input.pips > 0 ? "win" : input.pips < 0 ? "loss" : "breakeven";
  return {
    id: input.id,
    direction: "buy",
    entryPrice: 1,
    exitPrice: 1,
    entryTime: input.id,
    exitTime: input.id + 1,
    stopLoss: 0.9,
    takeProfit: 1.2,
    lots: 0.1,
    pips: input.pips,
    profit: input.profit,
    rMultiple: input.r,
    exitReason: "manual",
    result,
  };
}

// empty journal
const empty = computeJournalStats([]);
assert.deepEqual(empty, {
  total: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  winRate: 0,
  netR: 0,
  expectancy: null,
  totalPips: 0,
  totalProfit: 0,
  avgMaeR: null,
  avgMfeR: null,
});

const stats = computeJournalStats([
  trade({ pips: 40, profit: 200, r: 2, id: 1 }),
  trade({ pips: -20, profit: -100, r: -1, id: 2 }),
  trade({ pips: 0, profit: 0, r: 0, id: 3 }),
  trade({ pips: 15, profit: 75, r: null, id: 4 }), // unsized: excluded from R aggregates
]);
assert.equal(stats.total, 4);
assert.equal(stats.wins, 2);
assert.equal(stats.losses, 1);
assert.equal(stats.breakevens, 1);
assert.equal(stats.winRate, 50); // 2/4
assert.equal(stats.netR, 1); // 2 − 1 + 0
assert.ok(Math.abs((stats.expectancy ?? NaN) - 1 / 3) < 1e-9); // mean over the 3 sized trades
assert.equal(stats.totalPips, 35);
assert.equal(stats.totalProfit, 175);

// journal with only unsized trades has no expectancy
const unsized = computeJournalStats([trade({ pips: 10, profit: 10, r: null, id: 1 })]);
assert.equal(unsized.expectancy, null);
assert.equal(unsized.netR, 0);

console.log("journalStats checks passed");

// ── MAE/MFE aggregates + time buckets ────────────────────────────────────────
{
  const { computeJournalStats, computeTimeBuckets } = await import("./journalStats");
  const mk = (over: Record<string, unknown>) => ({
    ...trade({ pips: 10, profit: 50, r: 1, id: 1 }),
    ...over,
  });
  const withExcursion = computeJournalStats([
    mk({ id: 1, maeR: 0.5, mfeR: 2 }),
    mk({ id: 2, maeR: 0.3, mfeR: 1 }),
    mk({ id: 3, maeR: null, mfeR: null }),
  ] as never);
  assert.equal(withExcursion.avgMaeR, 0.4);
  assert.equal(withExcursion.avgMfeR, 1.5);
  assert.equal(computeJournalStats([]).avgMaeR, null);

  // buckets: entry at 2021-01-04T09:30Z (Monday) and 2021-01-05T14:00Z (Tuesday)
  const buckets = computeTimeBuckets([
    mk({ id: 1, entryTime: Date.UTC(2021, 0, 4, 9, 30) / 1000, r: 2 }),
    mk({ id: 2, entryTime: Date.UTC(2021, 0, 4, 9, 45) / 1000, r: -1 }),
    mk({ id: 3, entryTime: Date.UTC(2021, 0, 5, 14, 0) / 1000, r: 0.5 }),
  ].map((t, i) => ({ ...t, rMultiple: [2, -1, 0.5][i] })) as never);
  const nine = buckets.byHour.find((b) => b.bucket === 9);
  assert.ok(nine);
  assert.equal(nine?.count, 2);
  assert.equal(nine?.netR, 1);
  const tuesday = buckets.byWeekday.find((b) => b.bucket === 2);
  assert.equal(tuesday?.count, 1);
  assert.equal(tuesday?.netR, 0.5);
  assert.equal(buckets.byHour.reduce((s, b) => s + b.count, 0), 3);
}

// ── tag collection + filtering + per-tag stats ──────────────────────────────
{
  const { collectTags, filterTradesByTags, statsByTag } = await import("./journalStats");
  const T = (id: number, tags: string[] | undefined, r: number) => ({
    ...trade({ pips: r * 10, profit: r * 50, r, id }),
    tags,
  });
  const list = [
    T(1, ["breakout", "london"], 2),
    T(2, ["breakout"], -1),
    T(3, ["reversal"], 1),
    T(4, undefined, 0.5),
    T(5, ["breakout", "reversal"], -1),
  ] as never[];

  // collectTags: unique, sorted, ignores empty
  assert.deepEqual(collectTags(list), ["breakout", "london", "reversal"]);
  assert.deepEqual(collectTags([]), []);

  // filter: OR semantics; empty selection = all
  assert.deepEqual(filterTradesByTags(list, []).map((t) => t.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(filterTradesByTags(list, ["reversal"]).map((t) => t.id), [3, 5]);
  assert.deepEqual(filterTradesByTags(list, ["london", "reversal"]).map((t) => t.id), [1, 3, 5]);
  assert.deepEqual(filterTradesByTags(list, ["missing"]).map((t) => t.id), []);

  // per-tag stats: count + net R, sorted by count desc
  const byTag = statsByTag(list);
  assert.deepEqual(byTag[0], { tag: "breakout", count: 3, netR: 0 }); // 2 − 1 − 1
  const reversal = byTag.find((s) => s.tag === "reversal");
  assert.deepEqual(reversal, { tag: "reversal", count: 2, netR: 0 }); // 1 − 1
  assert.equal(byTag.find((s) => s.tag === "london")?.count, 1);
}
