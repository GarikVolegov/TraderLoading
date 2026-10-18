import type { NewsArticle } from "./types.js";
import { archiveNewsEvidence, canonicalNewsUrl, evidenceId } from "./eventEvidence.js";
import { cleanNewsText } from "./contentQuality.js";

// Transport messages are candidates, never a second bypass around editorial gates.
const candidates = new Map<string, NewsArticle>();
const revisions = new Map<string, string>();
export function queueProviderArticle(article: NewsArticle, archive = archiveNewsEvidence): boolean {
  const key = canonicalNewsUrl(article.url) ?? `${article.source}:${article.title}`;
  const title = cleanNewsText(article.title, article.source).slice(0, 1000);
  if (!title || title.length < 5) return false;
  const summary = cleanNewsText(article.summary, article.source).slice(0, 900) || title;
  const publication = article.publishedAt && Number.isFinite(Date.parse(article.publishedAt)) ? new Date(article.publishedAt).toISOString() : null;
  const revision = evidenceId(`${title}:${summary}:${publication}`);
  if (revisions.get(key) === revision) return false;
  const candidate: NewsArticle = { ...article, title, summary, url:canonicalNewsUrl(article.url), publishedAt:publication,
    originalTitle:title, originalSummary:summary, sourceType:"publisher", contentBasis:summary === title ? "headline" : "snippet", analysisMethod:"none" };
  revisions.set(key, revision);
  candidates.set(key, candidate);
  // Archive raw provider evidence before freshness/editorial gates; publication
  // omissions stay unknown and cannot masquerade as fresh transport messages.
  void archive([candidate]).then(([identified]) => {
    if (identified && revisions.get(key) === revision) candidates.set(key, identified);
  }).catch(() => { /* The derived feed remains available; archive reports its own status. */ });
  while (candidates.size > 160) candidates.delete(candidates.keys().next().value!);
  for (const known of revisions.keys()) if (!candidates.has(known)) revisions.delete(known);
  return true;
}
export function providerCandidates(now = Date.now()): NewsArticle[] {
  return [...candidates.values()].filter(a=>a.publishedAt && Date.parse(a.publishedAt)<=now && now-Date.parse(a.publishedAt)<48*3_600_000);
}
export function newsSubscriptionKey(request: {pairs?:string;lang?:string}): string {
  const pairs = [...new Set((request.pairs ?? "").split(",").map(p=>p.replace(/\//g,"").trim().toUpperCase()).filter(Boolean))].sort();
  const normalizedLang = (request.lang ?? "it").toLowerCase().slice(0,2);
  const lang = ["it","en","es","fr","de"].includes(normalizedLang) ? normalizedLang : "it";
  return `${pairs.join(",")}:${lang}`;
}
