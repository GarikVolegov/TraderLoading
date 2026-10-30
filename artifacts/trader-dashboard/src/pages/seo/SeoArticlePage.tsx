import { Link } from "wouter";
import { ArrowRight, Check, Crosshair, Flame, Globe, Mail, ShieldCheck, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import {
  absoluteUrl,
  aureusKnowledgeGraphJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  landingPath,
  pricingProductJsonLd,
  seoPageAlternates,
  seoPagePath,
  softwareAppJsonLd,
  SEO_PAGE_KEYS,
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
  "tradezella-alternative",
  "edgewonk-alternative",
  "tradersync-alternative",
  "fxreplay-alternative",
  "tradingview-alternative",
]);

interface CompetitorMatrixSpec {
  name: string;
  priceRetail: string;
  syncRetail: string;
  replayRetail: string;
  guardRetail: string;
  notaryRetail: string;
  arenaRetail: string;
  monteCarloRetail: string;
  royaltyRetail: string;
}

const COMPETITOR_MAP: Record<string, CompetitorMatrixSpec> = {
  "tradezella-alternative": {
    name: "TradeZella",
    priceRetail: "29 $ – 49 $ / mese",
    syncRetail: "Sync cloud / senza certificazione",
    replayRetail: "Modulo separato a pagamento",
    guardRetail: "Solo avvisi post-perdita",
    notaryRetail: "Assente (Screenshot falsificabili)",
    arenaRetail: "Assenti (Uso solitario)",
    monteCarloRetail: "Assente",
    royaltyRetail: "0% Royalty (Modello chiuso)",
  },
  "edgewonk-alternative": {
    name: "Edgewonk",
    priceRetail: "169 $ / anno",
    syncRetail: "Manuale / Import CSV",
    replayRetail: "Non disponibile",
    guardRetail: "Assente (Nessun blocco ordini)",
    notaryRetail: "Assente (Dati locali modificabili)",
    arenaRetail: "Assenti",
    monteCarloRetail: "Assente",
    royaltyRetail: "0% Royalty",
  },
  "tradersync-alternative": {
    name: "TraderSync",
    priceRetail: "29 $ – 79 $ / mese",
    syncRetail: "Sync base con sovrapprezzi",
    replayRetail: "Assente o simulatore limitato",
    guardRetail: "Solo notifiche passive",
    notaryRetail: "Assente (Report non certificati)",
    arenaRetail: "Assenti",
    monteCarloRetail: "Assente",
    royaltyRetail: "0% Royalty",
  },
  "fxreplay-alternative": {
    name: "FX Replay",
    priceRetail: "35 $ / mese",
    syncRetail: "Assente (Nessun diario reale)",
    replayRetail: "Solo replay senza diario MT4/5",
    guardRetail: "Assente",
    notaryRetail: "Assente",
    arenaRetail: "Assenti (Nessun multiplayer)",
    monteCarloRetail: "Assente",
    royaltyRetail: "0% Royalty",
  },
  "tradingview-alternative": {
    name: "TradingView Replay",
    priceRetail: "15 $ – 60 $ / mese",
    syncRetail: "Nessun diario R-Multiplo",
    replayRetail: "M5 bloccato sotto paywall",
    guardRetail: "Assente (Incentiva over-analisi)",
    notaryRetail: "Assente",
    arenaRetail: "Assenti (Nessun duello 1v1)",
    monteCarloRetail: "Assente",
    royaltyRetail: "0% Royalty",
  },
};

const SECTION_ICONS = [ShieldCheck, Crosshair, Flame] as const;

/** Render `text` with the first case-insensitive occurrence of `kw` colored in Imperial Gold. */
function withKeyword(text: string, kw: string | null) {
  if (!kw) return text;
  const i = text.toLowerCase().indexOf(kw.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#E8C56A]">{text.slice(i, i + kw.length)}</span>
      {text.slice(i + kw.length)}
    </>
  );
}

/**
 * Sovereign AUREUS SEO / GEO Pillar Page driven by `seo.<page>.*` translation keys.
 * Styled in strict Obsidian (#07080b) & Imperial Gold (#C5A059) per limen-design-system.md.
 */
