// Pips per price unit for an instrument. FX majors are 5-digit (x10000), JPY
// pairs 3-digit (x100), gold x10, indices and crypto x1. Shared by chart replay
// and the manual backtest form so both report the same pips for a symbol.
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";
  const withoutPrefix = symbol.includes(":") ? symbol.split(":")[1] : symbol;
  return withoutPrefix.replace(/[\/\-_\s]/g, "").toUpperCase();
}

export function getPipMultiplier(symbol: string): number {
  const s = normalizeSymbol(symbol);
  if (s.includes("JPY")) return 100;
  if (s.includes("XAU") || s.includes("GOLD")) return 10;
  if (s === "USOIL" || s.includes("OIL") || s.includes("WTI")) return 100; // WTI CFD: one quoted tick is $0.01.
  if (["US30", "NAS100", "SPX500", "NDX", "DJI", "SPX", "GER40", "DAX", "UK100", "US2000"].some((idx) => s.includes(idx))) return 1;
  if (s.includes("BTC") || s.includes("ETH") || s.includes("SOL")) return 1;
  return 10000;
}

export function formatPrice(price: number, symbol = ""): string {
  if (!Number.isFinite(price)) return "—";
  const mult = getPipMultiplier(symbol);
  if (mult === 1) return price.toFixed(2);
  if (mult === 10) return price.toFixed(2);
  if (mult === 100) return price.toFixed(3);
  return price.toFixed(5);
}
