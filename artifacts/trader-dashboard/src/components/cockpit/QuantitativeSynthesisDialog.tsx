import React, { useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  Activity,
  Scale,
  Calendar,
  Globe,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Zap,
  Clock,
  Sparkles,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { IntelligenceContext } from "@/lib/marketIntelligenceApi";
import { useLanguage } from "@/contexts/LanguageContext";

interface QuantitativeSynthesisDialogProps {
  market: string;
  data: IntelligenceContext | undefined;
  onOpenNews?: () => void;
  onOpenPlan?: () => void;
}

export function QuantitativeSynthesisDialog({
  market,
  data,
  onOpenNews,
  onOpenPlan,
}: QuantitativeSynthesisDialogProps) {
  const { t, language } = useLanguage();
  const [showCotHistory, setShowCotHistory] = useState(false);

  // Number formatters
  const fmt = (n: number | null | undefined, maxDec = 2) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return new Intl.NumberFormat(language, {
      maximumFractionDigits: Math.abs(n) < 1 ? 5 : maxDec,
    }).format(n);
  };

  const fmtInt = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return new Intl.NumberFormat(language, {
      maximumFractionDigits: 0,
    }).format(n);
  };

  const fmtCompact = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${abs.toFixed(0)}`;
  };

  // Extract core analytics
  const score = data?.score ?? null;
  const coverage = data?.coverage ?? 0;
  const disagreement = Boolean(data?.disagreement);
  const directionalBias = data?.directionalBias;
  const h4Bias = directionalBias?.h4MasterBias ?? "NEUTRAL";
  const edgeTier = directionalBias?.edgeTier ?? "NEUTRAL_WAIT";

  const isBullishScore = score != null && score > 15;
  const isBearishScore = score != null && score < -15;

  const components = data?.components ?? [];
  const priceComp = components.find((c) => c.id === "price");
  const newsComp = components.find((c) => c.id === "news");
  const retailComp = components.find((c) => c.id === "retail");
  const cotComp = components.find((c) => c.id === "cot");

  // Price history
  const points = data?.priceHistory ?? [];
  const lowPrice = points.length ? Math.min(...points.map((p) => p.close)) : 0;
  const highPrice = points.length ? Math.max(...points.map((p) => p.close)) : 0;
  const priceSpan = highPrice - lowPrice || 1;
  const lastClose = data?.price ?? (points.at(-1)?.close ?? 0);
  const changePct = data?.priceChangePct ?? 0;
  const startDate = points[0]?.time.slice(0, 10) ?? "—";
  const endDate = points.at(-1)?.time.slice(0, 10) ?? "—";

  // Volatility & ADR
  const ranges = data?.ranges ?? [];
  const rangePercent = data?.rangePercent ?? null;

  // COT Reports
  const cotReports = data?.cotReports ?? [];
  const latestCot = cotReports[0];

  // Calendar & High Impact Events
  const events = data?.events ?? [];
  const evidenceNews = data?.news ?? [];

  // Sparkline SVG path
  const svgWidth = 600;
  const svgHeight = 76;
  const padY = 8;
  const usableHeight = svgHeight - padY * 2;
  const sparklinePath = points.length > 1
    ? points
        .map((p, i) => {
          const x = (i / (points.length - 1)) * svgWidth;
          const y = padY + usableHeight - ((p.close - lowPrice) / priceSpan) * usableHeight;
          return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : "";

  return (
    <div className="space-y-4">
      {/* ── BANNER DISAGREEMENT / ALLERTA DIVERGENZA ── */}
      {disagreement && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="leading-snug">
            <strong className="font-semibold block text-amber-200">
              Divergenza Rilevata nei Fattori Quantitativi
            </strong>
            <span className="text-[11px] text-amber-300/90">
              Contrasto tra la struttura di prezzo e il posizionamento istituzionale o macro. Procedere con rigore e attendere conferme sui timeframe minori.
            </span>
          </div>
        </div>
      )}

      {/* ── QUADRO DIREZIONALE SOVRANO (SCORE COMPOSITO & H4 MASTER BIAS) ── */}
      <section className="rounded-xl border border-[#C5A059]/30 bg-gradient-to-b from-[#11131c] via-[#0d0f14] to-[#07080b] p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C5A059]/20 pb-3.5">
          {/* Punteggio Sovrano */}
          <div className="flex items-center gap-3.5">
            <div
              className={`flex items-center justify-center w-14 h-14 rounded-xl font-mono text-2xl font-bold tracking-tight shadow-md border ${
                isBullishScore
                  ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                  : isBearishScore
                  ? "bg-rose-950/50 border-rose-500/40 text-rose-300"
                  : "bg-zinc-900/60 border-[#C5A059]/30 text-[#E8C56A]"
              }`}
            >
              {score != null ? (score > 0 ? `+${score}` : String(score)) : "—"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                  Punteggio Sovrano AUREUS
                </span>
                <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                  Copertura {coverage}%
                </span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>
                  {score == null
                    ? "Acquisizione Telemetria in corso..."
                    : isBullishScore
                    ? "Consenso Istituzionale Rialzista (Bullish Bias)"
                    : isBearishScore
                    ? "Pressione Istituzionale Ribassista (Bearish Bias)"
                    : "Equilibrio Direzionale Neutrale (Consolidamento)"}
                </span>
              </h3>
            </div>
          </div>

          {/* Master H4 Bias & Edge Tier */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`px-3 py-1.5 rounded-lg border flex flex-col items-center justify-center min-w-[100px] ${
                h4Bias === "BULLISH"
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : h4Bias === "BEARISH"
                  ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  : "bg-zinc-900/60 border-zinc-700/50 text-zinc-300"
              }`}
            >
              <span className="text-[9px] font-mono uppercase text-zinc-400 tracking-wider">H4 Master Bias</span>
              <strong className="text-xs font-mono font-bold tracking-wider">{h4Bias}</strong>
            </div>

            <div
              className={`px-3 py-1.5 rounded-lg border flex flex-col items-center justify-center min-w-[110px] ${
                edgeTier === "TIER_A_PLUS"
                  ? "bg-[#C5A059]/15 border-[#C5A059]/40 text-[#F3D88C]"
                  : edgeTier === "TIER_QUALITY"
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                  : edgeTier === "COUNTER_TREND_WARNING"
                  ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                  : "bg-zinc-900/50 border-white/10 text-zinc-400"
              }`}
            >
              <span className="text-[9px] font-mono uppercase text-zinc-400 tracking-wider">Edge Tier</span>
              <strong className="text-xs font-mono font-bold tracking-wider">
                {edgeTier === "TIER_A_PLUS"
                  ? "TIER A+"
                  : edgeTier === "TIER_QUALITY"
                  ? "TIER QUALITY"
                  : edgeTier === "COUNTER_TREND_WARNING"
                  ? "CONTRO-TREND"
                  : "NEUTRALE"}
              </strong>
            </div>
          </div>
        </div>

        {/* Breakdown dei 4 Sotto-Fattori Ponderati */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5">
          {/* 1. Prezzo / Trend */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 uppercase">
              <span>1. Prezzo / Trend</span>
              <span className="text-zinc-500">35%</span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <strong
                className={`font-mono text-base font-bold whitespace-nowrap ${
                  priceComp?.score != null && priceComp.score > 0
                    ? "text-emerald-400"
                    : priceComp?.score != null && priceComp.score < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
                }`}
              >
                {priceComp?.score != null
                  ? (priceComp.score > 0 ? `+${priceComp.score}` : String(priceComp.score))
                  : "—"}
              </strong>
              <span className="text-[9px] text-zinc-400 font-mono">Struttura & EMA</span>
            </div>
          </div>

          {/* 2. Macro & Catalizzatori */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 uppercase">
              <span>2. Macro & News</span>
              <span className="text-zinc-500">30%</span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <strong
                className={`font-mono text-base font-bold whitespace-nowrap ${
                  newsComp?.score != null && newsComp.score > 0
                    ? "text-emerald-400"
                    : newsComp?.score != null && newsComp.score < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
                }`}
              >
                {newsComp?.score != null
                  ? (newsComp.score > 0 ? `+${newsComp.score}` : String(newsComp.score))
                  : "—"}
              </strong>
              <span className="text-[9px] text-zinc-400 font-mono whitespace-nowrap">
                {events.length} eventi oggi
              </span>
            </div>
          </div>

          {/* 3. Retail Sentiment */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 uppercase">
              <span>3. Sentiment Retail</span>
              <span className="text-zinc-500">15%</span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <strong
                className={`font-mono text-base font-bold whitespace-nowrap ${
                  retailComp?.score != null && retailComp.score > 0
                    ? "text-emerald-400"
                    : retailComp?.score != null && retailComp.score < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
                }`}
              >
                {retailComp?.score != null
                  ? (retailComp.score > 0 ? `+${retailComp.score}` : String(retailComp.score))
                  : "—"}
              </strong>
              <span className="text-[9px] text-zinc-400 font-mono">Contrarian Signal</span>
            </div>
          </div>

          {/* 4. Posizionamento COT */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 uppercase">
              <span>4. Report COT CFTC</span>
              <span className="text-zinc-500">20%</span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <strong
                className={`font-mono text-base font-bold whitespace-nowrap ${
                  latestCot?.nonCommNet != null && latestCot.nonCommNet > 0
                    ? "text-emerald-400"
                    : latestCot?.nonCommNet != null && latestCot.nonCommNet < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
                }`}
              >
                {fmtCompact(latestCot?.nonCommNet)}
              </strong>
              <span className="text-[9px] text-zinc-400 font-mono whitespace-nowrap">Non-Comm Net</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVELLO 1: TREND PREZZO D1 & VOLATILITÀ ADR (DUE COLONNE ARMONIZZATE) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* COLONNA 1: PREZZO D1 & SPARKLINE AUREA */}
        <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C5A059]" />
                <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  Struttura Prezzo D1 · {points.length} Sedute
                </h4>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <strong className="text-zinc-100 font-bold whitespace-nowrap">
                  {fmt(lastClose)}
                </strong>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                    changePct >= 0
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Sparkline AUREUS */}
            <div className="relative mt-3 h-[76px] w-full">
              {points.length > 1 ? (
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible"
                  role="img"
                  aria-label={`Prezzo D1 ${points.length} osservazioni`}
                >
                  <defs>
                    <linearGradient id="sintesi-gold-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C5A059" stopOpacity="0.32" />
                      <stop offset="70%" stopColor="#C5A059" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#C5A059" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${sparklinePath} L${svgWidth},${svgHeight} L0,${svgHeight} Z`}
                    fill="url(#sintesi-gold-gradient)"
                  />
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke="#C5A059"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  Storico D1 non disponibile
                </div>
              )}
            </div>
          </div>

          {/* Metadati di Rilevazione Prezzo (Distanziati e non incollati) */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#C5A059]/15 text-[10px] font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Inizio:</span>
              <span className="text-zinc-300 font-medium whitespace-nowrap">{startDate}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-zinc-500">
              <span>Min: <strong className="text-zinc-200 font-mono">{fmt(lowPrice)}</strong></span>
              <span>·</span>
              <span>Max: <strong className="text-zinc-200 font-mono">{fmt(highPrice)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Oggi:</span>
              <span className="text-zinc-300 font-medium whitespace-nowrap">{endDate}</span>
            </div>
          </div>
        </div>

        {/* COLONNA 2: VOLATILITÀ & AVERAGE DAILY RANGE (ADR) */}
        <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#C5A059]" />
                <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  Volatilità Media & Range ADR
                </h4>
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-1.5 py-0.5 rounded whitespace-nowrap">
                Mataf Standard D1
              </span>
            </div>

            {/* Gauge Saturazione ADR Odierno */}
            <div className="mt-2.5 p-2.5 rounded-lg bg-[#11131c]/90 border border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Escursione Odierna Consumata:</span>
                <strong
                  className={`font-mono text-xs font-bold whitespace-nowrap ${
                    rangePercent != null && rangePercent > 85
                      ? "text-rose-400"
                      : rangePercent != null && rangePercent > 65
                      ? "text-[#E8C56A]"
                      : "text-emerald-400"
                  }`}
                >
                  {rangePercent != null ? `${rangePercent}% dell'ADR 20D` : "Rilevazione in corso"}
                </strong>
              </div>
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden mt-1.5 border border-white/5">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    rangePercent != null && rangePercent > 85
                      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                      : rangePercent != null && rangePercent > 65
                      ? "bg-[#C5A059] shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                      : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, rangePercent ?? 20))}%` }}
                />
              </div>
            </div>

            {/* Griglia Comparativa Multi-Timeframe ADR */}
            <div className="grid grid-cols-5 gap-1.5 mt-2.5">
              {[5, 22, 66, 132, 252].map((days, i) => {
                const r = ranges.find((row) => row.days === days);
                const label = ["1W", "1M", "3M", "6M", "1Y"][i];
                return (
                  <div
                    key={days}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-black/35 border border-white/5 text-center"
                  >
                    <span className="font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider">
                      {label}
                    </span>
                    <strong className="mt-1 font-mono text-xs font-bold text-zinc-100 whitespace-nowrap">
                      {r?.value != null ? fmt(r.value) : "—"}
                    </strong>
                    <span className="mt-0.5 text-[8px] font-mono text-zinc-500 whitespace-nowrap">
                      {r ? `${r.samples}/${days}` : "—"} barre
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-2.5 text-[10px] text-zinc-500 italic leading-snug">
            Misura l'ampiezza dell'escursione statistica per calibrare target e stop; non esprime direzione.
          </p>
        </div>
      </div>

      {/* ── LIVELLO 2: POSIZIONAMENTO CFTC COT & CATALIZZATORI MACRO (DUE COLONNE) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* COLONNA 1: CFTC COT POSITIONING */}
        <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#C5A059]" />
                <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  Posizionamento Istituzionale CFTC COT
                </h4>
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-1.5 py-0.5 rounded whitespace-nowrap">
                CFTC · Settimanale
              </span>
            </div>

            {latestCot ? (
              <div className="mt-3 space-y-2.5">
                {/* Header Dati e Data Report */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-100 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      {latestCot.currency}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                      Report Ufficiale: {latestCot.date}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      latestCot.status === "stale"
                        ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                        : "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                    }`}
                  >
                    {latestCot.status === "stale" ? "STALE" : "CONFERMATO"}
                  </span>
                </div>

                {/* 3 Card Istituzionali */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  {/* Non-Commercial (Fondi Speculativi) */}
                  <div className="p-2 rounded-lg bg-black/40 border border-[#C5A059]/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] text-[#E8C56A] uppercase font-bold tracking-wider block">
                        Fondi Speculativi
                      </span>
                      <span className="text-[7px] text-zinc-500 uppercase block">Non-Commercial</span>
                    </div>
                    <strong
                      className={`text-xs font-bold mt-1.5 block whitespace-nowrap ${
                        latestCot.nonCommNet >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {latestCot.nonCommNet >= 0 ? "+" : ""}
                      {fmtInt(latestCot.nonCommNet)}
                    </strong>
                    <div className="flex items-center justify-between text-[8px] text-zinc-400 mt-1 pt-1 border-t border-white/5">
                      <span>L: {fmtCompact(latestCot.nonCommLong)}</span>
                      <span>S: {fmtCompact(latestCot.nonCommShort)}</span>
                    </div>
                  </div>

                  {/* Commercials (Coperture Hedgers) */}
                  <div className="p-2 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider block">
                        Commercials
                      </span>
                      <span className="text-[7px] text-zinc-500 uppercase block">Coperture Hedge</span>
                    </div>
                    <strong
                      className={`text-xs font-bold mt-1.5 block whitespace-nowrap ${
                        latestCot.commNet >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {latestCot.commNet >= 0 ? "+" : ""}
                      {fmtInt(latestCot.commNet)}
                    </strong>
                    <div className="flex items-center justify-between text-[8px] text-zinc-400 mt-1 pt-1 border-t border-white/5">
                      <span>L: {fmtCompact(latestCot.commLong)}</span>
                      <span>S: {fmtCompact(latestCot.commShort)}</span>
                    </div>
                  </div>

                  {/* Non-Reportable (Retail) */}
                  <div className="p-2 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider block">
                        Retail
                      </span>
                      <span className="text-[7px] text-zinc-500 uppercase block">Non-Reportable</span>
                    </div>
                    <strong
                      className={`text-xs font-bold mt-1.5 block whitespace-nowrap ${
                        latestCot.retailNet >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {latestCot.retailNet >= 0 ? "+" : ""}
                      {fmtInt(latestCot.retailNet)}
                    </strong>
                    <div className="flex items-center justify-between text-[8px] text-zinc-400 mt-1 pt-1 border-t border-white/5">
                      <span>L: {fmtCompact(latestCot.retailLong)}</span>
                      <span>S: {fmtCompact(latestCot.retailShort)}</span>
                    </div>
                  </div>
                </div>

                {/* Storico a tendina */}
                {latestCot.history && latestCot.history.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowCotHistory((prev) => !prev)}
                      className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg border border-[#C5A059]/20 bg-[#C5A059]/5 hover:bg-[#C5A059]/10 text-xs text-[#E8C56A] font-medium transition-colors"
                    >
                      <span>Evoluzione Settimanale Recente ({latestCot.history.length} report)</span>
                      {showCotHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showCotHistory && (
                      <div className="mt-2 p-2 rounded-lg bg-black/50 border border-white/10 overflow-x-auto">
                        <table className="w-full text-[10px] font-mono text-zinc-300 text-right">
                          <thead>
                            <tr className="border-b border-white/10 text-zinc-500 text-[9px] uppercase">
                              <th className="text-left pb-1">Data</th>
                              <th className="pb-1">Speculatori Net</th>
                              <th className="pb-1">Hedger Net</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {latestCot.history
                              .slice()
                              .reverse()
                              .slice(0, 5)
                              .map((h) => (
                                <tr key={h.date} className="hover:bg-white/5">
                                  <td className="text-left py-1 text-zinc-400">{h.date}</td>
                                  <td
                                    className={`py-1 font-bold ${
                                      h.nonCommNet >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {h.nonCommNet >= 0 ? "+" : ""}
                                    {fmtInt(h.nonCommNet)}
                                  </td>
                                  <td
                                    className={`py-1 ${
                                      h.commNet >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {h.commNet >= 0 ? "+" : ""}
                                    {fmtInt(h.commNet)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/10 text-center text-xs text-zinc-500">
                Report COT non disponibile per {market}
              </div>
            )}
          </div>

          <p className="mt-2.5 text-[10px] text-zinc-500 italic leading-snug">
            Pubblicazione CFTC differita di 3 giorni rispetto al cutoff martedì.
          </p>
        </div>

        {/* COLONNA 2: CATALIZZATORI MACRO & CALENDARIO ECONOMICO */}
        <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#C5A059]/15">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#C5A059]" />
                <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  Catalizzatori Macro & Calendario
                </h4>
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded whitespace-nowrap">
                Alto Impatto
              </span>
            </div>

            {/* Eventi di Oggi */}
            <div className="mt-3 space-y-2">
              {events.length > 0 ? (
                events.map((e, idx) => {
                  const eventDate = new Date(e.date);
                  const timeFormatted = Number.isFinite(eventDate.getTime())
                    ? new Intl.DateTimeFormat("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Rome",
                      }).format(eventDate)
                    : "—";

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#11131c]/90 border border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {timeFormatted}
                        </span>
                        <div className="min-w-0">
                          <strong className="text-zinc-200 block truncate text-xs">
                            {e.title}
                          </strong>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {e.country} · Alto Impatto
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] font-mono uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded whitespace-nowrap">
                        Oggi
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-center text-xs text-zinc-400">
                  Nessun evento ad alto impatto programmato per le prossime 24 ore su {market}.
                </div>
              )}

              {/* Rilevazioni News Direzionali se presenti */}
              {evidenceNews.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Notizie Macro Rilevanti ({evidenceNews.length})
                  </span>
                  <div className="space-y-1.5">
                    {evidenceNews.slice(0, 2).map((item, nIdx) => (
                      <a
                        key={nIdx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded bg-black/40 border border-white/5 hover:border-[#C5A059]/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-300 group-hover:text-[#E8C56A] truncate">
                            {item.title}
                          </span>
                          <span
                            className={`text-[8px] font-mono uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              item.direction > 0
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"
                            }`}
                          >
                            {item.direction > 0 ? "+BULLISH" : "-BEARISH"}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">
                          {item.source} · {item.theme}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Link rapidi solenni */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#C5A059]/15 text-xs font-medium">
            {onOpenNews ? (
              <button
                type="button"
                onClick={onOpenNews}
                className="text-[#E8C56A] hover:text-[#F3D88C] flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Calendario Macro Integrato</span>
                <ArrowUpRight size={13} />
              </button>
            ) : (
              <Link
                href="/journal?t=piano&vista=agenda"
                className="text-[#E8C56A] hover:text-[#F3D88C] flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <span>Calendario Completo</span>
                <ArrowUpRight size={13} />
              </Link>
            )}

            <Link
              href="/?vista=notizie"
              className="text-[#E8C56A] hover:text-[#F3D88C] flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <span>Tutte le Notizie</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
