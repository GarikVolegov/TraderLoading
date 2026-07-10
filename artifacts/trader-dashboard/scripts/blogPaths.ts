/**
 * Shared blog data-access for the build-time scripts (build-sitemap.ts,
 * prerender.ts). Fetching is isolated here (and gracefully degrades to an
 * empty list without DATABASE_URL) so both scripts can stay simple; the path
 * and mock-response logic below is pure and unit-tested without needing a DB.
 */
import { SUPPORTED_LANGUAGES, type Language } from "../src/lib/i18n.ts";
import { blogIndexPath, blogPostPath } from "../src/lib/seo.ts";

export interface PublishedBlogTranslation {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
}

export interface PublishedBlogPost {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: PublishedBlogTranslation[];
}

/** Fetches every post that has at least one published translation, straight from Postgres. */
export async function fetchPublishedBlogData(): Promise<PublishedBlogPost[]> {
  if (!process.env.DATABASE_URL) {
    console.warn("blogPaths: DATABASE_URL not set, skipping blog paths/content");
    return [];
  }
  try {
    const { db, blogPostsTable, blogPostTranslationsTable } = await import("@workspace/db");
    const { eq, asc } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: blogPostsTable.id,
        slug: blogPostsTable.slug,
        relatedLibraryContentId: blogPostsTable.relatedLibraryContentId,
        orderIndex: blogPostsTable.orderIndex,
        lang: blogPostTranslationsTable.lang,
        title: blogPostTranslationsTable.title,
        metaDescription: blogPostTranslationsTable.metaDescription,
        bodyMarkdown: blogPostTranslationsTable.bodyMarkdown,
      })
      .from(blogPostsTable)
      .innerJoin(blogPostTranslationsTable, eq(blogPostTranslationsTable.postId, blogPostsTable.id))
      .where(eq(blogPostTranslationsTable.published, true))
      .orderBy(asc(blogPostsTable.orderIndex));

    const byId = new Map<number, PublishedBlogPost>();
    for (const row of rows) {
      if (!byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          slug: row.slug,
          relatedLibraryContentId: row.relatedLibraryContentId,
          orderIndex: row.orderIndex,
          translations: [],
        });
      }
      byId.get(row.id)!.translations.push({
        lang: row.lang,
        title: row.title,
        metaDescription: row.metaDescription,
        bodyMarkdown: row.bodyMarkdown,
      });
    }
    return [...byId.values()];
  } catch (err) {
    console.warn(`blogPaths: failed to fetch blog data — ${(err as Error).message}`);
    return [];
  }
}

/** Every public blog URL: the 5 language index pages + one per published translation. */
export function allBlogPaths(posts: PublishedBlogPost[]): string[] {
  const paths: string[] = SUPPORTED_LANGUAGES.map((lang) => blogIndexPath(lang));
  for (const post of posts) {
    for (const t of post.translations) {
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(t.lang)) {
        paths.push(blogPostPath(post.slug, t.lang as Language));
      }
    }
  }
  return paths;
}

/**
 * Answers a `/api/blog/*` GET request from already-fetched data, matching
 * routes/blog.ts's response shape exactly. Returns null for anything else
 * (the caller falls through to normal static file serving).
 */
export function respondToBlogApiRequest(
  posts: PublishedBlogPost[],
  method: string,
  pathname: string,
  lang: string,
): { status: number; body: unknown } | null {
  if (method !== "GET") return null;

  if (pathname === "/api/blog/posts") {
    const body = posts
      .filter((p) => p.translations.some((t) => t.lang === lang))
      .map((p) => {
        const t = p.translations.find((tr) => tr.lang === lang)!;
        return {
          id: p.id,
          slug: p.slug,
          relatedLibraryContentId: p.relatedLibraryContentId,
          orderIndex: p.orderIndex,
          title: t.title,
          metaDescription: t.metaDescription,
        };
      });
    return { status: 200, body };
  }

  const itemMatch = pathname.match(/^\/api\/blog\/posts\/([^/]+)$/);
  if (itemMatch) {
    const post = posts.find((p) => p.slug === itemMatch[1]);
    const translation = post?.translations.find((t) => t.lang === lang);
    if (!post || !translation) return { status: 404, body: { error: "Articolo non trovato" } };
    return {
      status: 200,
      body: {
        id: post.id,
        slug: post.slug,
        relatedLibraryContentId: post.relatedLibraryContentId,
        title: translation.title,
        metaDescription: translation.metaDescription,
        bodyMarkdown: translation.bodyMarkdown,
        lang: translation.lang,
      },
    };
  }

  return null;
}
