import type { NewsArticle } from "./types.js";

// ─── Per-user feed personalization ────────────────────────────────────────────
// A re-ranking layer applied on top of the shared corpus, driven by the user's
// keywords, free-text profile, and 👍/👎 feedback. Pure & deterministic so
// pagination stays consistent across requests.

export interface NewsPreferences {
  keywords: string[];
  profile: string;
}

export interface NewsFeedbackEntry {
  articleKey: string;
  source: string;
  vote: number; // 1 (up) or -1 (down)
}

export function articleKey(article: Pick<NewsArticle, "url" | "title">): string {
  return article.url ? `url:${article.url}` : `title:${article.title.toLowerCase().slice(0, 160)}`;
}

const STOPWORDS = new Set([
  "sono", "della", "delle", "degli", "come", "solo", "molto", "anche", "sulla", "dello",
  "trader", "trading", "news", "feed", "info", "voglio", "vorrei", "dammi",
  "per", "con", "del", "che", "non", "una", "uno", "gli", "dei", "sul", "dal", "sui", "col", "alla", "allo",
  "the", "and", "for", "with", "that", "this", "from", "only", "very", "into", "about", "give", "want",
  "are", "was", "has", "you", "not", "but", "all", "any", "out",
]);

// Pull meaningful focus tokens out of a free-text profile/strategy description.
// 3+ letters so short macro terms (oro, fed, cpi, usd, nfp, ecb) are kept.
export function extractProfileKeywords(profile: string): string[] {
  if (!profile) return [];
  const tokens = profile.toLowerCase().match(/[\p{L}]{3,}/gu) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

const KW_BOOST = 6;     // per matched keyword (capped)
const KW_MAX_MATCHES = 4;
const SRC_BOOST = 4;    // per net source vote (clamped)
const ART_BOOST = 16;   // direct vote on the exact article

export function personalizeArticles(
  articles: NewsArticle[],
  prefs: NewsPreferences,
  feedback: NewsFeedbackEntry[],
): NewsArticle[] {
  const keywords = [
    ...prefs.keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length >= 2),
    ...extractProfileKeywords(prefs.profile),
  ];
  if (keywords.length === 0 && feedback.length === 0) return articles;

  const sourceVote = new Map<string, number>();
  const articleVote = new Map<string, number>();
  for (const f of feedback) {
    if (f.source) sourceVote.set(f.source, (sourceVote.get(f.source) ?? 0) + f.vote);
    articleVote.set(f.articleKey, f.vote);
  }

  const total = articles.length;
  return articles
    .map((article, i) => {
      const text = `${article.title} ${article.summary}`.toLowerCase();
      let matched = 0;
      for (const kw of keywords) if (text.includes(kw)) matched++;
      let boost = Math.min(matched, KW_MAX_MATCHES) * KW_BOOST;
      boost += Math.max(-3, Math.min(3, sourceVote.get(article.source) ?? 0)) * SRC_BOOST;
      boost += (articleVote.get(articleKey(article)) ?? 0) * ART_BOOST;
      return { article, score: (total - i) + boost, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.article);
}
