// Universal-ish trade CSV parser (audit idea 5D). Traders who don't sync a broker
// can import a statement export; the parsed rows feed the coach like manual entries.
// Tolerant of common column names (MT4/MT5/cTrader) — case/punctuation-insensitive
// header aliases. Pure and unit-tested. (Plain comma split — broker exports rarely
// quote fields; a quoting-aware pass can be added if a real file needs it.)

export interface ParsedCsvTrade {
  ticket?: string;
  symbol?: string;
  direction?: "buy" | "sell";
  volume?: string;
  entryPrice?: string;
  exitPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  profit?: string;
  commission?: string;
  swap?: string;
  openTime?: string;
  closeTime?: string;
}

type Field = Exclude<keyof ParsedCsvTrade, never>;

// Normalized header token → canonical field.
const HEADER_ALIASES: Record<string, Field> = {};
const ALIAS_GROUPS: Array<[Field, string[]]> = [
  ["ticket", ["ticket", "order", "orderid", "ordernumber", "dealid", "deal", "position", "id"]],
  ["symbol", ["symbol", "instrument", "pair", "ticker", "sym"]],
  ["direction", ["type", "direction", "side", "action", "cmd", "buysell"]],
  ["volume", ["volume", "lots", "lot", "size", "quantity", "qty", "units"]],
  ["entryPrice", ["openprice", "entry", "entryprice", "priceopen", "open", "openrate"]],
  ["exitPrice", ["closeprice", "exit", "exitprice", "priceclose", "close", "closerate"]],
  ["stopLoss", ["sl", "stoploss"]],
  ["takeProfit", ["tp", "takeprofit"]],
  ["profit", ["profit", "pnl", "pl", "netprofit", "gain", "result"]],
  ["commission", ["commission", "commissions", "fee", "fees"]],
  ["swap", ["swap", "rollover", "storage", "interest"]],
  ["openTime", ["opentime", "opendate", "timeopen", "opened", "openedat"]],
  ["closeTime", ["closetime", "closedate", "timeclose", "closed", "closedat"]],
];
for (const [field, tokens] of ALIAS_GROUPS) for (const t of tokens) HEADER_ALIASES[t] = field;

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDirection(cell: string): "buy" | "sell" | undefined {
  const d = cell.trim().toLowerCase();
  if (d === "1" || d.includes("sell") || d.includes("short")) return "sell";
  if (d === "0" || d.includes("buy") || d.includes("long")) return "buy";
  return undefined;
}

export interface ParsedCsvResult {
  trades: ParsedCsvTrade[];
  /** Data rows that couldn't be parsed (wrong column count, no symbol). */
  skipped: number;
}

export function parseTradesCsv(csv: string): ParsedCsvResult {
  const lines = csv.split(/\r?\n/);
  if (lines.length === 0) return { trades: [], skipped: 0 };

  const header = lines[0].split(",").map(normalizeHeader);
  const columnField = header.map((h) => HEADER_ALIASES[h]);
  // Unrecognized format: without at least a symbol column there's nothing to key on.
  if (!columnField.includes("symbol")) return { trades: [], skipped: 0 };

  const trades: ParsedCsvTrade[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "") continue; // ignore truly blank lines silently
    const cells = lines[i].split(",");
    if (cells.length !== header.length) {
      skipped += 1;
      continue;
    }
    const trade: ParsedCsvTrade = {};
    for (let c = 0; c < header.length; c += 1) {
      const field = columnField[c];
      const value = cells[c]?.trim() ?? "";
      if (!field || value === "") continue;
      if (field === "direction") {
        const dir = normalizeDirection(value);
        if (dir) trade.direction = dir;
      } else {
        trade[field] = value;
      }
    }
    if (!trade.symbol) {
      skipped += 1;
      continue;
    }
    trades.push(trade);
  }

  return { trades, skipped };
}
