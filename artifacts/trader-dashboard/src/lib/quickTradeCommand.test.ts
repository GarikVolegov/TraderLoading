import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickTradeCommand } from "./quickTradeCommand.js";

test("parseQuickTradeCommand: ignores non-trade inputs", () => {
  assert.equal(parseQuickTradeCommand("settings"), null);
  assert.equal(parseQuickTradeCommand("forgia"), null);
  assert.equal(parseQuickTradeCommand("diario"), null);
});

test("parseQuickTradeCommand: parses win with profit, symbol, and virtue tags", () => {
  const res = parseQuickTradeCommand("trade win +150 EURUSD piano target");
  assert.ok(res !== null);
  assert.equal(res.isValid, true);
  assert.equal(res.result, "win");
  assert.equal(res.profit, 150);
  assert.equal(res.symbol, "EURUSD");
  assert.deepEqual(res.tags, ["piano", "target"]);
  assert.ok(res.title.includes("EURUSD"));
  assert.ok(res.title.includes("+€150.00"));
});

test("parseQuickTradeCommand: parses loss with negative pnl and leak tags", () => {
  const res = parseQuickTradeCommand("trade loss -80 GBPUSD fomo");
  assert.ok(res !== null);
  assert.equal(res.isValid, true);
  assert.equal(res.result, "loss");
  assert.equal(res.profit, -80);
  assert.equal(res.symbol, "GBPUSD");
  assert.deepEqual(res.tags, ["fomo"]);
  assert.ok(res.title.includes("-€80.00"));
});

test("parseQuickTradeCommand: parses breakeven", () => {
  const res = parseQuickTradeCommand("trade be 0 USDJPY");
  assert.ok(res !== null);
  assert.equal(res.isValid, true);
  assert.equal(res.result, "breakeven");
  assert.equal(res.profit, 0);
  assert.equal(res.symbol, "USDJPY");
});

test("parseQuickTradeCommand: enforces mandatory stop loss on price-based setups", () => {
  const invalidSetup = parseQuickTradeCommand("trade buy EURUSD 1.0850 tp 1.0910");
  assert.ok(invalidSetup !== null);
  assert.equal(invalidSetup.isValid, false);
  assert.ok(invalidSetup.error?.includes("Stop Loss"));

  const validSetup = parseQuickTradeCommand("trade buy EURUSD 1.0850 sl 1.0820 tp 1.0910");
  assert.ok(validSetup !== null);
  assert.equal(validSetup.isValid, true);
  assert.equal(validSetup.direction, "buy");
  assert.equal(validSetup.entryPrice, 1.0850);
  assert.equal(validSetup.stopLoss, 1.0820);
  assert.equal(validSetup.takeProfit, 1.0910);
  assert.equal(validSetup.rMultiple, 2.0); // (1.0910 - 1.0850) / (1.0850 - 1.0820) = 0.0060 / 0.0030 = 2.0 R
});