export default function SeoArticlePage({ page }: { page: SeoPageKey }) {
  const { language, t } = useLanguage();

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
  const competitor = COMPETITOR_MAP[page];

  const jsonLd: JsonLd[] = [
    aureusKnowledgeGraphJsonLd(language),
    breadcrumbJsonLd(t("seo.nav.home"), eyebrow, page, language),
  ];
  if (faqItems.length) jsonLd.push(faqJsonLd(language, faqItems));
  if (page === "pricing") {
    jsonLd.push(pricingProductJsonLd("AUREUS", t(`${base}.intro`), canonical));
  } else if (TOPIC_PAGES.has(page)) {
    jsonLd.push(softwareAppJsonLd(`AUREUS — ${eyebrow}`, t(`${base}.intro`), canonical, language));
  }

  return (
    <div className="relative min-h-screen bg-[#07080b] text-[#F4F4F6] selection:bg-[#C5A059]/30 selection:text-white">
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

      {/* Sovereign Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#C5A059]/20 bg-[#07080b]/95 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 gap-3">
          <Link href={landingPath(language)} className="flex items-center gap-2.5 shrink-0 whitespace-nowrap group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#11131c] text-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.18)] overflow-hidden">
              <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
            </span>
            <div className="flex flex-col">
              <span className="font-serif tracking-[0.22em] text-sm sm:text-base font-black uppercase text-[#F4F4F6] group-hover:text-[#E8C56A] transition-colors leading-none">
                AUREUS
              </span>
              <span className="font-mono text-[8px] tracking-[0.2em] text-[#C5A059] uppercase mt-0.5 whitespace-nowrap">
                AUREUS PROTOCOL
              </span>
            </div>
          </Link>

          {/* Language Switcher + Primary Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-[#C5A059]/25 bg-[#0d0f14] px-2 py-1 font-mono text-[10px]">
              <Globe className="h-3 w-3 text-[#C5A059] mr-1 shrink-0" aria-hidden="true" />
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Link
                  key={lang}
                  href={seoPagePath(page, lang)}
                  className={`px-1.5 py-0.5 rounded uppercase font-bold transition-colors whitespace-nowrap ${
                    lang === language
                      ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/40"
                      : "text-[#94a3b8] hover:text-white"
                  }`}
                >
                  {lang}
                </Link>
              ))}
            </div>

            <Link
              href={landingPath(language)}
              className="rounded-lg border border-[#C5A059]/20 bg-[#0d0f14] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#94a3b8] transition-colors hover:border-[#C5A059]/50 hover:text-white whitespace-nowrap"
            >
              {t("seo.nav.home")}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg border border-[#C5A059]/60 bg-gradient-to-r from-[#9C772C] via-[#C5A059] to-[#E8C56A] px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.2)] transition-all hover:brightness-110 whitespace-nowrap"
            >
              {t("landing.hero.start_free")}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10 space-y-12">
        {/* Telemetry KPI Strip — Zero Empty Space, whitespace-nowrap on all metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 rounded-xl border border-[#C5A059]/25 bg-[#0d0f14] p-3">
          <div className="flex items-center justify-between sm:justify-center gap-2 rounded-lg border border-[#C5A059]/15 bg-[#11131c] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Dotazione Base</span>
            <span className="font-mono text-xs font-bold text-[#10b981] whitespace-nowrap">0 €</span>
          </div>
          <div className="flex items-center justify-between sm:justify-center gap-2 rounded-lg border border-[#C5A059]/15 bg-[#11131c] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Soglia 30 GG</span>
            <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">10 €</span>
          </div>
          <div className="flex items-center justify-between sm:justify-center gap-2 rounded-lg border border-[#C5A059]/15 bg-[#11131c] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Tributo Ordine</span>
            <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">150 € / mese</span>
          </div>
          <div className="flex items-center justify-between sm:justify-center gap-2 rounded-lg border border-[#C5A059]/15 bg-[#11131c] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Espansione</span>
            <span className="font-mono text-xs font-bold text-[#10b981] whitespace-nowrap">20% Royalty</span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-center gap-2 rounded-lg border border-[#C5A059]/15 bg-[#11131c] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Sicurezza</span>
            <span className="font-mono text-xs font-bold text-[#E8C56A] whitespace-nowrap">MT4/MT5 Read-Only</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-gradient-to-b from-[#11131c] via-[#0d0f14] to-[#07080b] p-6 sm:p-10 text-center shadow-[0_0_30px_rgba(197,160,89,0.08)]">
          <div className="inline-flex items-center gap-2 rounded border border-[#C5A059]/35 bg-[#C5A059]/15 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>
          <h1 className="mx-auto mt-4 max-w-4xl font-serif text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            {withKeyword(h1, h1Kw)}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl font-sans text-sm sm:text-base leading-relaxed text-[#94a3b8]">
            {t(`${base}.intro`)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] bg-gradient-to-r from-[#9C772C] via-[#C5A059] to-[#E8C56A] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#07080b] shadow-[0_0_20px_rgba(197,160,89,0.25)] transition-all hover:brightness-110 whitespace-nowrap"
            >
              <span>{t("landing.hero.start_free")}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/protocollo"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059]/35 bg-[#07080b] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] transition-colors hover:border-[#C5A059] hover:bg-[#C5A059]/10 whitespace-nowrap"
            >
              <span>Il Protocollo AUREUS</span>
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl border border-[#26262E] bg-[#11131c] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#94a3b8] transition-colors hover:border-[#C5A059]/40 hover:text-white whitespace-nowrap"
            >
              <span>{t("landing.nav.sign_in")}</span>
            </Link>
          </div>
        </section>

        {/* Sovereign Head-to-Head Comparison Matrix (Active on Competitor Pages) */}
        {competitor && (
          <section className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] p-5 sm:p-7 shadow-[0_0_25px_rgba(197,160,89,0.08)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/20 pb-4">
              <div>
                <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-[#E8C56A] bg-[#C5A059]/15 border border-[#C5A059]/30 px-2 py-0.5 rounded">
                  MATRICE STRUTTURALE AUREUS OS
                </span>
                <h2 className="font-serif text-lg sm:text-2xl font-bold text-white mt-1.5">
                  Confronto Sovrano: AUREUS PROTOCOL vs {competitor.name}
                </h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 px-2.5 py-1 rounded">
                <ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" aria-hidden="true" />
                <span className="font-bold whitespace-nowrap">Vantaggio Asimmetrico Verificato</span>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#C5A059]/30">
              <table className="w-full text-left font-mono text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#C5A059]/25 text-[10px] text-[#94a3b8] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Criterio Operativo</th>
                    <th className="py-2.5 px-3 text-[#E8C56A]">AUREUS PROTOCOL (AUREUS OS)</th>
                    <th className="py-2.5 px-3 text-[#94a3b8]">{competitor.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C5A059]/15">
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Costo d&apos;Ingresso &amp; Piani</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">0 € Base / 10 € Selezione (30 GG)</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.priceRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Sincronizzazione MT4 / MT5</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">Sola Lettura Istantanea &amp; SHA-256</td>
                    <td className="py-3 px-3 text-[#94a3b8] whitespace-nowrap">{competitor.syncRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Simulatore Replay Candela per Candela</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">Incluso (Dukascopy &amp; Binance M5 → D1)</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.replayRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Circuito Anti-Deriva Pre-Trade</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">Il Custode della Soglia (Blocco Attivo)</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.guardRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Certificazione Notarile dei Trade</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">Hash Pubblico SHA-256 su /verifica</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.notaryRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Arene Multiplayer &amp; Duelli 1v1</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">Le Prove del Fuoco Live</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.arenaRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Architettura Patrimoniale &amp; Monte Carlo</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">1.000 Traiettorie &amp; Prop Firm Engine</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.monteCarloRetail}</td>
                  </tr>
                  <tr className="hover:bg-[#11131c]/50 transition-colors">
                    <td className="py-3 px-3 text-white font-sans font-semibold">Modello Economico Utente (Royalty)</td>
                    <td className="py-3 px-3 text-[#10b981] font-bold whitespace-nowrap">20% Mandato Espansione (30 € / mese)</td>
                    <td className="py-3 px-3 text-[#ef4444] whitespace-nowrap">{competitor.royaltyRetail}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Balanced Pillars Grid (Flex-Stretch) */}
        {sections.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {sections.map((section, idx) => {
              const Icon = SECTION_ICONS[idx % SECTION_ICONS.length] ?? ShieldCheck;
              return (
                <article
                  key={section.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#C5A059]/22 bg-[#0d0f14] p-6 shadow-[0_0_15px_rgba(197,160,89,0.06)] hover:border-[#C5A059]/45 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider text-[#E8C56A] whitespace-nowrap">
                        PILASTRO 0{idx + 1}
                      </span>
                      <Icon className="h-4 w-4 text-[#C5A059]" aria-hidden="true" />
                    </div>
                    <h2 className="font-serif text-lg font-bold text-white leading-snug">
                      {withKeyword(section.title, h1Kw)}
                    </h2>
                    <p className="font-sans text-xs sm:text-sm leading-relaxed text-[#94a3b8]">
                      {section.body}
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#C5A059]/15 flex items-center justify-between font-mono text-[10px] text-[#E8C56A]">
                    <span className="whitespace-nowrap">CONFORMITÀ AUREUS</span>
                    <span className="text-[#10b981] font-bold whitespace-nowrap">✓ ATTIVO</span>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Two-Column Balanced Section: FAQ + Protocol Comparison Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {faqItems.length > 0 && (
            <section className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[#C5A059]/22 bg-[#0d0f14] p-6 sm:p-7">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#C5A059]/15 pb-3">
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-white">
                    {t("seo.faq.heading")}
                  </h2>
                  <span className="rounded bg-[#C5A059]/15 border border-[#C5A059]/35 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider text-[#E8C56A] whitespace-nowrap">
                    DOTTRINA &amp; RISPOSTE
                  </span>
                </div>
                <dl className="space-y-3.5">
                  {faqItems.map((item) => (
                    <div
                      key={item.question}
                      className="rounded-xl border border-[#C5A059]/20 bg-[#11131c] p-4 space-y-1.5"
                    >
                      <dt className="font-serif text-sm font-bold text-[#E8C56A]">{item.question}</dt>
                      <dd className="font-sans text-xs sm:text-sm leading-relaxed text-[#94a3b8]">
                        {item.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="mt-5 pt-3 border-t border-[#C5A059]/15 flex items-center justify-between font-mono text-[10px] text-[#94a3b8]">
                <span className="whitespace-nowrap">DOMINIO UFFICIALE</span>
                <span className="text-[#E8C56A] font-bold whitespace-nowrap">https://aureus-os.app</span>
              </div>
            </section>
          )}

          {/* Sovereign Comparison Matrix ("La Deriva Retail vs. Protocollo AUREUS") */}
          <section
            className={`${
              faqItems.length > 0 ? "lg:col-span-5" : "lg:col-span-12"
            } flex flex-col justify-between rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-6 sm:p-7`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#C5A059]/15 pb-3">
                <h2 className="font-serif text-lg font-bold text-white">
                  Architettura del Protocollo
                </h2>
                <Trophy className="h-4 w-4 text-[#C5A059]" aria-hidden="true" />
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/20 bg-[#11131c] px-3.5 py-2.5">
                  <span className="text-[#94a3b8]">La Forgia del Passato</span>
                  <span className="text-[#E8C56A] font-bold whitespace-nowrap">Replay M5 → D1</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/20 bg-[#11131c] px-3.5 py-2.5">
                  <span className="text-[#94a3b8]">Le Prove del Fuoco</span>
                  <span className="text-[#10b981] font-bold whitespace-nowrap">Duelli 1v1 Live</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/20 bg-[#11131c] px-3.5 py-2.5">
                  <span className="text-[#94a3b8]">Il Libro della Verità</span>
                  <span className="text-[#E8C56A] font-bold whitespace-nowrap">Sync MT4 / MT5</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/20 bg-[#11131c] px-3.5 py-2.5">
                  <span className="text-[#94a3b8]">Il Custode della Soglia</span>
                  <span className="text-[#ef4444] font-bold whitespace-nowrap">Stop Anti-Deriva</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[#C5A059]/20 bg-[#11131c] px-3.5 py-2.5">
                  <span className="text-[#94a3b8]">I 5 Gradi di Ascesa</span>
                  <span className="text-[#10b981] font-bold whitespace-nowrap">Certificati On-Chain</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#C5A059]/15 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#94a3b8] whitespace-nowrap">
                Mandato Espansione
              </span>
              <span className="rounded bg-[#10b981]/15 border border-[#10b981]/35 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10b981] whitespace-nowrap">
                20% (30 € / mese)
              </span>
            </div>
          </section>
        </div>

        {/* Related Topic Pages Mesh */}
        <section className="rounded-2xl border border-[#C5A059]/20 bg-[#0d0f14] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#E8C56A]">
              {t("seo.related.heading")}
            </h2>
            <span className="font-mono text-[10px] text-[#94a3b8] whitespace-nowrap">
              ECOSISTEMA AUREUS
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {related.map((key) => (
              <li key={key}>
                <Link
                  href={seoPagePath(key, language)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#C5A059]/25 bg-[#11131c] px-4 py-3 font-mono text-xs font-bold text-[#F4F4F6] transition-all hover:border-[#C5A059] hover:text-[#E8C56A]"
                >
                  <span className="truncate">{t(`seo.${key}.eyebrow`)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#C5A059] shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Final Sovereign CTA */}
        <section className="rounded-2xl border border-[#C5A059]/40 bg-gradient-to-r from-[#11131c] via-[#0d0f14] to-[#11131c] p-8 text-center shadow-[0_0_25px_rgba(197,160,89,0.12)]">
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-white">
            {t(`${base}.cta.title`)}
          </h2>
          <p className="mx-auto mt-2.5 max-w-xl font-sans text-sm leading-relaxed text-[#94a3b8]">
            {t(`${base}.cta.body`)}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] bg-gradient-to-r from-[#9C772C] via-[#C5A059] to-[#E8C56A] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#07080b] shadow-[0_0_20px_rgba(197,160,89,0.25)] transition-all hover:brightness-110 whitespace-nowrap"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{t("landing.hero.start_free")}</span>
            </Link>
            <a
              href="mailto:assistenza@aureus-os.app"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059]/30 bg-[#07080b] px-5 py-3 font-mono text-xs font-bold text-[#E8C56A] hover:border-[#C5A059] transition-colors whitespace-nowrap"
            >
              <Mail className="h-4 w-4 text-[#C5A059]" aria-hidden="true" />
              <span>assistenza@aureus-os.app</span>
            </a>
          </div>
        </section>
      </main>

      {/* Sovereign SEO Footer with Full Internal Link Mesh */}
      <footer className="border-t border-[#C5A059]/20 bg-[#07080b] py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-xs text-[#94a3b8]">
            <Link href={landingPath(language)} className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
              {t("seo.nav.home")}
            </Link>
            {SEO_PAGE_KEYS.map((key) => (
              <Link
                key={key}
                href={seoPagePath(key, language)}
                className="hover:text-[#E8C56A] transition-colors whitespace-nowrap"
              >
                {t(`seo.${key}.eyebrow`)}
              </Link>
            ))}
            <Link href="/protocollo" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
              Protocollo
            </Link>
            <Link href="/verifica" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
              Verifica On-Chain
            </Link>
            <Link href="/privacy" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
              Termini
            </Link>
          </div>
          <div className="text-center font-mono text-[10px] text-[#94a3b8]/60">
            © {new Date().getFullYear()} AUREUS PROTOCOL (https://aureus-os.app) · IL CODICE DELLA PRESENZA E DELL&apos;EREDITÀ
          </div>
        </div>
      </footer>
    </div>
  );
}
