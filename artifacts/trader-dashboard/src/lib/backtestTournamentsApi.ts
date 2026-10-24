import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface BacktestTournament {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  pair: string;
  timeframe: string;
  initialBalance: string;
  maxDrawdownPct: string;
  targetProfitPct: string;
  maxTrades: number;
  timeLimitSeconds: number;
  startCandleTs: number | null;
  status: "in_progress" | "live" | "upcoming" | "ended";
  participantCount: number;
  createdAt: string;
}

export interface BacktestTournamentPlayer {
  id: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  country: string;
  status: "in_progress" | "completed" | "disqualified";
  sessionId: number | null;
  pair?: string;
  timeframe?: string;
  initialBalance: string;
  finalBalance: string;
  totalProfit: string;
  profitPct: string;
  winRate: string;
  winTrades: number;
  loseTrades: number;
  totalTrades: number;
  maxDrawdown: string;
  avgTradeProfit: string;
  profitFactor?: string;
  totalPips?: string;
  score: string;
  rank: number;
  isCurrentUser?: boolean;
}

export interface ArenaRealSessionSummary {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  operatorName: string;
  userId: string | null;
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  winRate: number;
  totalProfit: number;
  profitPct: number;
  totalPips: number;
  maxDrawdown: number;
  profitFactor: number;
  createdAt: string;
}

export interface ArenaRealTelemetry {
  totalRealTrades: number;
  totalRealSessions: number;
  activeSessionsCount: number;
  totalWins: number;
  totalLosses: number;
  avgWinRate: number;
  profitFactor: number;
  netArenaProfit: number;
  netArenaPips: number;
  avgDrawdownPct: number;
  maxDrawdownLimit: number;
  bestTradePnl: number;
  bestSessionLabel: string;
}

export interface BacktestTournamentLeaderboard {
  tournament: BacktestTournament;
  podium: BacktestTournamentPlayer[];
  standings: BacktestTournamentPlayer[];
  totalParticipants: number;
  userEntry: BacktestTournamentPlayer | null;
  telemetry?: ArenaRealTelemetry;
  recentSessions?: ArenaRealSessionSummary[];
}

export interface BacktestTribePreset {
  id: number;
  userId: string;
  tribeName: string;
  sigil: string;
  pair: string;
  timeframe: string;
  initialBalance: string;
  maxDrawdownPct: string;
  targetProfitPct: string;
  maxTrades: number;
  timeLimitSeconds: number;
  randomDates: boolean;
  defaultMembers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BacktestCustomLobby {
  id: number;
  code: string;
  name: string;
  hostUserId: string;
  hostDisplayName: string;
  tribePresetId: number | null;
  pair: string;
  timeframe: string;
  initialBalance: string;
  maxDrawdownPct: string;
  targetProfitPct: string;
  maxTrades: number;
  timeLimitSeconds: number;
  randomDates: boolean;
  status: "waiting" | "starting" | "live" | "completed";
  createdAt: string;
}

export interface TournamentRunSummary {
  initialBalance: number;
  finalBalance: number;
  totalProfit: number;
  profitPct: number;
  winRate: number;
  winTrades: number;
  loseTrades: number;
  totalTrades: number;
  maxDrawdown: number;
  avgTradeProfit: number;
  maxAllowedDrawdown?: number;
  asset?: string;
  rank?: number;
  isDisqualified?: boolean;
}

export interface TournamentRunResult {
  success: boolean;
  won: boolean;
  rank: number;
  status: "completed" | "disqualified";
  summary: TournamentRunSummary;
}

// ── Query Keys ───────────────────────────────────────────────────────────────
export const backtestTournamentsKey = () => ["/api/backtest-tournaments"] as const;
export const backtestTournamentLeaderboardKey = (id: number) =>
  ["/api/backtest-tournaments", id, "leaderboard"] as const;
export const backtestTribesKey = () => ["/api/backtest-tournaments/tribes"] as const;
export const backtestCustomLobbyKey = (code: string) => ["/api/backtest-tournaments/custom-lobbies", code] as const;

// ── Fetchers ─────────────────────────────────────────────────────────────────
export function fetchTribePresets(options?: RelativeApiOptions): Promise<{ tribes: BacktestTribePreset[] }> {
  return apiJSON<{ tribes: BacktestTribePreset[] }>("backtest-tournaments/tribes", undefined, options);
}

export function saveTribePreset(
  preset: Partial<BacktestTribePreset>,
  options?: RelativeApiOptions,
): Promise<{ success: boolean; tribe: BacktestTribePreset }> {
  return apiJSON<{ success: boolean; tribe: BacktestTribePreset }>(
    "backtest-tournaments/tribes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    },
    options,
  );
}

export function deleteTribePreset(id: number, options?: RelativeApiOptions): Promise<{ success: boolean }> {
  return apiJSON<{ success: boolean }>(
    `backtest-tournaments/tribes/${id}`,
    {
      method: "DELETE",
    },
    options,
  );
}

export function createCustomLobby(
  lobby: Partial<BacktestCustomLobby>,
  options?: RelativeApiOptions,
): Promise<{ success: boolean; lobby: BacktestCustomLobby }> {
  return apiJSON<{ success: boolean; lobby: BacktestCustomLobby }>(
    "backtest-tournaments/custom-lobbies",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lobby),
    },
    options,
  );
}

