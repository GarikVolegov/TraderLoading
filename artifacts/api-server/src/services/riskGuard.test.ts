import assert from "node:assert/strict";
import {
  evaluateRiskGuard,
  DEFAULT_RISK_GUARD_CONFIG,
  sanitizeRiskGuardOverrides,
  riskGuardSettingsView,
} from "./riskGuard.js";
import { type EdgeTrade } from "./tradeAnalytics.js";

const NOW = new Date("2026-06-16T18:00:00Z"); // Rome day 2026-06-16

function trade(overrides: Partial<EdgeTrade>): EdgeTrade {
  return {
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2026-06-16T09:00:00Z",
    closeTime: "2026-06-16T10:00:00Z",
    entryPrice: 1.1,
    exitPrice: 1.2,
    stopLoss: 1.05,
    profit: 100,
    ...overrides,
  };
}

function alertOf(report: ReturnType<typeof evaluateRiskGuard>, type: string) {
  return report.alerts.find((a) => a.type === type);
}

// ── Calm day → no breakers ───────────────────────────────────────────────────
{
  const report = evaluateRiskGuard([
    trade({}),
    trade({ openTime: "2026-06-16T11:00:00Z", closeTime: "2026-06-16T12:00:00Z" }),
  ], NOW);
  assert.equal(report.alerts.length, 0);
  assert.equal(report.todayTrades, 2);
  assert.equal(report.tradingDay, "2026-06-16");
}

// ── Loss streak (without hitting the daily-R limit) ──────────────────────────
{
  const losers = [10, 11, 12].map((h) =>
    trade({ closeTime: `2026-06-16T${h}:00:00Z`, exitPrice: 1.075, profit: -30 }), // -0.5R each → -1.5R
  );
  const report = evaluateRiskGuard(losers, NOW);
  const streak = alertOf(report, "loss_streak");
  assert.ok(streak, "loss streak breaker active");
  assert.equal(streak.value, 3);
  assert.equal(streak.severity, "danger");
  assert.equal(alertOf(report, "daily_loss"), undefined, "-1.5R is above the -3R limit");
}

// ── Daily R loss limit ───────────────────────────────────────────────────────
{
  const report = evaluateRiskGuard([
    trade({ closeTime: "2026-06-16T10:00:00Z", exitPrice: 1.0, profit: -100 }), // -2R
    trade({ closeTime: "2026-06-16T11:00:00Z", exitPrice: 1.0, profit: -100 }), // -2R → -4R total
  ], NOW);
  const daily = alertOf(report, "daily_loss");
  assert.ok(daily, "daily loss breaker active");
  assert.equal(daily.value, -4);
  assert.equal(report.todayNetR, -4);
}

// ── Overtrading ──────────────────────────────────────────────────────────────
{
  const trades = Array.from({ length: 6 }, (_, i) =>
    trade({ closeTime: `2026-06-16T1${i}:00:00Z` }),
  );
  const report = evaluateRiskGuard(trades, NOW);
  const over = alertOf(report, "overtrading");
  assert.ok(over, "overtrading breaker active");
  assert.equal(over.value, 6);
  assert.equal(over.severity, "warning");
}

// ── Revenge: a trade today opened within 2h of a loss close ─────────────────
{
  const report = evaluateRiskGuard([
    trade({ openTime: "2026-06-16T09:00:00Z", closeTime: "2026-06-16T10:00:00Z", exitPrice: 1.05, profit: -50 }),
    trade({ openTime: "2026-06-16T10:30:00Z", closeTime: "2026-06-16T11:30:00Z", profit: 100 }),
  ], NOW);
  const revenge = alertOf(report, "revenge");
  assert.ok(revenge, "revenge breaker active");
  assert.equal(revenge.value, 1);
}

// ── Recency guard: a stale streak does not alarm today ───────────────────────
{
  const stale = [11, 12, 13].map((h) =>
    trade({ openTime: `2026-06-11T0${9}:00:00Z`, closeTime: `2026-06-11T${h}:00:00Z`, exitPrice: 1.0, profit: -100 }),
  );
  const report = evaluateRiskGuard(stale, NOW);
  assert.equal(report.alerts.length, 0, "5-day-old streak is not an active breaker");
  assert.equal(report.todayTrades, 0);
  assert.equal(report.todayNetR, null);
}

