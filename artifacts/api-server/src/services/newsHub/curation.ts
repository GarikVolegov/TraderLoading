import type { NewsArticle } from "./types.js";

const DEFAULT_MIN_SCORE = 8;
const DEFAULT_LIMIT = 5;

const MACRO_DRIVER_RE =
  /\b(fed|fomc|powell|ecb|lagarde|boe|boj|snb|boc|rba|rbnz|central\s+bank|rate\s+(decision|hike|cut|change)|interest\s+rates?|minutes|speaker|cpi|pce|ppi|inflation|non.?farm|nfp|payrolls?|jobs?\s+report|unemployment|gdp|pmi|retail\s+sales|treasury\s+yields?|bond\s+yields?|forecast|expectations?|priced|prices?\s+in)\b/i;

const CONCRETE_EVENT_RE =
  /\b(decision|surprise|unexpected|shock|breakout|data|release|report|minutes|speech|warns?|announces?|conflict|war|sanction|tariff|policy|geopolit|volatility)\b/i;

const GENERIC_NOISE_RE =
  /\b(market\s+update|price\s+update|price\s+forecast|what\s+to\s+watch|traders?\s+wait|mixed\s+markets?|live\s+updates?|recap|moves?\s+sideways|quiet\s+trade|holds?\s+steady)\b/i;

const TRUSTED_SOURCE_RE =
  /\b(reuters|bloomberg|associated\s+press|ap|cnbc|marketwatch|wall\s+street\s+journal|wsj|financial\s+times|ft|investing\.com|forexlive|fxstreet|dailyfx|federal\s+reserve|ecb|bank\s+of\s+england|bank\s+of\s+japan|bureau\s+of\s+labor\s+statistics|bls|bea)\b/i;

export interface NewsCurationOptions {
  pairs?: string;
  limit?: number;
  minScore?: number;
  /**
   * Guarantee at least this many articles when enough non-stale candidates
   * exist: if fewer than `minKeep` pass `minScore`, the threshold is relaxed
   * step by step and the next strongest articles backfill the feed. This keeps
   * the feed alive on quiet news days without letting weak items outrank
   * strong ones.
   */
  minKeep?: number;
  /**
   * Final ordering of the curated set. `score` (default) keeps the strongest
   * article first (ticker use). `chronological` re-sorts the curated picks
   * newest-first so the feed reads as a timeline of the most important news.
   */
  sort?: "score" | "chronological";
}

export interface NewsCurationScore {
  score: number;
  reasons: string[];
  penalties: string[];
  topicKey: string;
}

