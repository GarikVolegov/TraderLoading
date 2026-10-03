// Client off-contract della correlazione di portafoglio (come torneiApi): apiJSON.
import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface ConcentrationPair {
  a: string;
  b: string;
  correlation: number;
  /** "compounding" = same directional bet (risk); "hedging" = offsetting. */
  effect: "compounding" | "hedging";
}

export interface CorrelationResponse {
  symbols: string[];
  /** matrix[i][j] correlation of symbols[i] vs symbols[j]; null when undefined. */
  matrix: (number | null)[][];
  /** Overlapping D1 returns used. */
  window: number;
  concentration: ConcentrationPair[];
  positions: { symbol: string; direction: "long" | "short" }[];
}

export const correlationKey = () => ["/api/journal/correlation"] as const;

export function fetchCorrelation(options?: RelativeApiOptions): Promise<CorrelationResponse> {
  return apiJSON<CorrelationResponse>("journal/correlation", undefined, options);
}