// ── Cash daily-loss limit: catches no-stop blow-ups the R limit misses ───────
{
  const cfg = { ...DEFAULT_RISK_GUARD_CONFIG, maxDailyLossCash: 300 };

  // No stops → R uncomputable, but the cash breaker still fires on raw P&L.
  const danger = evaluateRiskGuard([
    trade({ stopLoss: null, profit: -200, closeTime: "2026-06-16T10:00:00Z" }),
    trade({ stopLoss: null, profit: -200, closeTime: "2026-06-16T11:00:00Z" }),
  ], NOW, cfg);
  const cash = alertOf(danger, "daily_loss_cash");
  assert.ok(cash, "cash breaker fires without stops");
  assert.equal(cash.severity, "danger");
  assert.equal(cash.value, -400);
  assert.equal(cash.threshold, 300);
  assert.equal(alertOf(danger, "daily_loss"), undefined, "R breaker can't fire without stops");

  // 80% of the limit → warning.
  const warn = evaluateRiskGuard([
    trade({ stopLoss: null, profit: -250, closeTime: "2026-06-16T10:00:00Z" }),
  ], NOW, cfg);
  assert.equal(alertOf(warn, "daily_loss_cash")?.severity, "warning");

  // Disabled by default (no limit set).
  const off = evaluateRiskGuard([trade({ profit: -1000, closeTime: "2026-06-16T10:00:00Z" })], NOW);
  assert.equal(alertOf(off, "daily_loss_cash"), undefined);
}

// ── User threshold overrides: validate, clamp, omit blanks ───────────────────
{
  assert.deepEqual(
    sanitizeRiskGuardOverrides({ maxConsecutiveLosses: 4, maxDailyTrades: 8, maxDailyLossR: 2.5 }),
    { maxConsecutiveLosses: 4, maxDailyTrades: 8, maxDailyLossR: 2.5 },
  );
  // out-of-range clamps; integer fields round; numeric strings coerce
  assert.deepEqual(
    sanitizeRiskGuardOverrides({ maxConsecutiveLosses: 999, maxDailyTrades: 0, maxDailyLossR: "3.7" }),
    { maxConsecutiveLosses: 20, maxDailyTrades: 1, maxDailyLossR: 3.7 },
  );
  // blanks / invalid omitted → default kept
  assert.deepEqual(sanitizeRiskGuardOverrides({ maxConsecutiveLosses: null, maxDailyTrades: "", maxDailyLossR: "x" }), {});
  assert.deepEqual(sanitizeRiskGuardOverrides(null), {});
  assert.deepEqual(sanitizeRiskGuardOverrides("nope"), {});

  // read-back view fills the unset thresholds with null
  assert.deepEqual(
    riskGuardSettingsView({ maxConsecutiveLosses: 4 }),
    { maxConsecutiveLosses: 4, maxDailyTrades: null, maxDailyLossR: null },
  );

  // an override actually shifts the breaker: 2 losses fire under a limit of 2, not the default 3
  const losers = [10, 11].map((h) => trade({ closeTime: `2026-06-16T${h}:00:00Z`, exitPrice: 1.075, profit: -30 }));
  const cfg = { ...DEFAULT_RISK_GUARD_CONFIG, ...sanitizeRiskGuardOverrides({ maxConsecutiveLosses: 2 }) };
  assert.ok(alertOf(evaluateRiskGuard(losers, NOW, cfg), "loss_streak"), "override lowers the streak limit");
  assert.equal(alertOf(evaluateRiskGuard(losers, NOW), "loss_streak"), undefined, "default limit not hit");
}

// ── Empty input ──────────────────────────────────────────────────────────────
{
  const report = evaluateRiskGuard([], NOW);
  assert.deepEqual(report.alerts, []);
  assert.equal(report.todayTrades, 0);
  assert.equal(report.todayNetR, null);
  assert.equal(report.tradingDay, "2026-06-16");
}

console.log("riskGuard.test.ts: all assertions passed");
