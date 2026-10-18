import type { Article } from "./newsApi";

export function newsArticleReference(article: Article): string {
  return article.eventId || article.articleId || article.sourceDocumentId || article.resolvedUrl || article.url || article.sourceUrl || `title:${article.originalTitle || article.title}`;
}

export function newsArticleMatchesReference(article: Article, reference: string | null): boolean {
  return Boolean(reference && [article.eventId, article.articleId, article.sourceDocumentId, article.resolvedUrl, article.url, article.sourceUrl, `title:${article.originalTitle || article.title}`].includes(reference));
}

export function newsRelevantToPair(article: Article, pair: string | null): boolean {
  return !pair || Boolean(article.effects?.some(effect => effect.pair === pair) || article.affectedPairs?.includes(pair));
}

export function sourceHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

export function selectNewsBrief(articles: readonly Article[]): Article[] {
  const references = new Set<string>();
  return [...articles].sort((a, b) => (b.curationScore ?? 0) - (a.curationScore ?? 0) || (b.impactScore ?? 0) - (a.impactScore ?? 0)).filter(article => {
    const ref = newsArticleReference(article);
    if (references.has(ref) || article.isFallback || (article.freshnessTier === "stale" || article.freshnessTier === "fallback") || (article.curationScore ?? 0) < 8 || ![article.resolvedUrl, article.url, article.sourceUrl].some(url => { try { return Boolean(url && ["https:", "http:"].includes(new URL(url).protocol)); } catch { return false; } })) return false;
    references.add(ref);
    return true;
  }).slice(0, 5);
}
