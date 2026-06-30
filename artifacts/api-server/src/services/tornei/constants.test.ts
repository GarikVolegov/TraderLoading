import assert from "node:assert/strict";
import { divisionForScore, DIVISIONS, PRIZE_TIERS } from "./constants.js";

// ── divisionForScore mappa le fasce dal design ───────────────────────────────
{
  assert.equal(divisionForScore(0), "bronzo");
  assert.equal(divisionForScore(17.9), "bronzo");
  assert.equal(divisionForScore(18), "argento");
  assert.equal(divisionForScore(30), "oro");
  assert.equal(divisionForScore(45), "diamante");
  assert.equal(divisionForScore(120), "diamante");
}

// ── DIVISIONS ordinate per min crescente, quattro leghe ──────────────────────
{
  assert.deepEqual(DIVISIONS.map((d) => d.id), ["bronzo", "argento", "oro", "diamante"]);
}

// ── PRIZE_TIERS coprono i cinque tier del design ─────────────────────────────
{
  assert.deepEqual(PRIZE_TIERS.map((p) => p.tier), ["champ", "podium", "top10", "disc", "finish"]);
  const disc = PRIZE_TIERS.find((p) => p.tier === "disc");
  assert.equal(disc?.cap, 50);
  assert.equal(PRIZE_TIERS.find((p) => p.tier === "champ")?.proMonths, 12);
}

console.log("constants.test.ts: all assertions passed");
