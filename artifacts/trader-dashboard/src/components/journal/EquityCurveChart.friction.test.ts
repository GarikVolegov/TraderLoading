import { test } from "node:test";
import assert from "node:assert/strict";
import { cumulativeR } from "../../lib/equityProjection.js";

interface SampleJournalEntry {
  tradeDate: string;
  title: string;
  content: string;
  result: "win" | "loss" | "breakeven";
  tags?: string;
}

const LEAK_TAG_IDS = ["fomo", "anticipazione", "uscita_prematura", "revenge", "esitazione"];

function calculateTrajectoryFriction(entries: SampleJournalEntry[]) {
  const euroList: number[] = [];
  const idealEuroList: number[] = [];
  let cumEuro = 0;
  let cumIdealEuro = 0;
  let totalBleed = 0;

  const details = [
    {
      date: entries[0]?.tradeDate?.slice(0, 10),
      title: "Origine Capitale",
      pnl: 0,
      cumulativeEuro: 0,
      idealCumulativeEuro: 0,
    },
  ];

  for (const entry of entries) {
    // Parse mock profit
    const match = (entry.content ?? "").match(/(?:profit|pnl|p&l)\s*:\s*([+-]?\d+(?:\.\d+)?)/i);
    const profit = match ? parseFloat(match[1]) : entry.result === "win" ? 100 : entry.result === "loss" ? -100 : 0;

    const rawTags = (entry.tags ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const matchedLeaks = LEAK_TAG_IDS.filter((id) => rawTags.includes(id));
    const hasLeak = matchedLeaks.length > 0;

    const bleedAmount = hasLeak && profit < 0 ? Math.abs(profit) : 0;
    const idealProfit = hasLeak && profit < 0 ? 0 : profit;

    cumEuro += profit;
    cumIdealEuro += idealProfit;
    totalBleed += bleedAmount;

    euroList.push(profit);
    idealEuroList.push(idealProfit);

    details.push({
      date: entry.tradeDate.slice(0, 10),
      title: entry.title,
      pnl: profit,
      cumulativeEuro: Math.round(cumEuro * 100) / 100,
      idealCumulativeEuro: Math.round(cumIdealEuro * 100) / 100,
    });
  }

  return {
    euroSamples: euroList,
    realizedEuro: cumulativeR(euroList),
    idealEuro: cumulativeR(idealEuroList),
    idealPnlTotal: cumIdealEuro,
    totalFrictionBleed: totalBleed,
    details,
  };
}

test("ideal zero-leak curve removes losses on trades flagged with leaks", () => {
  const mockEntries: SampleJournalEntry[] = [
    {
      tradeDate: "2026-03-01T10:00:00Z",
      title: "EURUSD Buy",
      content: "Profit: 150",
      result: "win",
      tags: "piano, target",
    },
    {
      tradeDate: "2026-03-02T11:00:00Z",
      title: "GBPUSD Sell",
      content: "Profit: -80",
      result: "loss",
      tags: "fomo", // Leaked loss!
    },
    {
      tradeDate: "2026-03-03T14:30:00Z",
      title: "USDJPY Buy",
      content: "Profit: -50",
      result: "loss",
      tags: "piano", // Disciplined loss (retained)
    },
    {
      tradeDate: "2026-03-04T15:00:00Z",
      title: "XAUUSD Buy",
      content: "Profit: -120",
      result: "loss",
      tags: "revenge, anticipazione", // Leaked loss!
    },
  ];

  const res = calculateTrajectoryFriction(mockEntries);

  // Realized trajectory: [0, 150, 70, 20, -100]
  assert.deepEqual(res.realizedEuro, [0, 150, 70, 20, -100]);

  // Ideal trajectory: [0, 150, 150, 100, 100]
  // Trade 1: +150 -> cum 150
  // Trade 2: -80 FOMO stripped -> delta 0 -> cum 150
  // Trade 3: -50 disciplined kept -> delta -50 -> cum 100
  // Trade 4: -120 revenge stripped -> delta 0 -> cum 100
  assert.deepEqual(res.idealEuro, [0, 150, 150, 100, 100]);

  // Total friction bleed: 80 + 120 = 200 €
  assert.equal(res.totalFrictionBleed, 200);
  assert.equal(res.idealPnlTotal, 100);

  // Ideal equity is always >= realized equity
  for (let i = 0; i < res.idealEuro.length; i++) {
    assert.ok(res.idealEuro[i] >= res.realizedEuro[i], `At point ${i}, ideal ${res.idealEuro[i]} must be >= realized ${res.realizedEuro[i]}`);
  }

  // Length matches N + 1
  assert.equal(res.idealEuro.length, mockEntries.length + 1);
  assert.equal(res.realizedEuro.length, mockEntries.length + 1);
  assert.equal(res.details.length, mockEntries.length + 1);
});

test("when no leak tags exist, ideal curve perfectly overlays realized curve", () => {
  const cleanEntries: SampleJournalEntry[] = [
    {
      tradeDate: "2026-03-01T10:00:00Z",
      title: "EURUSD Buy",
      content: "Profit: 200",
      result: "win",
      tags: "piano",
    },
    {
      tradeDate: "2026-03-02T10:00:00Z",
      title: "GBPUSD Buy",
      content: "Profit: -50",
      result: "loss",
      tags: "piano",
    },
  ];

  const res = calculateTrajectoryFriction(cleanEntries);
  assert.deepEqual(res.idealEuro, res.realizedEuro);
  assert.equal(res.totalFrictionBleed, 0);
});
