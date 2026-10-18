/** Pure CLI parsing/planning: invalid input fails before any market data writes. */
export const PRIORITY_HISTORY_SYMBOLS = ["XAUUSD", "EURUSD", "USOIL"] as const;
export const DAY_SECONDS = 86_400;
export type IngestMode = "seed" | "tail" | "import";

export interface IngestOptions {
  mode: IngestMode;
  symbols: string[];
  years: number;
  from?: number;
  to?: number;
  resume: boolean;
  file?: string;
}

export function parseDayStart(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`invalid date: ${value} (use YYYY-MM-DD)`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`invalid date: ${value}`);
  }
  return date.getTime() / 1000;
}

export function parseIngestOptions(argv: string[], supportedSymbols: readonly string[]): IngestOptions {
  const [mode, ...args] = argv;
  if (mode !== "seed" && mode !== "tail" && mode !== "import") throw new Error("mode must be seed, tail, or import");
  const flags: Record<string, string> = {};
  const allowed = new Set(["symbols", "years", "from", "to", "resume", "file", "source"]);
  for (const arg of args) {
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || flags[match[1]] != null) throw new Error(`invalid or duplicate flag: ${arg}`);
    flags[match[1]] = match[2];
  }
  const symbols = [...new Set((flags.symbols ?? supportedSymbols.join(",")).split(",").map(s => s.trim().toUpperCase()))];
  if (symbols.length === 0 || symbols.some(s => !supportedSymbols.includes(s))) {
    throw new Error(`unsupported symbols: ${symbols.filter(s => !supportedSymbols.includes(s)).join(", ")}`);
  }
  const years = Number(flags.years ?? 5);
  if (!Number.isInteger(years) || years < 1 || years > 30) throw new Error("years must be an integer between 1 and 30");
  if (flags.resume != null && flags.resume !== "true" && flags.resume !== "false") throw new Error("resume must be true or false");
  const from = flags.from ? parseDayStart(flags.from) : undefined;
  const to = flags.to ? parseDayStart(flags.to) : undefined;
  if (from != null && to != null && from >= to) throw new Error("from must be earlier than to (to is exclusive)");
  if (mode === "tail" && (from != null || to != null || flags.years != null)) throw new Error("tail does not accept from, to, or years");
  if (mode === "import") {
    if (!flags.file || flags.source !== "dukascopy" || symbols.length !== 1 || !flags.symbols) throw new Error("import requires --file=PATH, --source=dukascopy, and exactly one --symbols=SYMBOL (declare the export's actual source)");
    if (flags.years != null) throw new Error("import uses the CSV's dates, not years");
  } else if (flags.file != null || flags.source != null) throw new Error("file and source are only valid for import mode");
  return { mode, symbols, years, from, to, resume: flags.resume !== "false", ...(flags.file ? { file: flags.file } : {}) };
}

/** Calendar months, newest first so all priority instruments become useful early. */
export function historyChunks(from: number, to: number): Array<[number, number]> {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error("invalid history range");
  const chunks: Array<[number, number]> = [];
  let cursor = from;
  while (cursor < to) {
    const date = new Date(cursor * 1000);
    const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
    chunks.push([cursor, Math.min(next, to)]);
    cursor = next;
  }
  return chunks.reverse();
}

export function historyStart(to: number, years: number): number {
  const date = new Date(to * 1000);
  const year = date.getUTCFullYear() - years;
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).getUTCDate());
  return Date.UTC(year, date.getUTCMonth(), day, date.getUTCHours(), date.getUTCMinutes()) / 1000;
}
