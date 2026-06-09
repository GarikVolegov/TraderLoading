import type { NewsArticle } from "./types.js";

const DEFAULT_MIN_SCORE = 8;
const DEFAULT_LIMIT = 5;

// English + Italian stems: the pipeline runs curation on translated text, with
// the original English kept in originalTitle/originalSummary (not always set).
const MACRO_DRIVER_RE =
  /\b(fed|fomc|powell|ecb|lagarde|boe|boj|snb|boc|rba|rbnz|central\s+bank|banca\s+centrale|rate\s+(decision|hike|cut|change)|interest\s+rates?|tass[oi]|minutes|verbali|speaker|cpi|pce|ppi|inflation|inflazione|non.?farm|nfp|payrolls?|jobs?\s+report|unemployment|disoccupazione|occupazione|gdp|\bpil\b|pmi|retail\s+sales|vendite\s+al\s+dettaglio|treasury\s+yields?|bond\s+yields?|rendimenti\b|forecast|expectations?|aspettativ\w*|priced|prices?\s+in)\b/i;

const CONCRETE_EVENT_RE =
  /\b(decision|decisione|surprise|sorpres\w*|unexpected|inattes\w*|shock|breakout|data|dat[oi]|release|report|minutes|verbali|speech|discorso|warns?|avvert\w*|announces?|annunci\w*|conflict|conflitt\w*|war|guerra|sanction|sanzion\w*|tariff|daz[io]|policy|geopolit|volatility|volatilit\w*)\b/i;

const GENERIC_NOISE_RE =
  /\b(market\s+update|price\s+update|price\s+forecast|what\s+to\s+watch|traders?\s+wait|mixed\s+markets?|live\s+updates?|recap|riepilogo|moves?\s+sideways|laterale|quiet\s+trade|holds?\s+steady|si\s+mantiene\s+stabile|aggiornamento\s+(di\s+)?mercato|in\s+attesa\s+di\s+(una\s+)?direzione|cosa\s+(guardare|aspettarsi)|mercati\s+misti)\b/i;

