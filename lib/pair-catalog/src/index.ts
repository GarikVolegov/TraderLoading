export interface PairEntry {
  symbol: string;
  label: string;
  category: "forex-major" | "forex-minor" | "forex-exotic" | "metal" | "index" | "crypto";
  currencies: string[];
}

export const PAIR_CATALOG: PairEntry[] = [
  { symbol: "EURUSD", label: "EUR/USD", category: "forex-major", currencies: ["EUR", "USD"] },
  { symbol: "GBPUSD", label: "GBP/USD", category: "forex-major", currencies: ["GBP", "USD"] },
  { symbol: "USDJPY", label: "USD/JPY", category: "forex-major", currencies: ["USD", "JPY"] },
  { symbol: "USDCHF", label: "USD/CHF", category: "forex-major", currencies: ["USD", "CHF"] },
  { symbol: "AUDUSD", label: "AUD/USD", category: "forex-major", currencies: ["AUD", "USD"] },
  { symbol: "USDCAD", label: "USD/CAD", category: "forex-major", currencies: ["USD", "CAD"] },
  { symbol: "NZDUSD", label: "NZD/USD", category: "forex-major", currencies: ["NZD", "USD"] },

  { symbol: "EURGBP", label: "EUR/GBP", category: "forex-minor", currencies: ["EUR", "GBP"] },
  { symbol: "EURJPY", label: "EUR/JPY", category: "forex-minor", currencies: ["EUR", "JPY"] },
  { symbol: "GBPJPY", label: "GBP/JPY", category: "forex-minor", currencies: ["GBP", "JPY"] },
  { symbol: "AUDJPY", label: "AUD/JPY", category: "forex-minor", currencies: ["AUD", "JPY"] },
  { symbol: "CADJPY", label: "CAD/JPY", category: "forex-minor", currencies: ["CAD", "JPY"] },
  { symbol: "EURAUD", label: "EUR/AUD", category: "forex-minor", currencies: ["EUR", "AUD"] },
  { symbol: "EURCHF", label: "EUR/CHF", category: "forex-minor", currencies: ["EUR", "CHF"] },
  { symbol: "EURNZD", label: "EUR/NZD", category: "forex-minor", currencies: ["EUR", "NZD"] },
  { symbol: "EURCAD", label: "EUR/CAD", category: "forex-minor", currencies: ["EUR", "CAD"] },
  { symbol: "GBPAUD", label: "GBP/AUD", category: "forex-minor", currencies: ["GBP", "AUD"] },
  { symbol: "GBPCAD", label: "GBP/CAD", category: "forex-minor", currencies: ["GBP", "CAD"] },
  { symbol: "GBPCHF", label: "GBP/CHF", category: "forex-minor", currencies: ["GBP", "CHF"] },
  { symbol: "GBPNZD", label: "GBP/NZD", category: "forex-minor", currencies: ["GBP", "NZD"] },
  { symbol: "AUDCAD", label: "AUD/CAD", category: "forex-minor", currencies: ["AUD", "CAD"] },
  { symbol: "AUDCHF", label: "AUD/CHF", category: "forex-minor", currencies: ["AUD", "CHF"] },
  { symbol: "AUDNZD", label: "AUD/NZD", category: "forex-minor", currencies: ["AUD", "NZD"] },
  { symbol: "NZDJPY", label: "NZD/JPY", category: "forex-minor", currencies: ["NZD", "JPY"] },
  { symbol: "NZDCAD", label: "NZD/CAD", category: "forex-minor", currencies: ["NZD", "CAD"] },
  { symbol: "NZDCHF", label: "NZD/CHF", category: "forex-minor", currencies: ["NZD", "CHF"] },
  { symbol: "CADCHF", label: "CAD/CHF", category: "forex-minor", currencies: ["CAD", "CHF"] },
  { symbol: "CHFJPY", label: "CHF/JPY", category: "forex-minor", currencies: ["CHF", "JPY"] },

  { symbol: "USDMXN", label: "USD/MXN", category: "forex-exotic", currencies: ["USD", "MXN"] },
  { symbol: "USDZAR", label: "USD/ZAR", category: "forex-exotic", currencies: ["USD", "ZAR"] },
  { symbol: "USDTRY", label: "USD/TRY", category: "forex-exotic", currencies: ["USD", "TRY"] },
  { symbol: "USDSGD", label: "USD/SGD", category: "forex-exotic", currencies: ["USD", "SGD"] },
  { symbol: "USDHKD", label: "USD/HKD", category: "forex-exotic", currencies: ["USD", "HKD"] },
  { symbol: "USDNOK", label: "USD/NOK", category: "forex-exotic", currencies: ["USD", "NOK"] },
  { symbol: "USDSEK", label: "USD/SEK", category: "forex-exotic", currencies: ["USD", "SEK"] },

  { symbol: "XAUUSD", label: "XAU/USD", category: "metal", currencies: ["XAU", "USD"] },
  { symbol: "XAGUSD", label: "XAG/USD", category: "metal", currencies: ["XAG", "USD"] },

  { symbol: "US30", label: "US30", category: "index", currencies: ["USD"] },
  { symbol: "NAS100", label: "NAS100", category: "index", currencies: ["USD"] },
  { symbol: "SPX500", label: "SPX500", category: "index", currencies: ["USD"] },

  { symbol: "BTCUSD", label: "BTC/USD", category: "crypto", currencies: ["BTC", "USD"] },
  { symbol: "ETHUSD", label: "ETH/USD", category: "crypto", currencies: ["ETH", "USD"] },
];

export const CATEGORY_LABELS: Record<string, string> = {
  "forex-major": "Forex Majors",
  "forex-minor": "Forex Minors",
  "forex-exotic": "Forex Exotici",
  "metal": "Metalli",
  "index": "Indici",
  "crypto": "Crypto",
};

export function getPairEntry(symbol: string): PairEntry | undefined {
  return PAIR_CATALOG.find((p) => p.symbol === symbol);
}

export function getCurrenciesFromPairs(symbols: string[]): string[] {
  const currencies = new Set<string>();
  for (const sym of symbols) {
    const entry = getPairEntry(sym);
    if (entry) {
      for (const c of entry.currencies) {
        currencies.add(c);
      }
    }
  }
  return [...currencies].sort();
}

export function getPairLabel(symbol: string): string {
  return getPairEntry(symbol)?.label ?? symbol;
}
