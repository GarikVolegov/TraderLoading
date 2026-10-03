// Pips per price unit for an instrument. FX majors are 5-digit (x10000), JPY
// pairs 3-digit (x100), gold x10, indices and crypto x1. Shared by chart replay
// and the manual backtest form so both report the same pips for a symbol.
export function getPipMultiplier(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 100;
  if (s === "XAUUSD") return 10;
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  return 10000;
}
