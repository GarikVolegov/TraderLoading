const SUPPORTED_BLOG_LANGS = new Set(["en", "it", "es", "fr", "de"]);
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface TranslationLike {
  lang: string;
  published: boolean;
}

/** Which translation, if any, a given (lang, isAdmin) request may see. */
export function resolvePublishedTranslation<T extends TranslationLike>(
  translations: T[],
  lang: string,
  isAdmin: boolean,
): T | null {
  const match = translations.find((t) => t.lang === lang);
  if (!match) return null;
  if (!isAdmin && !match.published) return null;
  return match;
}

export interface BlogPostTranslationResult {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  published: boolean;
}

export interface BlogPostUpsertInput {
  slug?: unknown;
  relatedLibraryContentId?: unknown;
  orderIndex?: unknown;
  translations?: unknown;
}

export interface BlogPostUpsertResult {
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: BlogPostTranslationResult[];
}

/** Validates + shapes an admin create/update payload. Throws on invalid input. */
export function buildBlogPostUpsert(input: BlogPostUpsertInput): BlogPostUpsertResult {
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('slug must be lowercase kebab-case, e.g. "risk-management-basics"');
  }

  const relatedLibraryContentId =
    typeof input.relatedLibraryContentId === "number" ? input.relatedLibraryContentId : null;
  const orderIndex = typeof input.orderIndex === "number" ? input.orderIndex : 0;

  const rawTranslations = Array.isArray(input.translations) ? input.translations : [];
  const translations: BlogPostTranslationResult[] = [];
  for (const raw of rawTranslations) {
    if (typeof raw !== "object" || raw === null) continue;
    const t = raw as Record<string, unknown>;
    const lang = typeof t.lang === "string" ? t.lang : "";
    if (!SUPPORTED_BLOG_LANGS.has(lang)) continue;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) throw new Error(`translation "${lang}" is missing a title`);
    translations.push({
      lang,
      title,
      metaDescription: typeof t.metaDescription === "string" ? t.metaDescription : "",
      bodyMarkdown: typeof t.bodyMarkdown === "string" ? t.bodyMarkdown : "",
      published: Boolean(t.published),
    });
  }

  return { slug, relatedLibraryContentId, orderIndex, translations };
}
