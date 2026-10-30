import { BrandMark } from "@/components/BrandMark";
import { LandingCockpitPreview } from "./LandingCockpitPreview";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Star,
  Users,
  BookOpenCheck,
  Quote,
  ChartNoAxesCombined,
  NotebookPen,
  ExternalLink,
  Layers3,
  BookOpenText,
  Building2,
  Mail,
  LogIn,
  ArrowUp,
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { TOUR_STEPS } from "@/lib/landingTour";
import { localizedHref } from "@/lib/seo";
import { SectionIntro, SignupCta } from "./shared";

export function LandingHero({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="landing-hero landing-container" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="landing-positioning">{t("landing.hero.eyebrow")}</p>
        <h1 id="landing-title">
          {t("landing.hero.title_a")} <span>{t("landing.hero.title_b")}</span>
        </h1>
        <p className="landing-lede">{t("landing.hero.subtitle")}</p>
        <div className="landing-actions">
          <SignupCta placement="hero" />
          <a href="#how" className="landing-button landing-button-secondary" onClick={onStart}>
            {t("landing.hero.demo")}
            <ArrowDownRight size={20} aria-hidden="true" />
          </a>
        </div>
        <div className="landing-hero-assurances">
          <span>
            <Check size={17} aria-hidden="true" />
            {t("landing.hero.trust.free")}
          </span>
          <span>{t("landing.hero.trust.pro")}</span>
        </div>
      </div>
      <LandingCockpitPreview />
    </section>
  );
}

