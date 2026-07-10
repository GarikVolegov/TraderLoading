// Pure SEO helpers — URL/canonical/hreflang/JSON-LD computation.
//
// Kept side-effect-free and DOM-free so they can be unit-tested under the plain
// node + tsx test runner (no jsdom). The <Seo> component (components/Seo.tsx)
// and the build-time sitemap/prerender scripts consume these.
//
// URL scheme (see docs/seo/keyword-strategy.md):
//   - English lives at the root (no prefix) and is the x-default.
//   - Other languages are served under a /{lang} prefix: /it, /es, /fr, /de.
//   - Topic pages are served under the localized slug, prefixed for non-English:
//       en: /trading-journal     it: /it/diario-trading   ...
//   - Authenticated app routes stay unprefixed and are never marketing surfaces.

import { SUPPORTED_LANGUAGES, type Language } from "./i18n";

export const SITE_ORIGIN = "https://traderloading.com";

/** Canonical keys for the dedicated marketing/keyword pages. */
export const SEO_PAGE_KEYS = [
  "trading-journal",
  "backtest",
  "macro-news",
  "risk-tools",
  "pricing",
  "guide",
  "about",
  "contact",
] as const;
export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];

/**
 * Keyword/topic pages used for internal "Explore more" cross-links and the
 * guide hub. Trust pages (about/contact) are intentionally excluded so the
 * related rail stays focused on indexable topic content.
 */
export const SEO_TOPIC_KEYS: readonly SeoPageKey[] = [
  "trading-journal",
  "backtest",
  "macro-news",
  "risk-tools",
  "pricing",
];

/**
 * Localized URL slug for each keyword page, per language. English slugs are
 * chosen to avoid colliding with authenticated app routes (e.g. the app already
 * owns "/backtest", so the English marketing page uses "/backtesting").
 */
export const SEO_SLUGS: Record<SeoPageKey, Record<Language, string>> = {
  "trading-journal": {
    en: "trading-journal",
    it: "diario-trading",
    es: "diario-de-trading",
    fr: "journal-de-trading",
    de: "trading-tagebuch",
  },
  backtest: {
    en: "backtesting",
    it: "backtest",
    es: "backtesting",
    fr: "backtest",
    de: "backtesting",
  },
  "macro-news": {
    en: "macro-news",
    it: "notizie-macro",
    es: "noticias-macro",
    fr: "actualites-macro",
    de: "makro-news",
  },
  "risk-tools": {
    en: "risk-management",
    it: "gestione-rischio",
    es: "gestion-riesgo",
    fr: "gestion-risque",
    de: "risikomanagement",
  },
  pricing: {
    en: "pricing",
    it: "prezzi",
    es: "precios",
    fr: "tarifs",
    de: "preise",
  },
  guide: {
    en: "guide",
    it: "guida",
    es: "guia",
    fr: "guide",
    de: "anleitung",
  },
  about: {
    en: "about",
    it: "chi-siamo",
    es: "sobre-nosotros",
    fr: "a-propos",
    de: "ueber-uns",
  },
  contact: {
    en: "contact",
    it: "contatti",
    es: "contacto",
    fr: "contact",
    de: "kontakt",
  },
};

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

const LANG_ORDER = SUPPORTED_LANGUAGES;

/** Strip an optional router base prefix from a pathname. */
function stripBase(pathname: string, base: string): string {
  if (base && base !== "/" && pathname.startsWith(base)) {
    return pathname.slice(base.length) || "/";
  }
  return pathname;
}

/**
 * Resolve the marketing language encoded in a URL path. Returns the language for
 * a `/{lang}` prefix (it/es/fr/de — and "en" if explicitly present), or null
 * when the path has no language prefix (English root, app routes, etc.).
 */
export function getLanguageFromPath(
  pathname: string,
  base = "",
): Language | null {
  const first = stripBase(pathname, base)
    .replace(/^\/+/, "")
    .split("/")[0]
    ?.toLowerCase();
  if (!first) return null;
  return (LANG_ORDER as readonly string[]).includes(first)
    ? (first as Language)
    : null;
}

/** URL path for the landing page in a given language. */
export function landingPath(lang: Language): string {
  return lang === "en" ? "/" : `/${lang}`;
}

/** URL path for a keyword page in a given language. */
export function seoPagePath(page: SeoPageKey, lang: Language): string {
  const slug = SEO_SLUGS[page][lang];
  return lang === "en" ? `/${slug}` : `/${lang}/${slug}`;
}

/** Resolve a keyword page from a (language, slug) pair, or null if unknown. */
export function seoPageFromSlug(
  lang: Language,
  slug: string | undefined,
): SeoPageKey | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  for (const page of SEO_PAGE_KEYS) {
    if (SEO_SLUGS[page][lang] === normalized) return page;
  }
  return null;
}

