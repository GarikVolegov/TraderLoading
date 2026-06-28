import { useEffect } from "react";
import type { Language } from "@/lib/i18n";
import { absoluteUrl, type HreflangAlternate, type JsonLd } from "@/lib/seo";

// Per-language Open Graph locale codes.
const OG_LOCALES: Record<Language, string> = {
  it: "it_IT",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
};

const DEFAULT_OG_IMAGE = absoluteUrl("/opengraph.jpg");

// Marker attribute so we only ever touch tags this component owns — the static
// site-wide tags/JSON-LD in index.html are left untouched.
const OWNED = "data-seo";

export interface SeoProps {
  /** Document title (already localized). */
  title: string;
  /** Meta description (already localized). */
  description: string;
  /** Page language (drives <html lang> and og:locale). */
  lang: Language;
  /** Absolute canonical URL for this page. */
  canonical: string;
  /** Comma-separated keywords (optional). */
  keywords?: string;
  /** Absolute URL of the social share image (defaults to /opengraph.jpg). */
  ogImage?: string;
  /** Open Graph type (defaults to "website"). */
  ogType?: string;
  /** hreflang alternates (5 languages + x-default). */
  alternates?: HreflangAlternate[];
  /** Page-specific JSON-LD blocks (FAQPage, BreadcrumbList, SoftwareApplication…). */
  jsonLd?: JsonLd[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function replaceOwned(selector: string) {
  document.head
    .querySelectorAll(`${selector}[${OWNED}]`)
    .forEach((node) => node.remove());
}

/**
 * Declaratively manages this page's <head>: title, description/keywords,
 * Open Graph + Twitter tags, canonical, hreflang alternates and JSON-LD.
 *
 * Renders nothing. Updates run in an effect so the build-time prerenderer
 * (which waits for the app to settle before snapshotting) captures the final
 * head for every route × language.
 */
export function Seo({
  title,
  description,
  lang,
  canonical,
  keywords,
  ogImage,
  ogType = "website",
  alternates = [],
  jsonLd = [],
}: SeoProps) {
  const image = ogImage ?? DEFAULT_OG_IMAGE;
  const altKey = alternates.map((a) => `${a.hreflang}:${a.href}`).join("|");
  const jsonKey = jsonLd.map((j) => JSON.stringify(j)).join("|");

  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;

    upsertMeta("name", "description", description);
    if (keywords) upsertMeta("name", "keywords", keywords);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:locale", OG_LOCALES[lang]);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:image", image);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    upsertCanonical(canonical);

    // hreflang alternates — replace our own set each render.
    replaceOwned('link[rel="alternate"]');
    for (const alt of alternates) {
      const link = document.createElement("link");
      link.setAttribute("rel", "alternate");
      link.setAttribute("hreflang", alt.hreflang);
      link.setAttribute("href", alt.href);
      link.setAttribute(OWNED, "");
      document.head.appendChild(link);
    }

    // Page-specific JSON-LD — replace our own blocks each render.
    replaceOwned('script[type="application/ld+json"]');
    for (const block of jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute(OWNED, "");
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    }

    return () => {
      replaceOwned('link[rel="alternate"]');
      replaceOwned('script[type="application/ld+json"]');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, lang, canonical, keywords, image, ogType, altKey, jsonKey]);

  return null;
}

export default Seo;
