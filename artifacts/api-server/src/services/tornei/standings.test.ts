import assert from "node:assert/strict";
import { computeStandings, type StandingInput } from "./standings.js";

function mk(
  userId: string,
  rs: number[],
  discIndex: number,
  opts: { riskPct?: number; journaled?: boolean } = {},
): StandingInput {
  return {
    userId,
    displayName: userId,
    avatarUrl: null,
    discIndex,
    trades: rs.map((r) => ({
      rMultiple: r,
      riskPct: opts.riskPct ?? 1,
      journaled: opts.journaled ?? true,
    })),
  };
}

// ── classifica per R cumulato + divisioni ────────────────────────────────────
{
  const out = computeStandings([mk("a", [10, 12, 10], 90), mk("b", [5, 5], 80)], "r");
  assert.equal(out[0].userId, "a");
  assert.equal(out[0].rCum, 32);
  assert.equal(out[0].rank, 1);
  assert.equal(out[0].division, "oro"); // 32 >= 30
  assert.equal(out[1].rank, 2);
}

// ── trade oltre il rischio massimo non contano ───────────────────────────────
{
  const out = computeStandings([mk("a", [10], 90, { riskPct: 5 })], "r");
  assert.equal(out[0].rCum, 0);
  assert.equal(out[0].trades, 0);
}

// ── trade non registrati a diario non contano ────────────────────────────────
{
  const out = computeStandings([mk("a", [10], 90, { journaled: false })], "r");
  assert.equal(out[0].rCum, 0);
}

// ── drawdown oltre -10R squalifica ed esce dalla classifica ──────────────────
{
  const out = computeStandings([mk("a", [-4, -4, -4], 90), mk("b", [3], 80)], "r");
  const a = out.find((r) => r.userId === "a");
  assert.ok(a);
  assert.equal(a.dq, true);
  assert.equal(a.dqReason, "Drawdown −10R superato");
  assert.equal(a.rank, 0);
  assert.equal(out.find((r) => r.userId === "b")?.rank, 1);
}

// ── metrica Disciplina = R × Disciplina/100 ──────────────────────────────────
{
  const out = computeStandings([mk("a", [10], 50, {}), mk("b", [8], 100, {})], "ts");
  assert.equal(out[0].userId, "b"); // 8 > 5
}

console.log("standings.test.ts: all assertions passed");
