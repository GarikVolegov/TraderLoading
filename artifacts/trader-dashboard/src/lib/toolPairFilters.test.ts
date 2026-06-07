import assert from "node:assert/strict";
import {
  deriveEffectiveFilterItems,
  uniqueItems,
} from "./toolPairFilters.js";

assert.deepEqual(uniqueItems(["EURUSD", "EURUSD", "XAUUSD"]), ["EURUSD", "XAUUSD"]);
assert.deepEqual(uniqueItems(["", "  ", "USD"]), ["USD"]);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["EURUSD", "XAUUSD", "BTCUSD"],
    supportedItems: ["EURUSD", "GBPUSD", "XAUUSD"],
    defaultItems: ["EURUSD", "GBPUSD"],
  }),
  {
    items: ["EURUSD", "XAUUSD"],
    requestedItems: ["EURUSD", "XAUUSD", "BTCUSD"],
    unsupportedItems: ["BTCUSD"],
    supportedCount: 2,
    requestedCount: 3,
    hasUserSelection: true,
    isFallback: false,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: [],
    supportedItems: ["EURUSD", "GBPUSD"],
    defaultItems: ["EURUSD"],
  }),
  {
    items: ["EURUSD"],
    requestedItems: [],
    unsupportedItems: [],
    supportedCount: 0,
    requestedCount: 0,
    hasUserSelection: false,
    isFallback: true,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["BTCUSD"],
    supportedItems: ["EURUSD", "GBPUSD"],
    defaultItems: ["EURUSD"],
  }),
  {
    items: ["EURUSD"],
    requestedItems: ["BTCUSD"],
    unsupportedItems: ["BTCUSD"],
    supportedCount: 0,
    requestedCount: 1,
    hasUserSelection: true,
    isFallback: true,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["USD", "EUR", "USD"],
    supportedItems: ["EUR", "USD", "JPY"],
    defaultItems: ["USD"],
  }).items,
  ["USD", "EUR"],
);

console.log("tool pair filter checks passed");
