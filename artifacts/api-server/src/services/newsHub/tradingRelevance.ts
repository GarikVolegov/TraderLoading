import type { NewsArticle } from "./types.js";

const HIGH_IMPACT_SCORE = 8;
const MEDIUM_IMPACT_SCORE = 5;

const CALENDAR_DECISION_DRIVER_RE =
  /\b(fed|fomc|powell|ecb|lagarde|boe|boj|snb|boc|rba|rbnz|central\s+bank|rate\s+(decision|hike|cut|change)|interest\s+rates?|minutes|speaker|cpi|pce|ppi|inflation|non.?farm|nfp|payrolls?|jobs?\s+report|unemployment|gdp|pmi|retail\s+sales|treasury\s+yields?|bond\s+yields?|forecast|expectations?|priced|prices?\s+in)\b/i;

function articleDecisionText(article: NewsArticle): string {
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

export function isCalendarDecisionDriverNews(article: NewsArticle): boolean {
  return CALENDAR_DECISION_DRIVER_RE.test(articleDecisionText(article));
}

export function isTradingDecisionRelevantNews(article: NewsArticle): boolean {
  const score = article.impactScore ?? 0;
  if (score >= HIGH_IMPACT_SCORE) return true;
  return score >= MEDIUM_IMPACT_SCORE && isCalendarDecisionDriverNews(article);
}

export function filterTradingDecisionRelevantNews(articles: NewsArticle[]): NewsArticle[] {
  return articles.filter(isTradingDecisionRelevantNews);
}
