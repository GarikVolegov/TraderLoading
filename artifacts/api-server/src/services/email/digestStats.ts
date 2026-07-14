// ─── Weekly digest stats reducer (pure) ───────────────────────────────────────
// Turns a user's closed trades into the DigestStats the lifecycle email renders.
// Reuses tradeAnalytics' rMultiple convention so R here matches the coach and the
// client diario. No I/O; `now` is injected so the window is deterministic. The
// streak is activity-based (login/journal), not derivable from trades, so it is
// passed in rather than computed here.

import { rMultiple, type EdgeTrade } from "../tradeAnalytics.js";
import type { DigestStats } from "./lifecycleEmailContent.js";

export interface DigestStatsOptions {
  /** Look-back window in days (default one week). */
  windowDays?: number;
  /** The user's current activity streak, passed through unchanged. */
  streakDays?: number;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function buildDigestStats(
  trades: EdgeTrade[],
  now: Date,
  opts: DigestStatsOptions = {},
): DigestStats {
  const windowDays = opts.windowDays ?? 7;
  const streakDays = opts.streakDays ?? 0;
  const cutoff = now.getTime() - windowDays * 86_400_000;

  const inWindow = trades.filter((t) => {
    if (!t.closeTime) return false; // still open
    const closed = Date.parse(t.closeTime);
    return Number.isFinite(closed) && closed >= cutoff && closed <= now.getTime();
  });

  let wins = 0;
  let decided = 0;
  let netR = 0;
  const symbolCounts = new Map<string, number>();

  for (const t of inWindow) {
    if (typeof t.profit === "number" && t.profit !== 0) {
      decided += 1;
      if (t.profit > 0) wins += 1;
    }
    const r = rMultiple(t);
    if (r !== null) netR += r;
    symbolCounts.set(t.symbol, (symbolCounts.get(t.symbol) ?? 0) + 1);
  }

  // Most-traded symbol; ties break alphabetically for a stable result.
  let topSymbol: string | null = null;
  let topCount = 0;
  for (const [symbol, count] of [...symbolCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > topCount) {
      topCount = count;
      topSymbol = symbol;
    }
  }

  return {
    tradesLogged: inWindow.length,
    winRate: decided === 0 ? null : round4(wins / decided),
    netR: round4(netR),
    streakDays,
    topSymbol,
  };
}