/**
 * Localize a footer/nav href for the active language: an English keyword-page
 * path (e.g. "/trading-journal") becomes that language's URL ("/it/diario-trading"),
 * while non-keyword paths (/, /sign-up, /privacy, …) are returned unchanged.
 * Keeps the language system consistent when navigating from a localized landing.
 */
export function localizedHref(href: string, lang: Language): string {
  const slug = href.replace(/^\//, "").replace(/\/$/, "");
  const page = seoPageFromSlug("en", slug);
  return page ? seoPagePath(page, lang) : href;
}

/** Absolute https URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_ORIGIN}/`;
  return SITE_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

/** hreflang alternates (all languages + x-default → English) for the landing. */
export function landingAlternates(): HreflangAlternate[] {
  const alts: HreflangAlternate[] = LANG_ORDER.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(landingPath(lang)),
  }));
  alts.push({ hreflang: "x-default", href: absoluteUrl(landingPath("en")) });
  return alts;
}

/** hreflang alternates (all languages + x-default → English) for a keyword page. */
export function seoPageAlternates(page: SeoPageKey): HreflangAlternate[] {
  const alts: HreflangAlternate[] = LANG_ORDER.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(seoPagePath(page, lang)),
  }));
  alts.push({ hreflang: "x-default", href: absoluteUrl(seoPagePath(page, "en")) });
  return alts;
}

/** URL path for the blog index in a given language. */
export function blogIndexPath(lang: Language): string {
  return lang === "en" ? "/blog" : `/${lang}/blog`;
}

/** URL path for a blog article in a given language (same slug across languages). */
export function blogPostPath(slug: string, lang: Language): string {
  return lang === "en" ? `/blog/${slug}` : `/${lang}/blog/${slug}`;
}

/** hreflang alternates (all 5 languages + x-default) for the blog index. */
export function blogIndexAlternates(): HreflangAlternate[] {
  const alts: HreflangAlternate[] = LANG_ORDER.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(blogIndexPath(lang)),
  }));
  alts.push({ hreflang: "x-default", href: absoluteUrl(blogIndexPath("en")) });
  return alts;
}

/**
 * hreflang alternates for a blog post — only for the languages that actually
 * have a published translation (unlike the static keyword pages, a post may
 * not exist in all 5 languages). x-default points at English only if an
 * English translation exists.
 */
export function blogPostAlternates(slug: string, langs: Language[]): HreflangAlternate[] {
  const alts: HreflangAlternate[] = langs.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(blogPostPath(slug, lang)),
  }));
  if (langs.includes("en")) {
    alts.push({ hreflang: "x-default", href: absoluteUrl(blogPostPath(slug, "en")) });
  }
  return alts;
}

/** Every public marketing URL (landing + keyword pages) across all languages. */
export function allMarketingPaths(): string[] {
  const paths = LANG_ORDER.map((lang) => landingPath(lang));
  for (const page of SEO_PAGE_KEYS) {
    for (const lang of LANG_ORDER) {
      paths.push(seoPagePath(page, lang));
    }
  }
  return paths;
}

// ── JSON-LD builders ────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

/** schema.org BreadcrumbList for a keyword page (Home → Page). */
export function breadcrumbJsonLd(
  homeName: string,
  pageName: string,
  page: SeoPageKey,
  lang: Language,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeName,
        item: absoluteUrl(landingPath(lang)),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: pageName,
        item: absoluteUrl(seoPagePath(page, lang)),
      },
    ],
  };
}

/** schema.org FAQPage from question/answer pairs. */
export function faqJsonLd(
  lang: Language,
  qa: ReadonlyArray<{ question: string; answer: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: qa.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** Free + Pro offers shared across SoftwareApplication / Product schema. */
const TRADERLOADING_OFFERS = [
  { "@type": "Offer", price: "0", priceCurrency: "EUR", name: "Free" },
  { "@type": "Offer", price: "7", priceCurrency: "EUR", name: "Pro" },
];

/** schema.org SoftwareApplication for a topic page. */
export function softwareAppJsonLd(
  name: string,
  description: string,
  url: string,
  lang: Language,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    inLanguage: lang,
    offers: TRADERLOADING_OFFERS,
    publisher: { "@type": "Organization", name: "TraderLoading", url: `${SITE_ORIGIN}/` },
  };
}

/** schema.org Product (with Free + Pro offers) for the pricing page. */
export function pricingProductJsonLd(
  name: string,
  description: string,
  url: string,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    brand: { "@type": "Brand", name: "TraderLoading" },
    offers: TRADERLOADING_OFFERS,
  };
}

/** schema.org BlogPosting for a blog article. */
export function articleJsonLd(title: string, description: string, url: string, lang: Language): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    url,
    inLanguage: lang,
    publisher: { "@type": "Organization", name: "TraderLoading", url: `${SITE_ORIGIN}/` },
  };
}
