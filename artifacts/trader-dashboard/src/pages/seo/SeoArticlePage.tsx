import { Link } from "wouter";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqJsonLd,
  landingPath,
  pricingProductJsonLd,
  seoPageAlternates,
  seoPagePath,
  softwareAppJsonLd,
  SEO_TOPIC_KEYS,
  type JsonLd,
  type SeoPageKey,
} from "@/lib/seo";

const SECTION_IDS = ["s1", "s2", "s3"] as const;
const FAQ_IDS = ["q1", "q2", "q3"] as const;
const TOPIC_PAGES = new Set<SeoPageKey>([
  "trading-journal",
  "backtest",
  "macro-news",
  "risk-tools",
]);

/** Render `text` with the first case-insensitive occurrence of `kw` colored. */
function withKeyword(text: string, kw: string | null) {
  if (!kw) return text;
  const i = text.toLowerCase().indexOf(kw.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-primary">{text.slice(i, i + kw.length)}</span>
      {text.slice(i + kw.length)}
    </>
  );
}

/**
 * One generic, fully i18n'd marketing/keyword page driven by `seo.<page>.*`
 * translation keys. Optional sections and the FAQ render only when their keys
 * exist, so the same component serves topic pages, pricing, the guide hub and
 * the about/contact trust pages. Built to be prerendered per language.
 */
export default function SeoArticlePage({ page }: { page: SeoPageKey }) {
  const { language, t } = useLanguage();

  // A key resolves to itself when missing — use that to skip optional blocks.
  const has = (key: string) => t(key) !== key;
  const base = `seo.${page}`;

  const canonical = absoluteUrl(seoPagePath(page, language));
  const eyebrow = t(`${base}.eyebrow`);
  const h1 = t(`${base}.h1`);
  const h1Kw = has(`${base}.h1.kw`) ? t(`${base}.h1.kw`) : null;

  const sections = SECTION_IDS.filter((id) => has(`${base}.${id}.title`)).map((id) => ({
    id,
    title: t(`${base}.${id}.title`),
    body: t(`${base}.${id}.body`),
  }));

  const faqItems = FAQ_IDS.filter((id) => has(`${base}.faq.${id}`)).map((id, i) => ({
    question: t(`${base}.faq.${id}`),
    answer: t(`${base}.faq.a${i + 1}`),
  }));

  const related = SEO_TOPIC_KEYS.filter((key) => key !== page);

  const jsonLd: JsonLd[] = [breadcrumbJsonLd(t("seo.nav.home"), eyebrow, page, language)];
  if (faqItems.length) jsonLd.push(faqJsonLd(language, faqItems));
  if (page === "pricing") {
    jsonLd.push(pricingProductJsonLd("TraderLoading", t(`${base}.intro`), canonical));
  } else if (TOPIC_PAGES.has(page)) {
    jsonLd.push(softwareAppJsonLd(`TraderLoading — ${eyebrow}`, t(`${base}.intro`), canonical, language));
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Seo
        title={t(`${base}.meta.title`)}
        description={t(`${base}.meta.description`)}
        keywords={t(`${base}.meta.keywords`)}
        lang={language}
        canonical={canonical}
        ogType="article"
        alternates={seoPageAlternates(page)}
        jsonLd={jsonLd}
      />

      {/* Top bar */}
      <header className="border-b border-border/40">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href={landingPath(language)} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/35 bg-primary/15 text-primary">
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-mono text-base font-bold">TraderLoading</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={landingPath(language)}
              className="rounded-full px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("seo.nav.home")}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-primary px-4 py-1.5 font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("landing.hero.start_free")}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        {/* Hero */}
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-mono text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {withKeyword(h1, h1Kw)}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t(`${base}.intro`)}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("landing.hero.start_free")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-semibold text-foreground transition-colors hover:border-primary/40"
          >
            {t("landing.nav.sign_in")}
          </Link>
        </div>

        {/* Sections */}
        {sections.length > 0 && (
          <div className="mt-14 flex flex-col gap-10">
            {sections.map((section) => (
              <section key={section.id}>
                <h2 className="text-xl font-bold sm:text-2xl">{withKeyword(section.title, h1Kw)}</h2>
                <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">{section.body}</p>
              </section>
            ))}
          </div>
        )}

        {/* FAQ */}
        {faqItems.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold sm:text-2xl">{t("seo.faq.heading")}</h2>
            <dl className="mx-auto mt-5 flex max-w-2xl flex-col gap-5">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-xl border border-border/50 bg-card/40 p-5">
                  <dt className="font-semibold">{item.question}</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Related topic pages */}
        <section className="mt-14">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t("seo.related.heading")}
          </h2>
          <ul className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
            {related.map((key) => (
              <li key={key}>
                <Link
                  href={seoPagePath(key, language)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/40 px-4 py-3 font-semibold transition-colors hover:border-primary/40"
                >
                  {t(`seo.${key}.eyebrow`)}
                  <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-2xl border border-primary/25 bg-primary/[0.06] p-8 text-center">
          <h2 className="font-mono text-2xl font-extrabold">{t(`${base}.cta.title`)}</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
            {t(`${base}.cta.body`)}
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {t("landing.hero.start_free")}
          </Link>
        </section>
      </main>
    </div>
  );
}
