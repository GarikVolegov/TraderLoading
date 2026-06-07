export interface ArticleUrlInput {
  url?: string | null;
  resolvedUrl?: string | null;
}

export function cleanNewsText(text: string, source?: string | null): string {
  let cleaned = text
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const publisher = source?.trim();
  if (publisher) {
    const escaped = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "i"), "")
      .replace(new RegExp(`\\s{1,}${escaped}$`, "i"), "")
      .trim();
  }
  return cleaned;
}

export function preferredArticleUrl(article: ArticleUrlInput): string | null {
  const resolved = article.resolvedUrl?.trim();
  if (resolved && !resolved.includes("news.google.com/rss/articles")) return resolved;
  return article.url?.trim() || null;
}

export function createTranslationMemo<T>() {
  const cache = new Map<string, T>();
  const key = (lang: string, title: string, summary: string) => `${lang}\n${title}\n${summary}`;
  return {
    get(lang: string, title: string, summary: string): T | null {
      return cache.get(key(lang, title, summary)) ?? null;
    },
    set(lang: string, title: string, summary: string, value: T): void {
      cache.set(key(lang, title, summary), value);
    },
    clear(): void {
      cache.clear();
    },
  };
}
