import assert from "node:assert/strict";
import { qualifyPrizes } from "./prizes.js";
import type { ComputedStanding } from "./standings.js";

function s(userId: string, rank: number, discIndex: number, dq = false): ComputedStanding {
  return {
    userId,
    displayName: userId,
    avatarUrl: null,
    rCum: 20,
    discIndex,
    score: 20,
    division: "argento",
    rank,
    trades: 30,
    dq,
    dqReason: dq ? "x" : null,
  };
}

// ── il campione ottiene il tier champ (12 mesi Pro + cert champion) ──────────
{
  const awards = qualifyPrizes([s("a", 1, 90)]);
  const champ = awards.find((x) => x.userId === "a" && x.tier === "champ");
  assert.ok(champ);
  assert.equal(champ.proMonths, 12);
  assert.equal(champ.certTier, "champion");
}

// ── il 1° si qualifica anche a top10 e disc (cumulativo) ─────────────────────
{
  const tiers = qualifyPrizes([s("a", 1, 90)])
    .filter((x) => x.userId === "a")
    .map((x) => x.tier)
    .sort();
  assert.deepEqual(tiers, ["champ", "disc", "finish", "top10"].sort());
}

// ── finish richiede Disciplina >= 60 e non squalificato ──────────────────────
{
  assert.equal(qualifyPrizes([s("a", 50, 59)]).some((x) => x.tier === "finish"), false);
  assert.equal(qualifyPrizes([s("a", 50, 60)]).some((x) => x.tier === "finish"), true);
}

// ── gli squalificati non ricevono nulla ──────────────────────────────────────
{
  assert.equal(qualifyPrizes([s("a", 0, 95, true)]).length, 0);
}

// ── il tier disc è limitato a 50 ─────────────────────────────────────────────
{
  const many = Array.from({ length: 60 }, (_, i) => s(`u${i}`, i + 1, 95));
  const discWinners = qualifyPrizes(many).filter((x) => x.tier === "disc");
  assert.equal(discWinners.length, 50);
}

console.log("prizes.test.ts: all assertions passed");
