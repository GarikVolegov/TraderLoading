import type { Candle } from "../candles.js";
import { REPLAY_INSTRUMENTS, SOURCE_ID, symbolId } from "../candleRegistry.js";
import { validateImportCandles } from "./coverage.js";
import type { CandleSource } from "./types.js";

function splitCsvRow(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  cells.push(cell.trim());
  return cells;
}

function parseUtcTime(value: string, utcHeader: boolean): number {
  const european = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(
    value,
  );
  if (european) {
    if (!utcHeader)
      throw new Error("CSV European timestamp requires Time (UTC) or Gmt time header");
    const [, day, month, year, hour, minute, second, millisecond = "0"] = european;
    const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond.padEnd(3, "0")}Z`;
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized)
      throw new Error("Invalid UTC date in CSV");
    return date.getTime() / 1000;
  }
  let normalized = value.replace(" ", "T");
  const explicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  if (!explicitZone) {
    if (!utcHeader) throw new Error("CSV timestamps must declare UTC or an explicit timezone");
    normalized += "Z";
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(
      normalized,
    )
  ) {
    throw new Error("Invalid ISO timestamp in CSV");
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid ISO date in CSV");
  // JS normalizes impossible day numbers; reject them before they become bars.
  const ymd = normalized.slice(0, 10);
  const midnight = new Date(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== ymd)
    throw new Error("Invalid ISO date in CSV");
  return timestamp / 1000;
}

/** Import only explicitly declared Dukascopy M1 exports. The caller supplies
 * the symbol and declares provenance; arbitrary broker CSVs must not be relabeled. */
export function parseDukascopyM1Csv(text: string): Candle[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV contains no candle rows");
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvRow(lines[0], separator).map((cell) =>
    cell.toLowerCase().replace(/\s+/g, "").replace(/[()]/g, ""),
  );
  const timeIndex = headers.findIndex((value) =>
    ["timeutc", "gmttime", "timestamp", "time"].includes(value),
  );
  const utcHeader = timeIndex >= 0 && ["timeutc", "gmttime"].includes(headers[timeIndex]);
  const indices = ["open", "high", "low", "close"].map((name) => headers.indexOf(name));
  const volumeIndex = headers.findIndex((value) => value === "volume" || value === "tickvolume");
  if (timeIndex < 0 || indices.some((index) => index < 0))
    throw new Error("CSV requires Time (UTC)/Gmt time and Open, High, Low, Close columns");
  const number = (value: string | undefined): number => {
    if (value === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))
      throw new Error("Invalid numeric candle value in CSV");
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("Invalid numeric candle value in CSV");
    return parsed;
  };
  const candles = lines.slice(1).map((line, index) => {
    try {
      const cells = splitCsvRow(line, separator);
      if (cells.length !== headers.length)
        throw new Error("CSV row has the wrong number of columns");
      const [open, high, low, close] = indices.map((column) => number(cells[column]));
      return {
        time: parseUtcTime(cells[timeIndex], utcHeader),
        open,
        high,
        low,
        close,
        ...(volumeIndex >= 0 ? { volume: number(cells[volumeIndex]) } : {}),
      };
    } catch (error) {
      throw new Error(
        `CSV row ${index + 2}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
  // Avoid spreading millions of timestamps into Math.min/max.
  let first = candles[0].time;
  let last = first;
  for (const candle of candles) {
    first = Math.min(first, candle.time);
    last = Math.max(last, candle.time);
  }
  return validateImportCandles(candles, first, last + 60);
}

export function createCsvSource(symbol: string, candles: Candle[]): CandleSource {
  const canonical = REPLAY_INSTRUMENTS[symbol]?.source ??
    (symbol === "BTCUSD" || symbol === "ETHUSD" ? "binance" : "dukascopy");
  if (symbolId(symbol) == null || canonical !== "dukascopy")
    throw new Error("Dukascopy CSV cannot replace this instrument's canonical quote feed");
  const lowerBound = (time: number) => {
    let left = 0,
      right = candles.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (candles[middle].time < time) left = middle + 1;
      else right = middle;
    }
    return left;
  };
  return {
    id: SOURCE_ID.dukascopy,
    name: "dukascopy",
    supports: (value) => value === symbol,
    async fetchRange(value, from, to) {
      if (value !== symbol) throw new Error("CSV source does not contain the requested symbol");
      return candles.slice(lowerBound(from), lowerBound(to));
    },
  };
}
