import { useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  Crosshair,
  Flame,
  Globe,
  Mail,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";
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
  "tradezella-vs-edgewonk",
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
  "tradezella-vs-edgewonk": {
    name: "TradeZella vs Edgewonk",
    priceRetail: "29-49 $/m (TZ) / 169 $/a (EW)",
    syncRetail: "Cloud Sync (TZ) / Manuale CSV (EW)",
    replayRetail: "Modulo Replay (TZ) / Assente (EW)",
    guardRetail: "Note post-loss (TZ) / Tiltmeter postumo (EW)",
    notaryRetail: "Assente su entrambi",
    arenaRetail: "Assenti su entrambi",
    monteCarloRetail: "Assente su entrambi",
    royaltyRetail: "0% Royalty (Solo referral standard)",
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
function PositionSizeCalculatorWidget() {
  const [balance, setBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [symbol, setSymbol] = useState<string>("EURUSD");
  const [stopLossPips, setStopLossPips] = useState<number>(20);
  const [takeProfitPips, setTakeProfitPips] = useState<number>(40);

  const ASSETS: Record<string, { label: string; pipValuePerLot: number; unitLabel: string }> = {
    EURUSD: { label: "EUR/USD (Forex Standard)", pipValuePerLot: 10, unitLabel: "Pips" },
    GBPUSD: { label: "GBP/USD (Forex Standard)", pipValuePerLot: 10, unitLabel: "Pips" },
    USDJPY: { label: "USD/JPY (Forex JPY)", pipValuePerLot: 6.7, unitLabel: "Pips" },
    XAUUSD: { label: "XAU/USD (Oro Spot)", pipValuePerLot: 10, unitLabel: "Pips ($0.10)" },
    US30: { label: "US30 (Dow Jones Index)", pipValuePerLot: 1, unitLabel: "Punti ($1)" },
    NAS100: { label: "NAS100 (Nasdaq Index)", pipValuePerLot: 1, unitLabel: "Punti ($1)" },
    BTCUSD: { label: "BTC/USD (Bitcoin Crypto)", pipValuePerLot: 1, unitLabel: "USD ($1)" },
  };

  const currentAsset = ASSETS[symbol] ?? ASSETS.EURUSD;
  const safeBalance = Math.max(100, Number.isFinite(balance) ? balance : 10000);
  const safeRiskPercent = Math.max(0.1, Math.min(10, Number.isFinite(riskPercent) ? riskPercent : 1.0));
  const safeSl = Math.max(1, Number.isFinite(stopLossPips) ? stopLossPips : 20);
  const safeTp = Math.max(1, Number.isFinite(takeProfitPips) ? takeProfitPips : 40);

  const monetaryRisk = (safeBalance * safeRiskPercent) / 100;
  const rawLot = monetaryRisk / (safeSl * currentAsset.pipValuePerLot);
  const recommendedLot = Math.max(0.01, Math.round(rawLot * 100) / 100);
  const potentialReward = recommendedLot * (safeTp * currentAsset.pipValuePerLot);
  const rrRatio = (safeTp / safeSl).toFixed(2);
  const isHighRisk = safeRiskPercent > 2.0;
  const isOptimalRisk = safeRiskPercent <= 1.0;

  return (
    <section className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] p-5 sm:p-7 shadow-[0_0_30px_rgba(197,160,89,0.1)] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/20 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold tracking-widest text-[#E8C56A] bg-[#C5A059]/15 border border-[#C5A059]/30 px-2 py-0.5 rounded">
            <Calculator className="h-3 w-3 text-[#C5A059]" />
            STRUMENTO PUBBLICO // CUSTODE DELLA SOGLIA
          </span>
          <h2 className="font-serif text-lg sm:text-2xl font-bold text-white mt-1.5">
            Calcolatore di Position Size &amp; Lotti Anti-Tilt
          </h2>
          <p className="text-xs text-[#94a3b8] mt-0.5 max-w-xl">
            Calcola la dimensione del lotto per Forex, Oro, Indici e Crypto con gestione scientifica del rischio.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 px-2.5 py-1 rounded">
          <ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" aria-hidden="true" />
          <span className="font-bold whitespace-nowrap">Formula R-Multiplo Certificata</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Balance */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#94a3b8] tracking-wider mb-1.5">
                Capitale del Conto ($ / €)
              </label>
              <input
                type="number"
                min={100}
                step={500}
                value={balance}
                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-[#C5A059]/30 bg-[#07080b] px-3.5 py-2 font-mono text-sm text-white focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            {/* Asset Selector */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#94a3b8] tracking-wider mb-1.5">
                Strumento Finanziario
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full rounded-xl border border-[#C5A059]/30 bg-[#07080b] px-3.5 py-2 font-mono text-xs text-white focus:border-[#C5A059] focus:outline-none"
              >
                {Object.entries(ASSETS).map(([sym, item]) => (
                  <option key={sym} value={sym} className="bg-[#07080b] text-white">
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Risk Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono uppercase text-[#94a3b8] tracking-wider">
                Rischio per Operazione: <span className="text-[#E8C56A] font-bold">{safeRiskPercent}%</span>
              </label>
              <div className="flex items-center gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                      safeRiskPercent === pct
                        ? "bg-[#C5A059] text-black border-[#C5A059] font-bold"
                        : "border-[#C5A059]/30 bg-[#07080b] text-[#94a3b8] hover:text-white"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={0.25}
              max={5.0}
              step={0.25}
              value={safeRiskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
              className="w-full accent-[#C5A059] cursor-pointer"
            />
          </div>

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#94a3b8] tracking-wider mb-1.5">
                Stop Loss ({currentAsset.unitLabel})
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={stopLossPips}
                onChange={(e) => setStopLossPips(parseFloat(e.target.value) || 1)}
                className="w-full rounded-xl border border-[#C5A059]/30 bg-[#07080b] px-3.5 py-2 font-mono text-sm text-white focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[#94a3b8] tracking-wider mb-1.5">
                Take Profit ({currentAsset.unitLabel})
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={takeProfitPips}
                onChange={(e) => setTakeProfitPips(parseFloat(e.target.value) || 1)}
                className="w-full rounded-xl border border-[#C5A059]/30 bg-[#07080b] px-3.5 py-2 font-mono text-sm text-white focus:border-[#C5A059] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Telemetry Output Bento */}
        <div className="lg:col-span-5 rounded-xl border border-[#C5A059]/25 bg-[#07080b] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block mb-1">
              RISULTATO DI CALIBRAZIONE
            </span>
            <div className="flex items-baseline justify-between border-b border-[#C5A059]/15 pb-3">
              <span className="text-xs font-sans text-white">Lotto Consigliato:</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-[#E8C56A] tracking-tight whitespace-nowrap">
                {recommendedLot} <span className="text-xs text-[#94a3b8] font-normal">Lotti</span>
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span>Rischio Monetario (-1R):</span>
              <span className="text-[#ef4444] font-bold whitespace-nowrap">-${monetaryRisk.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span>Rendimento Atteso (+{rrRatio}R):</span>
              <span className="text-[#10b981] font-bold whitespace-nowrap">+${potentialReward.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span>Rapporto Rischio/Rendimento:</span>
              <span className="text-white font-bold whitespace-nowrap">1 : {rrRatio}</span>
            </div>
          </div>

          {/* Anti-Tilt Telemetry Guard */}
          {isHighRisk ? (
            <div className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 p-2.5 text-[11px] text-[#ef4444] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Circuito Anti-Deriva:</strong> Rischio &gt; 2% per trade espone il capitale a rovina asimmetrica. Riduci l&apos;esposizione.
              </span>
            </div>
          ) : isOptimalRisk ? (
            <div className="rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 p-2.5 text-[11px] text-[#10b981] flex items-start gap-2">
              <Check className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Parametro Virtuoso:</strong> Rischio &le; 1% conforme ai Canoni d&apos;Integrità dell&apos;Ordine AUREUS.
              </span>
            </div>
          ) : null}

          <Link
            href="/sign-up"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E8C56A] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all hover:brightness-110 whitespace-nowrap"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Attiva il Custode su AUREUS OS (0 €)</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

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

        {/* Interactive Public Tool: Position Size & Anti-Tilt Calculator */}
        {page === "risk-tools" && <PositionSizeCalculatorWidget />}

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
