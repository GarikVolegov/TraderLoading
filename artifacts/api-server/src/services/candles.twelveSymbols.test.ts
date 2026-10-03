import assert from "node:assert/strict";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import { twelveDataSymbol } from "./candles.js";

// Finding 2.4: half the catalog had no live source, so pairs like CAD/JPY, EUR/AUD
// showed a mute "—" forever in the "Live" watchlist. TwelveData serves all spot FX
// and metals as BASE/QUOTE — every such catalog pair must resolve to a symbol.
const fxAndMetals = PAIR_CATALOG.filter(
  (p) => p.category.startsWith("forex-") || p.category === "metal",
);
assert.ok(fxAndMetals.length >= 30, "catalog should hold the full FX + metals set");
for (const pair of fxAndMetals) {
  assert.equal(
    twelveDataSymbol(pair.symbol),
    `${pair.currencies[0]}/${pair.currencies[1]}`,
    `${pair.symbol} must resolve to a TwelveData symbol`,
  );
}

// Spot-check the previously-missing favourites that regressed to "—".
assert.equal(twelveDataSymbol("CADJPY"), "CAD/JPY");
assert.equal(twelveDataSymbol("EURAUD"), "EUR/AUD");
assert.equal(twelveDataSymbol("USDTRY"), "USD/TRY");
assert.equal(twelveDataSymbol("GBPNZD"), "GBP/NZD");

// Indices and crypto are served by other providers, not TwelveData FX.
assert.equal(twelveDataSymbol("US30"), undefined);
assert.equal(twelveDataSymbol("BTCUSD"), undefined);
assert.equal(twelveDataSymbol("UNKNOWN"), undefined);

console.log("twelve data symbol coverage checks passed");
