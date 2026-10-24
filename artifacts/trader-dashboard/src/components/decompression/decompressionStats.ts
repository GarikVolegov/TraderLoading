/**
 * LIMEN PROTOCOL — Decompression Stats & Local Records
 */

export interface DecompressionStats {
  highScore: number;
  totalAurei: number;
  totalGames: number;
  bestDistanceMeters: number;
  totalDetachmentSeconds: number;
}

const STORAGE_KEY = "limen_decompression_stats_v1";

export function loadDecompressionStats(): DecompressionStats {
  if (typeof window === "undefined") {
    return {
      highScore: 0,
      totalAurei: 0,
      totalGames: 0,
      bestDistanceMeters: 0,
      totalDetachmentSeconds: 0,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        highScore: 0,
        totalAurei: 0,
        totalGames: 0,
        bestDistanceMeters: 0,
        totalDetachmentSeconds: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<DecompressionStats>;
    return {
      highScore: Math.max(0, Number(parsed.highScore) || 0),
      totalAurei: Math.max(0, Number(parsed.totalAurei) || 0),
      totalGames: Math.max(0, Number(parsed.totalGames) || 0),
      bestDistanceMeters: Math.max(0, Number(parsed.bestDistanceMeters) || 0),
      totalDetachmentSeconds: Math.max(0, Number(parsed.totalDetachmentSeconds) || 0),
    };
  } catch {
    return {
      highScore: 0,
      totalAurei: 0,
      totalGames: 0,
      bestDistanceMeters: 0,
      totalDetachmentSeconds: 0,
    };
  }
}

export function saveDecompressionRun(run: {
  score: number;
  aurei: number;
  distanceMeters: number;
  sessionDurationSeconds: number;
}): { stats: DecompressionStats; isNewHighScore: boolean } {
  const current = loadDecompressionStats();
  const isNewHighScore = run.score > current.highScore;

  const updated: DecompressionStats = {
    highScore: Math.max(current.highScore, run.score),
    totalAurei: current.totalAurei + run.aurei,
    totalGames: current.totalGames + 1,
    bestDistanceMeters: Math.max(current.bestDistanceMeters, run.distanceMeters),
    totalDetachmentSeconds: current.totalDetachmentSeconds + Math.floor(run.sessionDurationSeconds),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  return { stats: updated, isNewHighScore };
}
