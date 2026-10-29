import type { MarketContext } from "@workspace/api-client-react";
import { apiJSON } from "./apiFetch";

export const MARKET_HORIZON = "4h" as const;
export const DIRECTIONAL_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD", "XAUUSD"] as const;

export type TrendDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type BiasTier = "TIER_A_PLUS" | "TIER_QUALITY" | "NEUTRAL_WAIT" | "COUNTER_TREND_WARNING";

export interface TimeframeBiasDetail {
  timeframe: "W1" | "D1" | "H4";
  direction: TrendDirection;
  score: number;
  sma10?: number;
  sma20?: number;
  sma50?: number;
  priceVsSma: "ABOVE" | "BELOW" | "AT_LEVEL";
  structure: "HIGHER_HIGHS_LOWS" | "LOWER_HIGHS_LOWS" | "RANGE_CONSOLIDATION";
  keyHigh: number;
  keyLow: number;
  keyHighLabel: string;
  keyLowLabel: string;
  sweptHigh: boolean;
  sweptLow: boolean;
  equilibrium50: number;
  algorithmic786: number;
  rangeZone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
  rangePercentile: number;
}

export interface MacroFactorDetail {
  factor: "REAL_RATES" | "DOLLAR_DXY" | "INFLATION_LABOR" | "GEOPOLITICS" | "COT_INSTITUTIONAL";
  title: string;
  status: TrendDirection;
  score: number;
  weight: number;
  summary: string;
  catalysts?: string[];
}

export interface DirectionalBiasResult {
  pair: string;
  calculatedAt: string;
  referencePrice: number;
  h4MasterBias: TrendDirection;
  confidenceScore: number;
  edgeTier: BiasTier;
  tierDescription: string;
  recommendedAction: string;
  alignmentStatus: "TRIPLE_ALIGNED" | "DOUBLE_ALIGNED" | "CONFLICTED" | "NEUTRAL";
  antiFadeProtected: boolean;
  invalidationLevel: number;
  timeframes: {
    w1: TimeframeBiasDetail;
    d1: TimeframeBiasDetail;
    h4: TimeframeBiasDetail;
  };
  macroFactors: {
    realRates: MacroFactorDetail;
    dollarDxy: MacroFactorDetail;
    inflationLabor: MacroFactorDetail;
    geopolitics: MacroFactorDetail;
    cotInstitutional: MacroFactorDetail;
  };
  macroScore: number;
}

export interface DirectionalOutlook {
  pair: string; horizon: "4h"; status: "available" | "unvalidated" | "insufficient" | "unsupported" | "stale";
  reason: string | null; cutoffAt: string; issuedAt: string; targetEnd: string;
  referencePrice: number | null; referenceObservedAt: string | null;
  neutralBand: { lower: number; upper: number } | null;
  probabilities: { up: number; flat: number; down: number } | null;
  modelVersion: string | null;
  validation: { passed: boolean; samples?: number; count?: number; reasons?: string[]; brier?: number | null; baselineBrier?: number | null; ece?: number | null } | null;
  sources: string[];
}
export type IntelligenceContext = MarketContext & {
  horizon?: "4h"; snapshotId?: string | null; outlook?: DirectionalOutlook | null;
  directionalBias?: DirectionalBiasResult | null;
};
export interface MarketDecision {
  id: string; snapshotId: string; choice: "trade" | "wait"; note: string | null;
  journalEntryId: number | null; createdAt: string; snapshot: IntelligenceContext;
  outcome: { outcome: "up" | "flat" | "down"; returnLog: number; finalPrice: number; observedAt: string } | null;
}
export interface MarketDecisionsPage { items: MarketDecision[]; nextCursor: string | null }
export const fetchMarketDecision = (id: string): Promise<MarketDecision> => apiJSON(`market-decisions/${encodeURIComponent(id)}`);
export const marketDecisionsKey = ["market-decisions"] as const;
export function fetchMarketContext(pair: string): Promise<IntelligenceContext> {
  return apiJSON(`tools/market-context?${new URLSearchParams({ pair, horizon: MARKET_HORIZON })}`);
}
export function fetchDirectionalBias(pair: string): Promise<DirectionalBiasResult> {
  return apiJSON(`tools/directional-bias?${new URLSearchParams({ pair })}`);
}
export function saveMarketDecision(input: { snapshotId: string; choice: "trade" | "wait"; note?: string }): Promise<MarketDecision> {
  return apiJSON("market-decisions", { method: "POST", body: JSON.stringify(input) });
}
export function fetchMarketDecisions(cursor?: string): Promise<MarketDecisionsPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  return apiJSON(`market-decisions?${params}`);
}

/** A connection or a non-null number alone cannot authorize probability display. */
export function canDisplayProbabilities(outlook: DirectionalOutlook | null | undefined, pair: string, now = Date.now()): boolean {
  if (!outlook || outlook.pair !== pair || outlook.horizon !== MARKET_HORIZON || outlook.status !== "available" || !outlook.validation?.passed || !outlook.modelVersion) return false;
  const issued = Date.parse(outlook.issuedAt), cutoff = Date.parse(outlook.cutoffAt), end = Date.parse(outlook.targetEnd), observed = Date.parse(outlook.referenceObservedAt ?? "");
  if (![issued, cutoff, end, observed].every(Number.isFinite) || issued > now + 5_000 || issued < cutoff || cutoff > now || now - issued > 90_000 || end <= now || end - cutoff !== 14_400_000 || observed > cutoff || cutoff - observed > 120_000 || !outlook.referencePrice || !outlook.neutralBand) return false;
  if (![outlook.referencePrice, outlook.neutralBand.lower, outlook.neutralBand.upper].every(v => Number.isFinite(v) && v > 0) || outlook.neutralBand.lower >= outlook.referencePrice || outlook.neutralBand.upper <= outlook.referencePrice) return false;
  const p = outlook.probabilities;
  return Boolean(p && [p.up, p.flat, p.down].every(v => Number.isFinite(v) && v >= 0 && v <= 1) && Math.abs(p.up + p.flat + p.down - 1) < 0.001);
}
export function decisionJournalHref(decision: MarketDecision): string {
  const params = new URLSearchParams({ t: "trades", new: "1", pair: decision.snapshot.pair, horizon: MARKET_HORIZON, marketDecisionId: decision.id });
  return `/journal?${params}`;
}