export function fetchCustomLobbyByCode(
  code: string,
  options?: RelativeApiOptions,
): Promise<{ lobby: BacktestCustomLobby }> {
  return apiJSON<{ lobby: BacktestCustomLobby }>(`backtest-tournaments/custom-lobbies/${code}`, undefined, options);
}

export interface CandidateTrader {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gradeTitle: string;
}

export function fetchCandidates(
  query?: string,
  options?: RelativeApiOptions,
): Promise<{ candidates: CandidateTrader[] }> {
  const url = query ? `backtest-tournaments/candidates?q=${encodeURIComponent(query)}` : "backtest-tournaments/candidates";
  return apiJSON<{ candidates: CandidateTrader[] }>(url, undefined, options);
}

export function fetchBacktestTournaments(options?: RelativeApiOptions): Promise<{ tournaments: BacktestTournament[] }> {
  return apiJSON<{ tournaments: BacktestTournament[] }>("backtest-tournaments", undefined, options);
}

export function fetchBacktestTournamentLeaderboard(
  tournamentId: number,
  options?: RelativeApiOptions,
): Promise<BacktestTournamentLeaderboard> {
  return apiJSON<BacktestTournamentLeaderboard>(`backtest-tournaments/${tournamentId}/leaderboard`, undefined, options);
}

export interface ProvisionedBacktestSession {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  strategy: string | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  stats: {
    total: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number;
    avgRR: string | null;
    totalPips: string;
  };
}

export function joinBacktestTournament(
  tournamentId: number,
  body?: {
    displayName?: string;
    avatarUrl?: string;
    pair?: string;
    timeframe?: string;
    title?: string;
  },
  options?: RelativeApiOptions,
): Promise<{
  success: boolean;
  tournament: BacktestTournament;
  sessionId: number;
  session?: ProvisionedBacktestSession | null;
}> {
  return apiJSON<{
    success: boolean;
    tournament: BacktestTournament;
    sessionId: number;
    session?: ProvisionedBacktestSession | null;
  }>(
    `backtest-tournaments/${tournamentId}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
    options,
  );
}

export function completeBacktestTournament(
  tournamentId: number,
  summary: Partial<TournamentRunSummary>,
  options?: RelativeApiOptions,
): Promise<TournamentRunResult> {
  return apiJSON<TournamentRunResult>(
    `backtest-tournaments/${tournamentId}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    },
    options,
  );
}