// Hard exclusions: price-forecast listicles, technical-analysis boilerplate and
// evergreen explainers are never trading news, regardless of how the rest of
// the article scores. Checked on titles only to avoid body-text false positives.
const HARD_NOISE_TITLE_RE =
  /price\s+(forecast|prediction)s?|previsioni?\s+(per\s+il|del|sul)\s+prezzo|forecast\s+for\s+(today|tomorrow|this\s+week)|per\s+oggi,?\s*domani|technical\s+analysis|analisi\s+tecnica|top\s+\d+\s|how\s+to\s+trade|come\s+fare\s+trading|spiegazion\w*|explained|explainer|beginner'?s?\s+guide|guida\s+(a|al|per)\b|guide\s+to\b|come\s+viene\s+fissat|how\s+.{0,24}\bis\s+(set|priced|determined)|cos'?è\b|what\s+is\b|è\s+(ora|il\s+momento)\s+di\s+(acquistare|comprare|vendere)|time\s+to\s+(buy|sell)|should\s+you\s+(buy|sell)|livello\s+(critico|chiave)|key\s+(level|buy|sell)|critical\s+level|buy\s+zones?|zone\s+(chiave|di\s+acquisto)|price\s+analysis|analisi\s+del\s+prezzo|analyst\s+(spots|reveals|pinpoints|names)|^(perch[eé]|why)(?=[\s,:'’])[^?]*\?\s*$/i;

// Single-stock / corporate housekeeping content (dividends, earnings, mining
// exploration deals): it names the asset but does not move the macro pair.
const CORPORATE_NOISE_RE =
  /\b(dividend\w*|earnings|\beps\b|\broe\b|buyback|ipo|azioni|shares?\s+of|stock\s+(price|rating)|titoli\s+(aurifer\w+|minerar\w+)|miners?|mining\s+(stock|company|deal)|corporation|resources\s+(ltd|limited|inc)\.?|esplorazione|exploration|drilling|acquisition|acquisizione|compravendita|merger|fusione\s+societaria|quarterly\s+results|risultati\s+trimestrali)\b/i;

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

export function isHardNoiseNews(article: NewsArticle): boolean {
  // Titles are tested one by one (not concatenated) so anchored patterns like
  // the question-headline rule work on each title independently.
  if (HARD_NOISE_TITLE_RE.test(article.title)) return true;
  return Boolean(article.originalTitle && HARD_NOISE_TITLE_RE.test(article.originalTitle));
}

// Tokens used for near-duplicate detection across outlets (same story, slightly
// different headline). Translated and original titles are compared separately:
// mixing them dilutes similarity because outlets word the same event
// differently in English while the translation converges.
interface TitleTokenSets {
  translated: Set<string>;
  original: Set<string>;
}

function tokenSet(title: string | undefined): Set<string> {
  if (!title) return new Set();
  const text = title
    .replace(/\s+-\s+[^-]{2,60}$/, "") // drop the "- Publisher" suffix
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  return new Set(text.split(/\s+/).filter((word) => word.length > 3));
}

function titleTokens(article: NewsArticle): TitleTokenSets {
  const translated = tokenSet(article.title);
  const original = tokenSet(article.originalTitle);
  return { translated, original: original.size > 0 ? original : translated };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  const union = a.size + b.size - shared;
  return union > 0 ? shared / union : 0;
}

function isNearDuplicate(a: TitleTokenSets, b: TitleTokenSets): boolean {
  return jaccard(a.translated, b.translated) >= 0.6 || jaccard(a.original, b.original) >= 0.6;
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
  } else if (matchConfidence < 0.45) {
    // The classifier flags weak matches (e.g. corporate stories that merely
    // name the asset) with low confidence: keep them out of the curated feed.
    score -= 3;
    penalties.push("low-confidence");
  }

  if (CORPORATE_NOISE_RE.test(text)) {
    score -= 5;
    penalties.push("corporate-noise");
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

interface ScoredEntry {
  article: NewsArticle;
  curation: NewsCurationScore;
}

function strongestPerTopic(articles: NewsArticle[], options: NewsCurationOptions): ScoredEntry[] {
  const strongestByTopic = new Map<string, ScoredEntry>();
  for (const article of articles) {
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
  return Array.from(strongestByTopic.values()).sort((a, b) => {
    if (b.curation.score !== a.curation.score) return b.curation.score - a.curation.score;
    return publishedTime(b.article) - publishedTime(a.article);
  });
}

// Strongest-first scan that drops near-duplicate stories (same event covered by
// multiple outlets) keeping only the highest-scoring version.
function dropNearDuplicates(entries: ScoredEntry[]): ScoredEntry[] {
  const kept: Array<{ entry: ScoredEntry; tokens: TitleTokenSets }> = [];
  for (const entry of entries) {
    const tokens = titleTokens(entry.article);
    if (kept.some((other) => isNearDuplicate(tokens, other.tokens))) continue;
    kept.push({ entry, tokens });
  }
  return kept.map((item) => item.entry);
}

export function selectCuratedNews(
  articles: NewsArticle[],
  options: NewsCurationOptions = {},
): NewsArticle[] {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minKeep = Math.min(options.minKeep ?? 0, limit);

  const usable = articles.filter((article) => !isHardNoiseNews(article) && article.freshnessTier !== "stale");
  const fresh = usable.filter((article) => article.freshnessTier !== "fallback" && !article.isFallback);
  const fallbackTier = usable.filter((article) => article.freshnessTier === "fallback" || article.isFallback);

  const byScore = dropNearDuplicates(strongestPerTopic(fresh, options));

  const curated = byScore.filter((entry) => entry.curation.score >= minScore);
  if (curated.length < minKeep) {
    // Backfill preserves strongest-first order because `byScore` is sorted.
    for (const entry of byScore) {
      if (curated.length >= minKeep) break;
      if (entry.curation.score >= minScore) continue;
      curated.push(entry);
    }
  }

  // Last resort for quiet news days (e.g. weekends, where everything ages past
  // the freshness window): fill up to the floor with the strongest fallback-tier
  // articles instead of returning an empty feed. Stale items stay excluded.
  if (curated.length < minKeep && fallbackTier.length > 0) {
    const fallbackByScore = dropNearDuplicates(strongestPerTopic(fallbackTier, options));
    for (const entry of fallbackByScore) {
      if (curated.length >= minKeep) break;
      curated.push(entry);
    }
  }

  const selected = curated.slice(0, limit).map((entry) => entry.article);
  if (options.sort === "chronological") {
    return selected.sort((a, b) => publishedTime(b) - publishedTime(a));
  }
  return selected;
}
