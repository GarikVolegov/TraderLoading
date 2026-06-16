import assert from "node:assert/strict";
import { computeEdgeReport, type EdgeTrade } from "./tradeAnalytics.js";
import { computeDisciplineReport } from "./tradeDiscipline.js";
import {
  buildRecapBrief,
  filterTradesByPeriod,
  parseRecapDraft,
  RECAP_DRAFT_KEYS,
} from "./journalRecapDraft.js";

function trade(overrides: Partial<EdgeTrade>): EdgeTrade {
  return {
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2026-06-10T09:00:00Z",
    closeTime: "2026-06-10T10:00:00Z",
    entryPrice: 1.1,
    exitPrice: 1.2,
    stopLoss: 1.05,
    profit: 100,
    ...overrides,
  };
}

// ── Period filter keys on the close day, falling back to the open day ────────
{
  const trades = [
    trade({ closeTime: "2026-06-10T10:00:00Z" }), // inside
    trade({ closeTime: "2026-06-08T10:00:00Z" }), // boundary start
    trade({ closeTime: "2026-06-14T23:00:00Z" }), // boundary end
    trade({ closeTime: "2026-06-20T10:00:00Z" }), // outside
    trade({ closeTime: null, openTime: "2026-06-12T09:00:00Z" }), // fallback to open
  ];
  const within = filterTradesByPeriod(trades, "2026-06-08", "2026-06-14");
  assert.equal(within.length, 4, "4 of 5 trades fall in the period");
}

// ── Brief is grounded in the actual numbers ──────────────────────────────────
{
  const trades = [
    trade({}), // +2R, +100
    trade({ exitPrice: 1.075, profit: -50 }), // -0.5R, -50
  ];
  const brief = buildRecapBrief(
    computeEdgeReport(trades),
    computeDisciplineReport(trades),
    { kind: "weekly", periodStart: "2026-06-08", periodEnd: "2026-06-14" },
  );
  assert.match(brief, /PERIODO: weekly 2026-06-08 → 2026-06-14/);
  assert.match(brief, /TRADE CHIUSI: 2/);
  assert.match(brief, /EXPECTANCY: \+0\.75R/);
  assert.match(brief, /WIN RATE: 50%/);
}

// ── Clean JSON parses into all fields ────────────────────────────────────────
{
  const json = JSON.stringify({
    overallJudgment: "Periodo positivo.",
    wentWell: "Sessione Londra.",
    wentWrong: "Revenge trading.",
    improvements: "Rispettare lo stop.",
    patterns: "Breakout.",
    focusAreas: "Disciplina.",
    nextPeriodExpectations: "Stabilità.",
    nextPeriodGoals: "Meno trade.",
  });
  const draft = parseRecapDraft(json);
  assert.equal(draft.overallJudgment, "Periodo positivo.");
  assert.equal(draft.nextPeriodGoals, "Meno trade.");
  assert.ok(RECAP_DRAFT_KEYS.every((key) => draft[key] !== ""));
}

// ── Tolerates code fences and surrounding prose ──────────────────────────────
{
  const wrapped = 'Ecco il recap:\n```json\n{"overallJudgment":"Ok","wentWell":"Stop rispettati"}\n```\nFine.';
  const draft = parseRecapDraft(wrapped);
  assert.equal(draft.overallJudgment, "Ok");
  assert.equal(draft.wentWell, "Stop rispettati");
  assert.equal(draft.improvements, "", "missing keys stay empty");
}

// ── Non-JSON output degrades to raw text in the overall judgment ─────────────
{
  const draft = parseRecapDraft("Il modello ha risposto in prosa senza JSON.");
  assert.equal(draft.overallJudgment, "Il modello ha risposto in prosa senza JSON.");
  assert.equal(draft.wentWell, "");
}

console.log("journalRecapDraft.test.ts: all assertions passed");
