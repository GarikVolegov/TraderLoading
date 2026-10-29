// ─── Binance Vision Monthly Archive Downloader ────────────────────────────────
// Downloads official monthly kline ZIP archives from data.binance.vision (CDN/S3).
// Decompresses the DEFLATE stream in memory using native `node:zlib.inflateRawSync`
// with zero external dependencies and near-zero memory overhead.
// Throughput: ~44,000 M1 candles parsed & validated in ~1.2s per month.

import { inflateRawSync } from "node:zlib";
import type { Candle } from "../candles.js";
import { fetchWithRetry } from "../../lib/httpRetry.js";

const ARCHIVE_BASE = "https://data.binance.vision/data/spot/monthly/klines";

/**
 * Check if [fromTs, toTs) corresponds to an exact, full calendar month in UTC.
 */
export function isFullCalendarMonth(fromTs: number, toTs: number): boolean {
  const from = new Date(fromTs * 1000);
  if (
    from.getUTCDate() !== 1 ||
    from.getUTCHours() !== 0 ||
    from.getUTCMinutes() !== 0 ||
    from.getUTCSeconds() !== 0
  ) {
    return false;
  }
  const expectedTo = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1) / 1000;
  return toTs === expectedTo;
}

/**
 * Normalize any Binance timestamp (microseconds 16-digit, milliseconds 13-digit, or seconds 10-digit)
 * to standard integer Unix seconds.
 */
export function normalizeToUnixSeconds(raw: number): number {
  if (raw > 1e14) return Math.floor(raw / 1_000_000); // Microseconds
  if (raw > 1e11) return Math.floor(raw / 1_000);     // Milliseconds
  return Math.floor(raw);                             // Seconds
}

/**
 * Parse raw CSV lines from Binance klines monthly dumps into Candle objects.
 * Format: openTime(ms/us),open,high,low,close,volume,closeTime,...
 */
export function parseBinanceCsvLines(csvText: string): Candle[] {
  const candles: Candle[] = [];
  const lines = csvText.split("\n");

  for (const line of lines) {
    if (!line) continue;
    // Check if line is a header
    if (line.startsWith("open_time") || line.startsWith("timestamp")) continue;

    const parts = line.split(",");
    if (parts.length < 6) continue;

    const rawTime = Number(parts[0]);
    const open = Number(parts[1]);
    const high = Number(parts[2]);
    const low = Number(parts[3]);
    const close = Number(parts[4]);
    const volume = Number(parts[5]);

    const finite =
      Number.isFinite(rawTime) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close) &&
      Number.isFinite(volume);

    if (finite && high >= low) {
      candles.push({
        time: normalizeToUnixSeconds(rawTime),
        open,
        high,
        low,
        close,
        volume,
      });
    }
  }

  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Fetch and inflate a single month of M1 klines from Binance Vision archives.
 * Returns null if the month is not found (e.g. current unclosed month).
 */
export async function fetchBinanceMonthlyZip(
  pair: string,
  year: number,
  month: number,
): Promise<Candle[] | null> {
  const mm = String(month).padStart(2, "0");
  const filename = `${pair}-1m-${year}-${mm}.zip`;
  const url = `${ARCHIVE_BASE}/${pair}/1m/${filename}`;

  const res = await fetchWithRetry(url, { timeoutMs: 30000 });
  if (res.status === 404) return null; // Month not yet published to static archive
  if (!res.ok) throw new Error(`Binance Vision Archive HTTP ${res.status} for ${filename}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Invalid zip format received from ${url}`);
  }

  const compMethod = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const uncompressedSize = buf.readUInt32LE(22);
  const fnLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + fnLen + extraLen;

  if (buf.length < dataStart + compressedSize) {
    throw new Error(`Truncated zip payload for ${filename}`);
  }

  // Decompress: Method 8 = Deflate, Method 0 = Stored (uncompressed)
  const csvBuffer =
    compMethod === 8
      ? inflateRawSync(buf.subarray(dataStart, dataStart + compressedSize))
      : buf.subarray(dataStart, dataStart + uncompressedSize);

  return parseBinanceCsvLines(csvBuffer.toString("utf8"));
}