function articleText(article: NewsArticle): string {
  return [
    article.title,
    article.summary,
    article.originalTitle,
    article.originalSummary,
    article.impactReason,
    article.relevanceReason,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizePair(pair: string): string {
  const clean = pair.trim().toUpperCase().replace("/", "");
  return clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : pair.trim().toUpperCase();
}

function requestedPairs(options: NewsCurationOptions): string[] {
  return (options.pairs ?? "")
    .split(",")
    .map(normalizePair)
    .filter(Boolean);
}

function hasSelectedPair(article: NewsArticle, options: NewsCurationOptions): boolean {
  const selected = requestedPairs(options);
  if (selected.length === 0) return false;
  const affected = new Set((article.affectedPairs ?? []).map(normalizePair));
  return selected.some((pair) => affected.has(pair));
}

function hasUsableAttribution(article: NewsArticle): boolean {
  return Boolean(
    article.verified ||
      article.url ||
      article.resolvedUrl ||
      article.sourceUrl ||
      (article.citationUrls?.length ?? 0) > 0 ||
      (article.sources?.length ?? 0) > 0,
  );
}

function isTrustedSource(article: NewsArticle): boolean {
  return TRUSTED_SOURCE_RE.test([article.source, ...(article.sources ?? [])].join(" "));
}

function topicKey(article: NewsArticle): string {
  return article.title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(" ");
}

function publishedTime(article: NewsArticle): number {
  return article.publishedAt ? new Date(article.publishedAt).getTime() || 0 : 0;
}

export function scoreCuratedNewsArticle(
  article: NewsArticle,
  options: NewsCurationOptions = {},
): NewsCurationScore {
  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];
  const impactScore = article.impactScore ?? 0;
  const matchConfidence = article.matchConfidence;
  const text = articleText(article);
  const selectedPair = hasSelectedPair(article, options);
  const hasMacroDriver = MACRO_DRIVER_RE.test(text);
  const hasConcreteEvent = CONCRETE_EVENT_RE.test(text);

  if (impactScore >= 9) {
    score += 5;
    reasons.push("impact-score-9");
  } else if (impactScore >= 8) {
    score += 4;
    reasons.push("impact-score-8");
  } else if (impactScore >= 6) {
    score += 2;
    reasons.push("impact-score-6");
  }

  if (typeof matchConfidence === "number" && matchConfidence >= 0.8) {
    score += 3;
    reasons.push("match-confidence-0.8");
  } else if (typeof matchConfidence === "number" && matchConfidence >= 0.6) {
    score += 2;
    reasons.push("match-confidence-0.6");
  }

  if (selectedPair) {
    score += 4;
    reasons.push("selected-pair");
  }

  if (hasMacroDriver) {
    score += 3;
    reasons.push("macro-driver");
  }

  if (article.freshnessTier === "live") {
    score += 2;
    reasons.push("live");
  } else if (article.freshnessTier === "fresh") {
    score += 1;
    reasons.push("fresh");
  }

  if (hasUsableAttribution(article)) {
    score += 1;
    reasons.push("attributed");
  }

  if (isTrustedSource(article)) {
    score += 1;
    reasons.push("trusted-source");
  }

  if (hasConcreteEvent) {
    score += 2;
    reasons.push("concrete-event");
  }

  if (impactScore < 5) {
    score -= 4;
    penalties.push("low-impact");
  }

  if (typeof matchConfidence !== "number") {
    score -= 2;
    penalties.push("missing-confidence");
  }

  if (article.freshnessTier === "fallback" || article.isFallback) {
    score -= 3;
    penalties.push("fallback");
  }

  if (article.freshnessTier === "stale") {
    score -= 5;
    penalties.push("stale");
  }

  if (GENERIC_NOISE_RE.test(text)) {
    score -= 4;
    penalties.push("generic-noise");
  }

  if (!selectedPair && !hasMacroDriver) {
    score -= 5;
    penalties.push("no-selected-pair-or-macro-driver");
  }

  if (!hasUsableAttribution(article)) {
    score -= 2;
    penalties.push("weak-attribution");
  }

  return { score, reasons, penalties, topicKey: topicKey(article) };
}

export function selectCuratedNews(
  articles: NewsArticle[],
  options: NewsCurationOptions = {},
): NewsArticle[] {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minKeep = Math.min(options.minKeep ?? 0, limit);
  const strongestByTopic = new Map<string, { article: NewsArticle; curation: NewsCurationScore }>();

  for (const article of articles) {
    if (article.freshnessTier === "fallback" || article.freshnessTier === "stale" || article.isFallback) {
      continue;
    }

    const curation = scoreCuratedNewsArticle(article, options);

    const existing = strongestByTopic.get(curation.topicKey);
    if (
      !existing ||
      curation.score > existing.curation.score ||
      (curation.score === existing.curation.score && publishedTime(article) > publishedTime(existing.article))
    ) {
      strongestByTopic.set(curation.topicKey, { article, curation });
    }
  }

  const byScore = Array.from(strongestByTopic.values()).sort((a, b) => {
    if (b.curation.score !== a.curation.score) return b.curation.score - a.curation.score;
    return publishedTime(b.article) - publishedTime(a.article);
  });

  const curated = byScore.filter((entry) => entry.curation.score >= minScore);
  if (curated.length < minKeep) {
    for (const entry of byScore) {
      if (curated.length >= minKeep) break;
      if (entry.curation.score >= minScore) continue;
      curated.push(entry);
    }
    // Backfill preserves strongest-first order because `byScore` is sorted.
  }

  const selected = curated.slice(0, limit).map((entry) => entry.article);
  if (options.sort === "chronological") {
    return selected.sort((a, b) => publishedTime(b) - publishedTime(a));
  }
  return selected;
}