export function LandingMission() {
  const { language, t } = useLanguage();
  return (
    <section className="landing-mission landing-container" aria-labelledby="mission-heading">
      <h2 id="mission-heading">{t("landing.mission.title")}</h2>
      <div>
        <p>{t("landing.mission.body")}</p>
        <div className="landing-trust-links">
          <Link href={localizedHref("/about", language)}>
            {t("landing.footer.company.about")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a href="mailto:assistenza@aureus-os.app">{t("landing.footer.support")}</a>
          <Link href="/terms">{t("landing.footer.terms")}</Link>
        </div>
      </div>
    </section>
  );
}

export function LandingProblem() {
  const { t } = useLanguage();
  return (
    <section className="landing-section landing-problem" aria-labelledby="problem-heading">
      <div className="landing-container landing-problem-layout">
        <SectionIntro
          id="problem-heading"
          eyebrowKey="landing.problem.eyebrow"
          titleKey="landing.problem.title"
          bodyKey="landing.problem.body"
        />
        <ol className="landing-problem-list">
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>
              <span aria-hidden="true">0{n}</span>
              <div>
                <h3>{t(`landing.problem.${n}.title`)}</h3>
                <p>{t(`landing.problem.${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingDesired() {
  const { t } = useLanguage();
  return (
    <section className="landing-section landing-desired" aria-labelledby="desired-heading">
      <div className="landing-container landing-desired-layout">
        <SectionIntro
          id="desired-heading"
          eyebrowKey="landing.desired.eyebrow"
          titleKey="landing.desired.title"
          bodyKey="landing.desired.body"
        />
        <div className="landing-desired-path">
          <ol>
            {TOUR_STEPS.map((step, i) => (
              <li key={step}>
                <CheckCircle2 size={25} aria-hidden="true" />
                <span>{t(`landing.process.${step}.name`)}</span>
                <span aria-hidden="true">0{i + 1}</span>
              </li>
            ))}
          </ol>
          <p>{t("landing.desired.bottom")}</p>
        </div>
      </div>
    </section>
  );
}

export function LandingReasons() {
  const { t } = useLanguage();
  return (
    <section
      id="features"
      className="landing-section landing-reasons"
      aria-labelledby="reasons-heading"
    >
      <div className="landing-container">
        <SectionIntro
          id="reasons-heading"
          eyebrowKey="landing.features.eyebrow"
          titleKey="landing.features.title"
        />
        <div className="landing-reason-list">
          {[1, 2, 3].map((n) => (
            <article key={n}>
              <span className="landing-reason-number" aria-hidden="true">
                0{n}
              </span>
              <div>
                <h3>{t(`landing.features.${n}.title`)}</h3>
                <p>{t(`landing.features.${n}.body`)}</p>
              </div>
              <ArrowDownRight size={30} aria-hidden="true" />
            </article>
          ))}
        </div>
        <p className="landing-note landing-secondary-benefit">{t("landing.features.social")}</p>
      </div>
    </section>
  );
}

interface PublicStats {
  traders: number;
  trades: number;
  pairs: number;
  rating: { average: number; count: number } | null;
}
interface PublicTestimonial {
  id: number;
  name: string;
  role: string | null;
  text: string;
  rating: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function LandingEvidence() {
  const { t, language } = useLanguage();
  const { data: stats } = useQuery({
    queryKey: ["landing", "public-stats"],
    queryFn: () => fetchJSON<PublicStats>("/api/public/stats"),
    staleTime: 300_000,
    retry: false,
  });
  const { data } = useQuery({
    queryKey: ["landing", "public-testimonials"],
    queryFn: () => fetchJSON<{ testimonials: PublicTestimonial[] }>("/api/public/testimonials"),
    staleTime: 300_000,
    retry: false,
  });
  const testimonials = (Array.isArray(data?.testimonials) ? data.testimonials : []).filter(
    (item) =>
      typeof item.name === "string" &&
      item.name.trim() &&
      typeof item.text === "string" &&
      item.text.trim(),
  );
  const counters = [
    { value: stats?.traders, key: "landing.stats.traders" },
    { value: stats?.trades, key: "landing.stats.journaled" },
  ].filter(
    (item): item is { value: number; key: string } =>
      typeof item.value === "number" && Number.isFinite(item.value) && item.value > 0,
  );
  const rating = stats?.rating;
  const hasRating =
    rating &&
    Number.isFinite(rating.average) &&
    rating.average >= 1 &&
    rating.average <= 5 &&
    Number.isFinite(rating.count) &&
    rating.count > 0;
  if (!counters.length && !hasRating && !testimonials.length) return null;
  return (
    <section className="landing-section landing-evidence" aria-labelledby="evidence-heading">
      <div className="landing-container">
        <SectionIntro
          id="evidence-heading"
          titleKey={testimonials.length ? "landing.testimonials.title" : "landing.stats.title"}
          bodyKey={testimonials.length ? undefined : "landing.stats.body"}
        />
        {(counters.length > 0 || hasRating) && (
          <dl className="landing-evidence-stats">
            {counters.map((item) => {
              const Icon = item.key === "landing.stats.traders" ? Users : BookOpenCheck;
              return (
                <div key={item.key}>
                  <span className="landing-stat-icon" aria-hidden="true">
                    <Icon size={26} strokeWidth={1.6} />
                  </span>
                  <dt>{t(item.key)}</dt>
                  <dd>{new Intl.NumberFormat(language).format(item.value)}</dd>
                </div>
              );
            })}
            {hasRating && (
              <div>
                <span className="landing-stat-icon" aria-hidden="true">
                  <Star size={26} strokeWidth={1.6} />
                </span>
                <dt>
                  {t("landing.stats.rating")} · {rating.count} {t("landing.testimonials.reviews")}
                </dt>
                <dd>
                  {new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(
                    rating.average,
                  )}
                  <span className="landing-stat-unit">/5</span>
                </dd>
              </div>
            )}
          </dl>
        )}
        {testimonials.length > 0 && (
          <div className="landing-quotes">
            {testimonials.slice(0, 3).map((item) => (
              <figure key={item.id}>
                <Quote size={30} strokeWidth={1.6} aria-hidden="true" />
                <blockquote>
                  <p>“{item.text}”</p>
                </blockquote>
                <figcaption>
                  <strong>{item.name}</strong>
                  {item.role && <span>{item.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function LandingComparison() {
  const { t, language } = useLanguage();
  const formatPrice = (value: number) =>
    new Intl.NumberFormat(language, {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  const products = [
    {
      id: "ours",
      name: "AUREUS",
      plan: "landing.pricing.pro",
      amount: 7,
      currency: "€",
      Icon: Crown,
      source: null,
    },
    {
      id: "sync",
      name: "TraderSync",
      plan: "landing.pricing.pro",
      amount: 29.95,
      currency: "USD",
      Icon: ChartNoAxesCombined,
      source: "https://tradersync.com/pricing/",
    },
    {
      id: "edge",
      name: "Edgewonk",
      plan: "landing.comparison.annual_plan",
      amount: 197,
      currency: "USD",
      Icon: NotebookPen,
      source: "https://edgewonk.com/pricing",
    },
  ] as const;
  return (
    <section
      id="compare"
      className="landing-section landing-comparison"
      aria-labelledby="comparison-heading"
    >
      <div className="landing-container">
        <SectionIntro
          id="comparison-heading"
          eyebrowKey="landing.comparison.eyebrow"
          titleKey="landing.comparison.title"
          bodyKey="landing.comparison.body"
        />
        <div className="landing-comparison-cards">
          {products.map(({ id, name, plan, amount, currency, Icon, source }) => (
            <article
              key={id}
              className={`landing-compare-card landing-compare-${id}`}
              aria-labelledby={`compare-${id}-heading`}
            >
              <div className="landing-compare-brand">
                <span className="landing-compare-icon" aria-hidden="true">
                  <Icon size={28} strokeWidth={1.6} />
                </span>
                <h3 id={`compare-${id}-heading`}>{name}</h3>
                <p className="landing-compare-plan">{t(plan)}</p>
              </div>
              <div className="landing-compare-price-block">
                <p className="landing-compare-price">
                  <strong>{formatPrice(amount)}</strong>
                  <span>{currency}</span>
                </p>
                <p className="landing-compare-period">
                  {t(id === "edge" ? "landing.comparison.year_unit" : "landing.pricing.month")}
                </p>
                <p className="landing-compare-billing">
                  {t(
                    id === "edge"
                      ? "landing.comparison.annual_billing"
                      : "landing.comparison.monthly",
                  )}
                </p>
              </div>
              <p className="landing-compare-purpose">{t(`landing.comparison.${id}_purpose`)}</p>
              <ul className="landing-compare-features">
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <Check size={18} aria-hidden="true" />
                    <span>{t(`landing.comparison.${id}_item${n}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="landing-compare-terms">
                <p>
                  {t(
                    id === "ours"
                      ? "landing.comparison.ours_year"
                      : id === "sync"
                        ? "landing.comparison.sync_annual"
                        : "landing.comparison.edge_terms",
                  )}
                </p>
              </div>
              <div className="landing-compare-action">
                {source ? (
                  <a href={source} target="_blank" rel="noopener noreferrer">
                    {t("landing.comparison.source")}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ) : (
                  <SignupCta placement="comparison" pro />
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="landing-comparison-conclusion">{t("landing.comparison.conclusion")}</p>
        <details className="landing-comparison-notes">
          <summary>
            {t("landing.comparison.read_notes")}
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div>
            <p>{t("landing.comparison.checked")}</p>
            <p>{t("landing.comparison.edge_annual")}</p>
          </div>
        </details>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { t, language } = useLanguage();
  const price = (value: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  return (
    <section
      id="pricing"
      className="landing-section landing-pricing"
      aria-labelledby="pricing-heading"
    >
      <div className="landing-container">
        <SectionIntro
          id="pricing-heading"
          eyebrowKey="landing.nav.pricing"
          titleKey="landing.pricing.heading"
        />
        <div className="landing-offers">
          {["free", "pro"].map((plan) => (
            <article key={plan} className={`landing-offer landing-offer-${plan}`}>
              <h3>{t(`landing.pricing.${plan}`)}</h3>
              <p className="landing-price">
                {price(plan === "free" ? 0 : 7)}
                <span>{t("landing.pricing.month")}</span>
              </p>
              <p className="landing-offer-intro">{t(`landing.pricing.${plan}_intro`)}</p>
              <ul>
                {[1, 2, 3, 4].map((n) => (
                  <li key={n}>
                    <Check size={20} aria-hidden="true" />
                    {t(`landing.pricing.${plan}.item${n}`)}
                  </li>
                ))}
              </ul>
              <SignupCta placement={`pricing_${plan}`} pro={plan === "pro"} />
            </article>
          ))}
        </div>
        <p className="landing-note landing-pricing-note">{t("landing.pricing.note")}</p>
        <p className="landing-note">{t("landing.pricing.tax")}</p>
      </div>
    </section>
  );
}

export function LandingFaq({
  items,
}: {
  items: readonly { questionKey: string; answerKey: string }[];
}) {
  const { t } = useLanguage();
  return (
    <section id="faq" className="landing-section landing-faq" aria-labelledby="faq-heading">
      <div className="landing-container landing-faq-layout">
        <SectionIntro
          id="faq-heading"
          eyebrowKey="landing.nav.faq"
          titleKey="landing.faq.heading"
        />
        <div>
          {items.map((item) => (
            <details key={item.questionKey}>
              <summary>
                {t(item.questionKey)}
                <ChevronDown size={22} aria-hidden="true" />
              </summary>
              <p>{t(item.answerKey)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingClosing() {
  const { t } = useLanguage();
  return (
    <section className="landing-section landing-closing" aria-labelledby="closing-heading">
      <div className="landing-container">
        <h2 id="closing-heading">{t("landing.cta.title")}</h2>
        <p className="landing-lede">{t("landing.cta.subtitle")}</p>
        <SignupCta placement="closing" />
      </div>
    </section>
  );
}

const FOOTER_COLS = [
  {
    titleKey: "landing.footer.col.product",
    Icon: Layers3,
    items: [
      { key: "landing.footer.product.diary", href: "/trading-journal" },
      { key: "landing.footer.product.news", href: "/macro-news" },
      { key: "landing.footer.product.backtest", href: "/backtesting" },
      { key: "landing.footer.product.risk", href: "/risk-management" },
      { key: "landing.footer.product.pricing", href: "/pricing" },
    ],
  },
  {
    titleKey: "landing.footer.col.resources",
    Icon: BookOpenText,
    items: [
      { key: "landing.footer.resources.guide", href: "/guide" },
      { key: "landing.footer.resources.community", href: "/sign-up" },
    ],
  },
  {
    titleKey: "landing.footer.col.company",
    Icon: Building2,
    items: [
      { key: "landing.footer.company.about", href: "/about" },
      { key: "landing.footer.company.contact", href: "/contact" },
    ],
  },
];

const FOOTER_LEGAL = [
  { key: "landing.footer.privacy", href: "/privacy" },
  { key: "landing.footer.terms", href: "/terms" },
];

export function LandingFooter() {
  const { t, language } = useLanguage();
  const footer = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(() => FOOTER_COLS.map((col) => col.titleKey));
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    const update = () => {
      if (mobile.matches && footer.current?.contains(document.activeElement)) {
        document.activeElement?.closest("details")?.querySelector("summary")?.focus();
      }
      setExpanded(mobile.matches ? [] : FOOTER_COLS.map((col) => col.titleKey));
    };
    update();
    mobile.addEventListener("change", update);
    return () => mobile.removeEventListener("change", update);
  }, []);
  return (
    <footer id="landing-footer" className="landing-footer" ref={footer}>
      <div className="landing-container">
        <div className="landing-footer-head">
          <Link className="landing-brand" href="#landing-main">
            <BrandMark />
          </Link>
          <p>{t("landing.footer.tagline")}</p>
          <div className="landing-footer-utilities">
            <a href="mailto:assistenza@aureus-os.app">
              <Mail size={18} aria-hidden="true" />
              {t("landing.footer.support")}
            </a>
            <Link href="/sign-in">
              <LogIn size={18} aria-hidden="true" />
              {t("landing.nav.sign_in")}
            </Link>
          </div>
        </div>
        <nav className="landing-footer-directory" aria-label={t("landing.footer.explore")}>
          {FOOTER_COLS.map(({ Icon, ...col }) => (
            <details
              key={col.titleKey}
              open={expanded.includes(col.titleKey)}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                if (open === expanded.includes(col.titleKey)) return;
                setExpanded((previous) =>
                  open
                    ? [...previous, col.titleKey]
                    : previous.filter((key) => key !== col.titleKey),
                );
                if (
                  open &&
                  document.visibilityState === "visible" &&
                  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ) {
                  event.currentTarget.querySelector("ul")?.animate?.(
                    [
                      { opacity: 0, transform: "translateY(-6px)" },
                      { opacity: 1, transform: "translateY(0)" },
                    ],
                    { duration: 240, easing: "ease-out" },
                  );
                }
              }}
            >
              <summary>
                <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                <span>{t(col.titleKey)}</span>
                <ChevronDown size={20} aria-hidden="true" />
              </summary>
              <ul>
                {col.items.map((item) => (
                  <li key={item.key}>
                    <Link href={localizedHref(item.href, language)}>
                      <span>{t(item.key)}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
        <div className="landing-footer-bottom">
          <div className="landing-footer-legal">
            {FOOTER_LEGAL.map((item) => (
              <Link key={item.key} href={item.href}>
                {t(item.key)}
              </Link>
            ))}
          </div>
          <a href="#landing-main" className="landing-footer-top">
            {t("landing.footer.back_top")}
            <ArrowUp size={17} aria-hidden="true" />
          </a>
          <p className="landing-copyright">
            © {new Date().getFullYear()} AUREUS PROTOCOL. {t("landing.footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
