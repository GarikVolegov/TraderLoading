import assert from "node:assert/strict";
import { mapAccountTradeToTorneiTrade, disciplineIndexFor, nextDivisionFor } from "./tradeMapping.js";
import type { TorneiTrade } from "./standings.js";

// ── mapper: account trade chiuso → trade del torneo con R e riskPct ──────────
{
  const t = mapAccountTradeToTorneiTrade({
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2025-08-01T09:00:00Z",
    closeTime: "2025-08-01T11:00:00Z",
    entryPrice: "1.10000",
    exitPrice: "1.10500",
    stopLoss: "1.09800",
    profit: "50",
    returnPct: "2", // +2% del conto
    journalEntryId: 7,
  });
  // R = |1.105-1.10|/|1.10-1.098| * sign(+) = 0.005/0.002 = 2.5
  assert.equal(t.rMultiple, 2.5);
  // riskPct = |2| / |2.5| = 0.8
  assert.ok(t.riskPct !== null && Math.abs(t.riskPct - 0.8) < 1e-9);
  assert.equal(t.journaled, true);
}

// ── mapper: trade senza journalEntry non è journaled; riskPct null se manca % ─
{
  const t = mapAccountTradeToTorneiTrade({
    symbol: "EURUSD",
    direction: "sell",
    openTime: "2025-08-01T09:00:00Z",
    closeTime: "2025-08-01T11:00:00Z",
    entryPrice: "1.10000",
    exitPrice: "1.09500",
    stopLoss: "1.10200",
    profit: "50",
    returnPct: null,
    journalEntryId: null,
  });
  assert.equal(t.journaled, false);
  assert.equal(t.riskPct, null);
}

// ── indice disciplina: nessun trade → 100; metà sforano lo stop → 50 ─────────
{
  assert.equal(disciplineIndexFor([]), 100);
  const trades: TorneiTrade[] = [
    { rMultiple: 2, riskPct: 1, journaled: true },
    { rMultiple: -2, riskPct: 1, journaled: true }, // stop sforato (< -1R)
  ];
  assert.equal(disciplineIndexFor(trades), 50);
}

// ── indice disciplina: rischio oltre il massimo penalizza ────────────────────
{
  const trades: TorneiTrade[] = [
    { rMultiple: 1, riskPct: 5, journaled: true }, // rischio > 2%
    { rMultiple: 1, riskPct: 1, journaled: true },
    { rMultiple: 1, riskPct: 1, journaled: true },
    { rMultiple: 1, riskPct: 1, journaled: true },
  ];
  assert.equal(disciplineIndexFor(trades), 75);
}

// ── nextDivisionFor ──────────────────────────────────────────────────────────
{
  assert.equal(nextDivisionFor(0), "argento");
  assert.equal(nextDivisionFor(31), "diamante");
  assert.equal(nextDivisionFor(50), null); // già diamante
}

console.log("store.test.ts: all assertions passed");
