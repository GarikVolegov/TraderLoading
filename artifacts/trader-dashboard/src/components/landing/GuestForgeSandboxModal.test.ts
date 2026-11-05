import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUSTODE_CHECKLIST_ITEMS,
  GUEST_SANDBOX_CANDLES,
  INITIAL_VISIBLE_BAR_INDEX,
  SANDBOX_SCENARIOS,
  SANDBOX_SCENARIO_LEVELS,
  calculateSandboxMetrics,
  getSandboxScenario,
} from "./GuestForgeSandboxModal";

// 1. Verify 16-candle XAU/USD scenario OHLC mathematical integrity
assert.equal(
  GUEST_SANDBOX_CANDLES.length,
  16,
  "Guest sandbox replay must contain 16 institutional candles",
);

for (const candle of GUEST_SANDBOX_CANDLES) {
  const maxBody = Math.max(candle.open, candle.close);
  const minBody = Math.min(candle.open, candle.close);
  assert.ok(
    candle.high >= maxBody,
    `Candle ${candle.index} (${candle.time}) high (${candle.high}) must be >= max(open, close) (${maxBody})`,
  );
  assert.ok(
    candle.low <= minBody,
    `Candle ${candle.index} (${candle.time}) low (${candle.low}) must be <= min(open, close) (${minBody})`,
  );
}

// 2. Verify London SSL Sweep & 1:3 R:R geometry
assert.ok(
  GUEST_SANDBOX_CANDLES[3].low < SANDBOX_SCENARIO_LEVELS.ssl,
  "Candle 3 must sweep below London Session Liquidity (SSL 2,642.50)",
);
assert.equal(
  GUEST_SANDBOX_CANDLES[INITIAL_VISIBLE_BAR_INDEX].close,
  SANDBOX_SCENARIO_LEVELS.entry,
  "Initial visible bar must rest at Entry level 2,645.00",
);
assert.equal(
  (SANDBOX_SCENARIO_LEVELS.takeProfit - SANDBOX_SCENARIO_LEVELS.entry) /
    (SANDBOX_SCENARIO_LEVELS.entry - SANDBOX_SCENARIO_LEVELS.stopLoss),
  3,
  "Scenario levels must enforce an exact 1:3 Risk:Reward ratio",
);

// 3. Verify Custode della Soglia checklist items
assert.equal(
  CUSTODE_CHECKLIST_ITEMS.length,
  3,
  "Custode della Soglia must require 3 checklist rules",
);

// 4. Verify calculateSandboxMetrics calculation across replay states
const preTradeMetrics = calculateSandboxMetrics(INITIAL_VISIBLE_BAR_INDEX, false);
assert.equal(preTradeMetrics.pnlR, 0);
assert.equal(preTradeMetrics.pnlEur, 0);
assert.equal(preTradeMetrics.hitTakeProfit, false);

const midTradeMetrics = calculateSandboxMetrics(10, true);
assert.ok(midTradeMetrics.pnlR > 1.5 && midTradeMetrics.pnlR < 3.0);
assert.equal(midTradeMetrics.hitTakeProfit, false);

const tpMetrics = calculateSandboxMetrics(14, true);
assert.equal(tpMetrics.hitTakeProfit, true);
assert.equal(tpMetrics.pnlR, 3.0);
assert.equal(tpMetrics.pnlEur, 300.0);

// 4b. Verify Multi-Scenario support (XAU/USD, EUR/USD, BTC/USD)
assert.equal(SANDBOX_SCENARIOS.length, 3, "Must expose 3 institutional scenarios");
for (const scenario of SANDBOX_SCENARIOS) {
  assert.equal(scenario.candles.length, 16, `Scenario ${scenario.id} must have 16 candles`);
  assert.equal(scenario.checklist.length, 3, `Scenario ${scenario.id} must have 3 Custode rules`);
  assert.ok(
    scenario.candles[3].low < scenario.ssl,
    `Scenario ${scenario.id} candle 3 must sweep SSL (${scenario.ssl})`,
  );
  const scenarioTp = calculateSandboxMetrics(14, true, scenario.id);
  assert.equal(scenarioTp.hitTakeProfit, true, `Scenario ${scenario.id} must reach TP at bar 14`);
  assert.equal(scenarioTp.pnlR, 3.0);
  assert.equal(scenarioTp.pnlEur, 300.0);
}
assert.equal(getSandboxScenario("eur-ny-reversal").symbol, "EUR/USD");
assert.equal(getSandboxScenario("btc-macro-breakout").symbol, "BTC/USD");

// 5. Verify Limen Design System static compliance & LandingPage wiring
const modalSource = readFileSync(
  new URL("./GuestForgeSandboxModal.tsx", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("../../pages/LandingPage.tsx", import.meta.url),
  "utf8",
);

assert.match(modalSource, /LimenResponsiveDrawer/);
assert.match(modalSource, /synestheticClick/);
assert.match(modalSource, /whitespace-nowrap/);
assert.match(modalSource, /font-mono/);
assert.match(modalSource, /tracking-tight/);
assert.match(
  modalSource,
  /Completata Prova Immediata della Forgia \(\+3\.00R al 100% Integrità\)/,
);

assert.match(landingSource, /GuestForgeSandboxModal/);
assert.match(landingSource, /landing-open-guest-sandbox-btn/);
assert.match(
  landingSource,
  /PROVA LA FORGIA DAL VIVO \(60 SEC · ZERO LOGIN\)/,
);
assert.match(landingSource, /landing_guest_sandbox_open/);

console.log("GuestForgeSandboxModal unit & static checks passed");
