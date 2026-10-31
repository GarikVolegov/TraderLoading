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

export const SITE_ORIGIN = "https://aureus-os.app";

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
  "tradezella-alternative",
  "edgewonk-alternative",
  "tradersync-alternative",
  "fxreplay-alternative",
  "tradingview-alternative",
  "tradezella-vs-edgewonk",
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
  "tradezella-alternative",
  "edgewonk-alternative",
  "tradersync-alternative",
  "fxreplay-alternative",
  "tradingview-alternative",
  "tradezella-vs-edgewonk",
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
  "tradezella-alternative": {
    en: "tradezella-alternative",
    it: "alternativa-tradezella",
    es: "alternativa-tradezella",
    fr: "alternative-tradezella",
    de: "tradezella-alternative",
  },
  "edgewonk-alternative": {
    en: "edgewonk-alternative",
    it: "alternativa-edgewonk",
    es: "alternativa-edgewonk",
    fr: "alternative-edgewonk",
    de: "edgewonk-alternative",
  },
  "tradersync-alternative": {
    en: "tradersync-alternative",
    it: "alternativa-tradersync",
    es: "alternativa-tradersync",
    fr: "alternative-tradersync",
    de: "tradersync-alternative",
  },
  "fxreplay-alternative": {
    en: "fxreplay-alternative",
    it: "alternativa-fxreplay",
    es: "alternativa-fxreplay",
    fr: "alternative-fxreplay",
    de: "fxreplay-alternative",
  },
  "tradingview-alternative": {
    en: "tradingview-alternative",
    it: "alternativa-tradingview",
    es: "alternativa-tradingview",
    fr: "alternative-tradingview",
    de: "tradingview-alternative",
  },
  "tradezella-vs-edgewonk": {
    en: "tradezella-vs-edgewonk",
    it: "tradezella-vs-edgewonk",
    es: "tradezella-vs-edgewonk",
    fr: "tradezella-vs-edgewonk",
    de: "tradezella-vs-edgewonk",
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

/** Official AUREUS PROTOCOL access tiers shared across SoftwareApplication / Product schema. */
export const AUREUS_OFFERS = [
  { "@type": "Offer", price: "0", priceCurrency: "EUR", name: "Accesso Base (Iniziato)" },
  { "@type": "Offer", price: "10", priceCurrency: "EUR", name: "Patto della Soglia di Selezione" },
  { "@type": "Offer", price: "150", priceCurrency: "EUR", name: "Tributo Operativo Mensile (Protocollo Completo)" },
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
    alternateName: ["AUREUS", "AUREUS PROTOCOL", "AUREUS OS", "Protocollo Aureus"],
    description,
    url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    inLanguage: lang,
    offers: AUREUS_OFFERS,
    publisher: { "@type": "Organization", name: "AUREUS PROTOCOL", url: `${SITE_ORIGIN}/` },
  };
}

/** schema.org Product (with AUREUS offers) for the pricing page. */
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
    brand: { "@type": "Brand", name: "AUREUS PROTOCOL" },
    offers: AUREUS_OFFERS,
  };
}

/**
 * Sovereign Schema.org @graph Knowledge Graph for AUREUS (Organization + WebSite +
 * SoftwareApplication + DefinedTermSet). Disambiguates "AUREUS" for Google Knowledge
 * Graph and AI/LLM search engines (ChatGPT, Perplexity, Claude, Gemini, Copilot).
 */
