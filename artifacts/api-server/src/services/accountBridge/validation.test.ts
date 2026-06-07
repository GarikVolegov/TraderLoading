import assert from "node:assert/strict";
import { parseBridgeConfig, validateOrderRequest } from "./validation.js";

assert.deepEqual(parseBridgeConfig({}), {
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: true,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
});
assert.deepEqual(parseBridgeConfig({ ACCOUNT_BRIDGE_MODE: "live" }), {
  adapter: "mt5-local-socket",
  mode: "live",
  host: "127.0.0.1",
  port: 8765,
  importJournal: true,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
});
assert.equal(parseBridgeConfig({ ACCOUNT_BRIDGE_PORT: "12.5" }).port, 8765);
assert.equal(parseBridgeConfig({ ACCOUNT_BRIDGE_PORT: "99999" }).port, 8765);
assert.equal(parseBridgeConfig({ ACCOUNT_BRIDGE_ORDER_ACK_TIMEOUT_MS: "2500" }).orderAckTimeoutMs, 2500);

const demoOrder = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: 0.1, stopLoss: 1.08, takeProfit: 1.1 },
  { mode: "demo", orderEnabled: false },
);
assert.equal(demoOrder.ok, true);

const liveDisabled = validateOrderRequest(
  { symbol: "EURUSD", direction: "sell", volume: 0.1 },
  { mode: "live", orderEnabled: false },
);
assert.deepEqual(liveDisabled, { ok: false, reason: "Live order sending is disabled" });

const badVolume = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: 0 },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(badVolume, { ok: false, reason: "Volume must be greater than zero" });

const booleanVolume = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: true },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(booleanVolume, { ok: false, reason: "Volume must be greater than zero" });

const arrayStopLoss = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: 0.1, stopLoss: [1.08] },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(arrayStopLoss, { ok: false, reason: "Stop loss must be a positive price" });

const symbolWithNewline = validateOrderRequest(
  { symbol: "EUR\nUSD", direction: "buy", volume: 0.1 },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(symbolWithNewline, { ok: false, reason: "Symbol contains unsupported characters" });

const longSymbol = validateOrderRequest(
  { symbol: "EURUSD".repeat(6), direction: "buy", volume: 0.1 },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(longSymbol, { ok: false, reason: "Symbol must be 32 characters or fewer" });

console.log("account bridge validation checks passed");
