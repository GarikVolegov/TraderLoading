import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface LeaderboardEntry {
  position: number;
  userId?: string | null;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
}

export const leaderboardQueryKey = ["/api/leaderboard"] as const;

export function fetchLeaderboard(options?: RelativeApiOptions): Promise<LeaderboardEntry[]> {
  return apiJSON<LeaderboardEntry[]>("leaderboard", undefined, options);
}