export function aureusKnowledgeGraphJsonLd(lang: Language): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "AUREUS PROTOCOL",
        legalName: "AUREUS PROTOCOL",
        alternateName: [
          "AUREUS",
          "AUREUS OS",
          "Protocollo Aureus",
          "Aureus Trading",
          "Aureus Operating System",
          "Limen Protocol",
          "TraderLoading",
        ],
        url: `${SITE_ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/app-icon-512.png`,
          width: 512,
          height: 512,
        },
        image: `${SITE_ORIGIN}/opengraph.jpg`,
        slogan: "Il Codice della Presenza e dell'Eredità",
        description:
          "AUREUS PROTOCOL (AUREUS OS): Sistema Operativo di Disciplina, Padronanza Mentale, Trading Istituzionale ed Eredità Patrimoniale. Riunisce L'Ordine Giornaliero, Il Custode della Soglia, La Forgia del Passato (Backtest), Il Libro della Verità (Trading Journal MT4/MT5) e l'Architettura Patrimoniale.",
        contactPoint: {
          "@type": "ContactPoint",
          email: "assistenza@aureus-os.app",
          contactType: "customer support",
          availableLanguage: ["it", "en", "es", "fr", "de"],
        },
        knowsAbout: [
          "Trading Journal",
          "Diario di Trading Automatico MT4 MT5",
          "Backtesting",
          "Chart Replay Simulator",
          "Risk Management",
          "Position Size Calculator",
          "Macroeconomic Analysis",
          "Economic Calendar",
          "Trading Psychology",
          "Bio-Emotional Telemetry",
          "Prop Firm Risk Management",
          "Monte Carlo Simulation",
          "Wealth Architecture",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: "AUREUS — AUREUS PROTOCOL",
        alternateName: ["AUREUS", "AUREUS OS", "Protocollo Aureus"],
        inLanguage: ["it", "en", "es", "fr", "de"],
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_ORIGIN}/#application`,
        name: "AUREUS OS — AUREUS PROTOCOL",
        alternateName: ["AUREUS", "AUREUS PROTOCOL", "Protocollo Aureus"],
        url: `${SITE_ORIGIN}/`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS, Android, macOS, Windows",
        inLanguage: lang,
        offers: AUREUS_OFFERS,
        featureList: [
          "Il Libro della Verità (Automated MT4/MT5 Trading Journal, R-Multiple & SHA-256 Notary)",
          "La Forgia del Passato (Candle-by-Candle Backtesting & Historical Chart Replay)",
          "Il Custode della Soglia (Pre-Trade Checklist, Risk Guard & Circuit-Breaker)",
          "L'Ordine Giornaliero (Morning/Evening Trading Routine & Bio-Emotional Telemetry)",
          "La Dottrina del Tempo (Institutional Swing Siege & Intraday Scalp Duel Academy)",
          "Architettura Patrimoniale (5 Wealth Pillars, 1,000-Trajectory Monte Carlo & Prop Firm Calculator)",
          "Le Prove del Fuoco & La Fratellanza (Live Discipline Duel Arenas & Encrypted Order Agora)",
        ],
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${SITE_ORIGIN}/#lexicon`,
        name: "Lessico Ufficiale AUREUS PROTOCOL",
        description:
          "Glossario canonico del Protocollo AUREUS che mappa i moduli operativi d'Ordine agli strumenti finanziari di trading e gestione del rischio.",
        hasDefinedTerm: [
          {
            "@type": "DefinedTerm",
            name: "Il Varco",
            description: "Centro di Comando operativo di AUREUS: passaggio dalla Deriva emotiva al governo conscio del rischio.",
          },
          {
            "@type": "DefinedTerm",
            name: "Il Libro della Verità",
            description: "Diario di trading automatico (MT4/MT5 via FX Blue in sola lettura) con analisi R-Multiplo, curva di equity e certificazione notarile SHA-256.",
          },
          {
            "@type": "DefinedTerm",
            name: "La Forgia del Passato",
            description: "Simulatore di backtest professionale con replay storico candela per candela su dati reali Dukascopy e Binance.",
          },
          {
            "@type": "DefinedTerm",
            name: "Il Custode della Soglia",
            description: "Co-pilota pre-trade e filtro decisionale con checklist oggettiva, calcolatore lotti e circuit-breaker contro overtrading e FOMO.",
          },
          {
            "@type": "DefinedTerm",
            name: "L'Ordine Giornaliero",
            description: "Sequenza rituale mattutina e serale di allineamento operativo, respirazione neurale e monitoraggio bio-emotivo.",
          },
          {
            "@type": "DefinedTerm",
            name: "La Dottrina del Tempo",
            description: "Percorso formativo superiore diviso nell'Arte dell'Assedio (Swing HTF) e nell'Arte del Duello (Scalp nelle Kill-Zone).",
          },
        ],
      },
    ],
  };
}
