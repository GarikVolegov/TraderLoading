/**
 * Generate a multilingual sitemap.xml from the single source of truth in
 * src/lib/seo.ts (so it never drifts from the routes/hreflang the app emits).
 *
 * Run via tsx as part of `pnpm build` (after `vite build`). Writes both the
 * committed snapshot (public/sitemap.xml) and the deployed artifact
 * (dist/public/sitemap.xml when a build is present).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGUAGES } from "../src/lib/i18n.ts";
import {
  SEO_PAGE_KEYS,
  absoluteUrl,
  landingAlternates,
  landingPath,
  seoPageAlternates,
  seoPagePath,
  blogIndexPath,
  blogPostPath,
  blogPostAlternates,
  type HreflangAlternate,
} from "../src/lib/seo.ts";
import { fetchPublishedBlogData, type PublishedBlogPost } from "./blogPaths.ts";

const here = dirname(fileURLToPath(import.meta.url));

interface SitemapEntry {
  loc: string;
  changefreq: string;
  priority: string;
  alternates?: HreflangAlternate[];
}

function buildEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Landing, one indexable URL per language, each carrying the full hreflang set.
  for (const lang of SUPPORTED_LANGUAGES) {
    entries.push({
      loc: absoluteUrl(landingPath(lang)),
      changefreq: "weekly",
      priority: "1.0",
      alternates: landingAlternates(),
    });
  }

  // Dedicated keyword/marketing pages, one URL per language.
  for (const page of SEO_PAGE_KEYS) {
    for (const lang of SUPPORTED_LANGUAGES) {
      entries.push({
        loc: absoluteUrl(seoPagePath(page, lang)),
        changefreq: "weekly",
        priority: "0.8",
        alternates: seoPageAlternates(page),
      });
    }
  }

  // Conversion + legal pages (single URL, no language variants).
  entries.push({ loc: absoluteUrl("/sign-up"), changefreq: "monthly", priority: "0.7" });
  entries.push({ loc: absoluteUrl("/privacy"), changefreq: "yearly", priority: "0.2" });
  entries.push({ loc: absoluteUrl("/terms"), changefreq: "yearly", priority: "0.2" });

  return entries;
}

function buildBlogEntries(posts: PublishedBlogPost[]): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    entries.push({ loc: absoluteUrl(blogIndexPath(lang)), changefreq: "weekly", priority: "0.6" });
  }
  for (const post of posts) {
    const langs = post.translations
      .map((t) => t.lang)
      .filter((l) => (SUPPORTED_LANGUAGES as readonly string[]).includes(l)) as typeof SUPPORTED_LANGUAGES[number][];
    const alternates = blogPostAlternates(post.slug, langs);
    for (const lang of langs) {
      entries.push({ loc: absoluteUrl(blogPostPath(post.slug, lang)), changefreq: "monthly", priority: "0.7", alternates });
    }
  }
  return entries;
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const alts = (entry.alternates ?? [])
        .map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`,
        )
        .join("\n");
      return [
        "  <url>",
        `    <loc>${entry.loc}</loc>`,
        alts,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

const blogPosts = await fetchPublishedBlogData();
const xml = renderSitemap([...buildEntries(), ...buildBlogEntries(blogPosts)]);

const targets = [
  resolve(here, "../public/sitemap.xml"),
  resolve(here, "../dist/public/sitemap.xml"),
];

for (const target of targets) {
  const dir = dirname(target);
  // Only write the dist copy if a build exists; always refresh the public snapshot.
  if (target.includes("/dist/") && !existsSync(dir)) continue;
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, xml, "utf8");
  console.log(`sitemap: wrote ${target}`);
}
