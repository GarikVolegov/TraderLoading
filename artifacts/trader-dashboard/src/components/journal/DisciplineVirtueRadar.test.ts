import test from "node:test";
import assert from "node:assert/strict";
import { computeDisciplineAnalysis } from "./DisciplineVirtueRadar";
import type { JournalEntry } from "@workspace/api-client-react";

test("DisciplineVirtueRadar: computeDisciplineAnalysis handles empty entries gracefully", () => {
  const analysis = computeDisciplineAnalysis([]);

  assert.equal(analysis.totalTradesAnalyzed, 0);
  assert.equal(analysis.taggedTradesCount, 0);
  assert.equal(analysis.integrityScore, 100);
  assert.equal(analysis.virtueYield, 0);
  assert.equal(analysis.leakBleed, 0);
  assert.equal(analysis.dominantVirtue, null);
  assert.equal(analysis.criticalLeak, null);
  assert.equal(analysis.allMetrics.length, 9); // 4 virtues + 5 leaks
});

test("DisciplineVirtueRadar: computeDisciplineAnalysis calculates virtues and yields accurately", () => {
  const entries: JournalEntry[] = [
    {
      id: 1,
      userId: "user_1",
      title: "EUR/USD Long",
      tradeDate: "2026-10-20T10:00:00Z",
      result: "win",
      tags: "piano, pazienza",
      content: "Symbol: EURUSD\nProfit: 250.00\nRischio Prezzo: 100\n",
      createdAt: "2026-10-20T10:00:00Z",
      updatedAt: "2026-10-20T10:00:00Z",
    },
    {
      id: 2,
      userId: "user_1",
      title: "XAU/USD Long",
      tradeDate: "2026-10-21T14:30:00Z",
      result: "win",
      tags: "piano, target",
      content: "Symbol: XAUUSD\nProfit: 450.00\n",
      createdAt: "2026-10-21T14:30:00Z",
      updatedAt: "2026-10-21T14:30:00Z",
    },
  ];

  const analysis = computeDisciplineAnalysis(entries);

  assert.equal(analysis.totalTradesAnalyzed, 2);
  assert.equal(analysis.taggedTradesCount, 2);
  assert.equal(analysis.integrityScore, 100);
  assert.equal(analysis.virtueYield, 700.0);
  assert.equal(analysis.leakBleed, 0);

  const piano = analysis.virtueMetrics.find((v) => v.id === "piano");
  assert.ok(piano);
  assert.equal(piano.count, 2);
  assert.equal(piano.totalPnl, 700.0);
  assert.equal(piano.winRate, 100);

  const target = analysis.virtueMetrics.find((v) => v.id === "target");
  assert.ok(target);
  assert.equal(target.count, 1);
  assert.equal(target.totalPnl, 450.0);

  assert.equal(analysis.dominantVirtue?.id, "piano");
  assert.equal(analysis.criticalLeak, null);
});

test("DisciplineVirtueRadar: computeDisciplineAnalysis detects leaks and computes bleed accurately", () => {
  const entries: JournalEntry[] = [
    {
      id: 10,
      userId: "user_1",
      title: "NAS100 Short FOMO",
      tradeDate: "2026-10-22T15:30:00Z",
      result: "loss",
      tags: "fomo, anticipazione",
      content: "Symbol: NAS100\nProfit: -200.00\n",
      createdAt: "2026-10-22T15:30:00Z",
      updatedAt: "2026-10-22T15:30:00Z",
    },
    {
      id: 11,
      userId: "user_1",
      title: "NAS100 Revenge Trade",
      tradeDate: "2026-10-22T15:45:00Z",
      result: "loss",
      tags: "revenge, fomo",
      content: "Symbol: NAS100\nProfit: -350.00\n",
      createdAt: "2026-10-22T15:45:00Z",
      updatedAt: "2026-10-22T15:45:00Z",
    },
    {
      id: 12,
      userId: "user_1",
      title: "EUR/USD Conforme",
      tradeDate: "2026-10-23T09:00:00Z",
      result: "win",
      tags: "piano",
      content: "Symbol: EURUSD\nProfit: 300.00\n",
      createdAt: "2026-10-23T09:00:00Z",
      updatedAt: "2026-10-23T09:00:00Z",
    },
  ];

  const analysis = computeDisciplineAnalysis(entries);

  assert.equal(analysis.totalTradesAnalyzed, 3);
  assert.equal(analysis.virtueYield, 300.0);
  assert.equal(analysis.leakBleed, 550.0);

  // Total virtues: 1 (piano). Total leaks: 2 fomo + 1 anticipazione + 1 revenge = 4 leaks.
  // totalPoints = 1 + 4 = 5.
  // integrityScore = (1 / 5) * 100 = 20%
  assert.equal(analysis.integrityScore, 20);

  const fomo = analysis.leakMetrics.find((l) => l.id === "fomo");
  assert.ok(fomo);
  assert.equal(fomo.count, 2);
  assert.equal(fomo.totalPnl, -550.0);

  // Critical leak should be fomo (worst P&L bleed)
  assert.equal(analysis.criticalLeak?.id, "fomo");
  assert.equal(analysis.dominantVirtue?.id, "piano");
});

test("DisciplineVirtueRadar: computeDisciplineAnalysis accurately aggregates Calma & Respiro via Respiro-478 tag", () => {
  const entries: JournalEntry[] = [
    {
      id: 20,
      userId: "user_1",
      title: "Gold Short Calm",
      tradeDate: "2026-10-24T10:00:00Z",
      result: "win",
      tags: "XAUUSD, SELL, Respiro-478, AUREUS-Cockpit",
      content: "Symbol: XAUUSD\nProfit: 400.00\nRespiro Tattico 4-7-8 Completato\n",
      createdAt: "2026-10-24T10:00:00Z",
      updatedAt: "2026-10-24T10:00:00Z",
    },
    {
      id: 21,
      userId: "user_1",
      title: "EURUSD Loss Handled with Calm",
      tradeDate: "2026-10-24T14:00:00Z",
      result: "loss",
      tags: "EURUSD, BUY, calma",
      content: "Symbol: EURUSD\nProfit: -100.00\n",
      createdAt: "2026-10-24T14:00:00Z",
      updatedAt: "2026-10-24T14:00:00Z",
    },
  ];

  const analysis = computeDisciplineAnalysis(entries);
  assert.equal(analysis.totalTradesAnalyzed, 2);
  assert.equal(analysis.taggedTradesCount, 2);

  const calma = analysis.virtueMetrics.find((v) => v.id === "calma");
  assert.ok(calma, "Virtue 'calma' must be present in virtueMetrics");
  assert.equal(calma.count, 2, "Both trades should be normalized to calma virtue");
  assert.equal(calma.totalPnl, 300.0);
  assert.equal(calma.winRate, 50);
});
