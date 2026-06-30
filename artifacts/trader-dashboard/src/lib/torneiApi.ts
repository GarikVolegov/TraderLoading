// Client off-contract dei Tornei (come journalRecapsApi): tipi a mano + apiJSON.
import { apiJSON, apiRequest, type RelativeApiOptions } from "./apiFetch";

export type TorneiMetric = "r" | "ts";

export interface TorneiSeason {
  id: number;
  slug: string;
  label: string;
  status: "upcoming" | "live" | "ended";
  startsAt: string;
  endsAt: string;
  settledAt: string | null;
}

export interface TorneiCurrent {
  season: TorneiSeason | null;
  enrolled: boolean;
  totalPlayers: number;
  progress: number;
}

export interface TorneiStanding {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  rCum: number;
  discIndex: number;
  score: number;
  division: string;
  rank: number;
  prevRank: number;
  trades: number;
  dq: boolean;
  dqReason: string | null;
  me: boolean;
}

export interface TorneiStandingsResponse {
  board: TorneiStanding[];
  dq: TorneiStanding[];
  me: TorneiStanding | null;
  total: number;
}

export interface TorneiPrize {
  tier: string;
  xpAwarded: number;
  proMonths: number;
  status: string;
  certificateId: number | null;
}

export interface TorneiCertificate {
  id: number;
  seasonLabel: string;
  tier: string;
  edition: string;
  rarity: string;
  mintStatus: "claimable" | "pending" | "minted" | "failed";
  walletAddress: string | null;
  chain: string | null;
  contractAddress: string | null;
  tokenId: string | null;
  txHash: string | null;
}

export interface TorneiMe {
  standing: TorneiStanding | null;
  nextDivision: string | null;
  prizes: TorneiPrize[];
  certificates: TorneiCertificate[];
}

export interface TorneiHallEntry {
  seasonLabel: string;
  startsAt: string;
  endsAt: string;
  champion: string | null;
  rCum: number | null;
  discIndex: number | null;
}

export type EnrollResult = { ok: true } | { ok: false; reason: string };

// ── query keys ───────────────────────────────────────────────────────────────
export const torneiCurrentKey = () => ["/api/tornei/current"] as const;
export const torneiStandingsKey = (metric: TorneiMetric) =>
  ["/api/tornei/standings", metric] as const;
export const torneiMeKey = () => ["/api/tornei/me"] as const;
export const torneiHallKey = () => ["/api/tornei/hall"] as const;
export const torneiCertificatesKey = () => ["/api/tornei/certificates"] as const;

// ── fetchers ─────────────────────────────────────────────────────────────────
export function fetchTorneiCurrent(options?: RelativeApiOptions): Promise<TorneiCurrent> {
  return apiJSON<TorneiCurrent>("tornei/current", undefined, options);
}

export function fetchTorneiStandings(
  metric: TorneiMetric,
  options?: RelativeApiOptions,
): Promise<TorneiStandingsResponse> {
  return apiJSON<TorneiStandingsResponse>(`tornei/standings?metric=${metric}`, undefined, options);
}

export function fetchTorneiMe(options?: RelativeApiOptions): Promise<TorneiMe> {
  return apiJSON<TorneiMe>("tornei/me", undefined, options);
}

export function fetchTorneiHall(options?: RelativeApiOptions): Promise<{ entries: TorneiHallEntry[] }> {
  return apiJSON<{ entries: TorneiHallEntry[] }>("tornei/hall", undefined, options);
}

export function fetchTorneiCertificates(
  options?: RelativeApiOptions,
): Promise<{ certificates: TorneiCertificate[] }> {
  return apiJSON<{ certificates: TorneiCertificate[] }>("tornei/certificates", undefined, options);
}

// L'iscrizione restituisce il motivo dell'eventuale rifiuto (idoneità).
export async function enrollTornei(
  consent: boolean,
  options?: RelativeApiOptions,
): Promise<EnrollResult> {
  const res = await apiRequest(
    "tornei/enroll",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent }),
    },
    options,
  );
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { reason?: string };
  return { ok: false, reason: body.reason ?? "error" };
}

export function claimTorneiCertificate(
  id: number,
  options?: RelativeApiOptions,
): Promise<{ certificate: TorneiCertificate | null }> {
  return apiJSON<{ certificate: TorneiCertificate | null }>(
    `tornei/certificates/${id}/claim`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    options,
  );
}
