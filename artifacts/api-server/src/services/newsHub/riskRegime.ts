// ─── Risk regime (RISK ON / RISK OFF / NEUTRALE) ──────────────────────────────
// Deterministic market-regime classifier. NOT a naive bull/bear count: it models
// real risk-on/off behaviour — safe-haven strength vs risk-asset strength plus
// macro themes — weighted by each article's impact × freshness × confidence.

export interface RiskRegimeInput {
  title: string;
  summary?: string;
  originalTitle?: string | null;
  originalSummary?: string | null;
  impactScore?: number;
  impactDirection?: string | null;
  sentiment?: string | null;
  freshnessTier?: string | null;
  matchConfidence?: number;
  primaryAssets?: string[];
}

export type RiskRegime = "risk-on" | "risk-off" | "neutrale";

export interface RiskRegimeResult {
  regime: RiskRegime;
  intensity: "lieve" | "forte" | null;
  score: number; // -1 = full risk-off, +1 = full risk-on
}

// Strength in these = flight to safety (risk-OFF). Gold/silver, yen, franc.
const SAFE_HAVENS = new Set(["XAU", "XAG", "JPY", "CHF"]);
// Strength in these = risk appetite (risk-ON). Commodity/high-beta FX + crypto.
const RISK_ASSETS = new Set(["AUD", "NZD", "CAD", "BTC", "ETH"]);

const ASSET_RE: Record<string, RegExp> = {
  XAU: /\b(gold|xau|bullion)\b/i,
  XAG: /\b(silver|xag)\b/i,
  JPY: /\b(jpy|yen|boj)\b/i,
  CHF: /\b(chf|swiss\s+franc|snb)\b/i,
  AUD: /\b(aud|aussie|rba)\b/i,
  NZD: /\b(nzd|kiwi|rbnz)\b/i,
  CAD: /\b(cad|canadian\s+dollar|boc)\b/i,
  BTC: /\b(btc|bitcoin)\b/i,
  ETH: /\b(eth|ethereum)\b/i,
};

// Unambiguous risk-OFF events (bad for risk regardless of which asset moves).
// Asset-specific price words (rally/plunge/sell-off…) are intentionally excluded
// here — they're ambiguous (gold plunging is risk-ON) and handled by the per-asset
// direction signal below.
const RISK_OFF_THEME =
  /\b(war|conflict|invasion|missile|sanction|geopolit|crisis|recession|turmoil|flight\s+to\s+safety|safe.?haven|risk.?off|default|contagion|banking\s+crisis|bank\s+run|panic|escalation|tariff|trade\s+war|hawkish|crash)\b/i;
// Unambiguous risk-ON sentiment (risk-positive regardless of asset).
const RISK_ON_THEME =
  /\b(risk.?on|risk\s+appetite|soft\s+landing|goldilocks|rate\s+cut|stimulus|dovish|easing|relief)\b/i;
const HOT_INFLATION_THEME =
  /\b(cpi|inflation|inflazione|consumer\s+price\s+index)\b.{0,90}\b(hot|hotter|sticky|above|beat|beats|higher|rises?|jumps?|accelerat|surprise|sopra|oltre|alta|aument|rialz|accelera|pressione)\b|\b(hot|hotter|sticky|above|beat|beats|higher|sopra|alta|aument|rialz)\b.{0,90}\b(cpi|inflation|inflazione|consumer\s+price\s+index)\b/i;
const COOLING_INFLATION_THEME =
  /\b(cpi|inflation|inflazione|consumer\s+price\s+index)\b.{0,90}\b(cools?|cooler|below|miss|misses|lower|falls?|drops?|disinflation|sotto|raffredda|calo|scende|in\s+discesa)\b|\b(cools?|cooler|below|miss|misses|lower|falls?|drops?|sotto|raffredda|calo|scende)\b.{0,90}\b(cpi|inflation|inflazione|consumer\s+price\s+index)\b/i;
const YIELDS_UP = /\byields?\s+(rise|rises|jump|jumps|surge|surges|climb|climbs|higher|spike)\b|rising\s+yields?/i;
const YIELDS_DOWN = /\byields?\s+(fall|falls|drop|drops|slide|slides|lower|tumble|tumbles)\b|falling\s+yields?/i;

function freshnessWeight(tier: string | null | undefined): number {
  switch (tier) {
    case "live": return 1;
    case "fresh": return 0.85;
    case "fallback": return 0.4;
    case "stale": return 0.2;
    default: return 0.6;
  }
}

function detectedAssets(input: RiskRegimeInput, text: string): string[] {
  const set = new Set<string>(input.primaryAssets ?? []);
  for (const [asset, re] of Object.entries(ASSET_RE)) if (re.test(text)) set.add(asset);
  return [...set];
}

// Per-article signal in roughly [-1.5, +1.5]: negative = risk-off, positive = risk-on.
function articleSignal(input: RiskRegimeInput): number {
  const text = `${input.title} ${input.summary ?? ""} ${input.originalTitle ?? ""} ${input.originalSummary ?? ""}`;
  let signal = 0;
  if (RISK_OFF_THEME.test(text)) signal -= 1;
  if (RISK_ON_THEME.test(text)) signal += 1;
  if (HOT_INFLATION_THEME.test(text)) signal -= 1.2;
  if (COOLING_INFLATION_THEME.test(text)) signal += 0.8;
  if (YIELDS_UP.test(text)) signal -= 0.4;
  if (YIELDS_DOWN.test(text)) signal += 0.4;

  const dir = (input.impactDirection ?? input.sentiment ?? "").toString().toLowerCase();
  const up = dir === "bullish";
  const down = dir === "bearish";
  if (up || down) {
    for (const asset of detectedAssets(input, text)) {
      if (SAFE_HAVENS.has(asset)) signal += up ? -0.8 : 0.8; // haven strength = risk-off
      else if (RISK_ASSETS.has(asset)) signal += up ? 0.8 : -0.8;
    }
  }
  return Math.max(-1.5, Math.min(1.5, signal));
}

const DEADBAND = 0.12;
const STRONG = 0.35;

export function computeRiskRegime(articles: RiskRegimeInput[]): RiskRegimeResult {
  let weighted = 0;
  let totalWeight = 0;
  for (const a of articles) {
    const signal = articleSignal(a);
    if (signal === 0) continue;
    const impact = Math.max(0.2, (a.impactScore ?? 3) / 10);
    const weight = impact * freshnessWeight(a.freshnessTier) * Math.max(0.3, a.matchConfidence ?? 0.5);
    weighted += signal * weight;
    totalWeight += weight;
  }
  const score = totalWeight > 0 ? Math.max(-1, Math.min(1, weighted / totalWeight)) : 0;

  let regime: RiskRegime = "neutrale";
  let intensity: "lieve" | "forte" | null = null;
  if (score <= -DEADBAND) {
    regime = "risk-off";
    intensity = score <= -STRONG ? "forte" : "lieve";
  } else if (score >= DEADBAND) {
    regime = "risk-on";
    intensity = score >= STRONG ? "forte" : "lieve";
  }
  return { regime, intensity, score: Number(score.toFixed(3)) };
}
