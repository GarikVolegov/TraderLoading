import assert from "node:assert/strict";
import { computeMoodPerformance, firstMoodByDate } from "./moodPerformance.js";

const checkins = [
  { id: 1, mood: "🧘", date: "2026-06-01" },
  { id: 2, mood: "😤", date: "2026-06-01" }, // secondo check-in stesso giorno: ignorato
  { id: 3, mood: "😤", date: "2026-06-02" },
  { id: 4, mood: "🧘", date: "2026-06-03" },
  { id: 5, mood: "😐", date: "2026-06-04" }, // giorno senza trade
];

const entries = [
  { tradeDate: "2026-06-01", result: "win" },
  { tradeDate: "2026-06-01", result: "win" },
  { tradeDate: "2026-06-01", result: "loss" },
  { tradeDate: "2026-06-02", result: "loss" },
  { tradeDate: "2026-06-02", result: "loss" },
  { tradeDate: "2026-06-03", result: "win" },
  { tradeDate: "2026-06-03", result: "breakeven" },
  { tradeDate: "2026-06-07", result: "win" }, // giorno senza check-in: ignorato
];

// Primo umore del giorno
const moods = firstMoodByDate(checkins);
assert.equal(moods.get("2026-06-01"), "🧘");
assert.equal(moods.get("2026-06-02"), "😤");

const stats = computeMoodPerformance(checkins, entries);

const zen = stats.find((s) => s.mood === "🧘");
assert.ok(zen);
assert.equal(zen.days, 2);
assert.equal(zen.trades, 5); // 3 il giorno 1 + 2 il giorno 3
assert.equal(zen.wins, 3);
assert.equal(zen.losses, 1);
assert.equal(zen.winRate, 75); // 3/(3+1), breakeven escluso
assert.equal(zen.lowSample, true); // 4 decisi < 5

const agitato = stats.find((s) => s.mood === "😤");
assert.ok(agitato);
assert.equal(agitato.days, 1);
assert.equal(agitato.trades, 2);
assert.equal(agitato.winRate, 0);
assert.equal(agitato.lowSample, true);

const neutro = stats.find((s) => s.mood === "😐");
assert.ok(neutro);
assert.equal(neutro.trades, 0);
assert.equal(neutro.winRate, null);

// Ordinati per numero di trade
assert.equal(stats[0].mood, "🧘");

// Edge: vuoti
assert.deepEqual(computeMoodPerformance([], entries), []);
assert.deepEqual(computeMoodPerformance(undefined, undefined), []);

console.log("mood performance checks passed");
