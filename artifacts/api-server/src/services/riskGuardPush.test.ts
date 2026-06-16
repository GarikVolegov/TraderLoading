import assert from "node:assert/strict";
import type { RiskGuardAlert, RiskGuardReport } from "./riskGuard.js";

// riskGuardPush imports the push helper, which transitively loads the db client.
process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { buildBreachNotifications } = await import("./riskGuardPush.js");

function report(alerts: RiskGuardAlert[]): RiskGuardReport {
  return { evaluatedAt: "2026-06-16T18:00:00.000Z", tradingDay: "2026-06-16", todayTrades: 0, todayNetR: null, alerts };
}

// ── Danger breaches become push payloads with per-type tags + localized copy ─
{
  const out = buildBreachNotifications(report([
    { type: "loss_streak", severity: "danger", value: 3, threshold: 3 },
    { type: "daily_loss_cash", severity: "danger", value: -400, threshold: 300 },
  ]), "it");
  assert.equal(out.length, 2);
  assert.equal(out[0].type, "loss_streak");
  assert.equal(out[0].tag, "risk-guard:loss_streak");
  assert.match(out[0].body, /3 perdite di fila/);
  assert.equal(out[0].title, "Risk guard — fermati");
  assert.match(out[1].body, /-400.*300/);
}

// ── Warnings (incl. overtrading) never push ──────────────────────────────────
{
  const out = buildBreachNotifications(report([
    { type: "overtrading", severity: "warning", value: 6, threshold: 6 },
    { type: "daily_loss_cash", severity: "warning", value: -250, threshold: 300 },
  ]), "en");
  assert.deepEqual(out, []);
}

// ── English copy ─────────────────────────────────────────────────────────────
{
  const out = buildBreachNotifications(report([
    { type: "loss_streak", severity: "danger", value: 4, threshold: 3 },
  ]), "en");
  assert.match(out[0].body, /4 losses in a row/);
  assert.equal(out[0].title, "Risk guard — stop");
}

// ── Unknown language falls back to Italian ───────────────────────────────────
{
  const out = buildBreachNotifications(report([
    { type: "revenge", severity: "danger", value: 2, threshold: 0 },
  ]), "xx");
  assert.equal(out.length, 1);
  assert.match(out[0].body, /revenge/);
}

console.log("riskGuardPush.test.ts: all assertions passed");
