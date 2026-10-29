import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Globe,
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Scale,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  canDisplayProbabilities,
  type DirectionalOutlook,
  type DirectionalBiasResult,
} from "@/lib/marketIntelligenceApi";

export function DirectionalOutlookPanel({
  outlook,
  directionalBias,
  pair,
  now,
  fresh,
}: {
  outlook?: DirectionalOutlook | null;
  directionalBias?: DirectionalBiasResult | null;
  pair: string;
  now: number;
  fresh: boolean;
}) {
  const { t, language } = useLanguage();
  const [showMacroBreakdown, setShowMacroBreakdown] = useState(false);
  const available = fresh && canDisplayProbabilities(outlook, pair, now);

  const number = (v: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 5 }).format(v);
  const time = (stamp: string) =>
    Number.isFinite(Date.parse(stamp))
      ? new Intl.DateTimeFormat(language, {
          timeZone: "Europe/Rome",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(stamp))
      : "—";

  const h4Bias = directionalBias?.h4MasterBias ?? "NEUTRAL";
  const edgeTier = directionalBias?.edgeTier ?? "NEUTRAL_WAIT";
  const isTierAPlus = edgeTier === "TIER_A_PLUS";
  const isTierQuality = edgeTier === "TIER_QUALITY";
  const isCounterTrend = edgeTier === "COUNTER_TREND_WARNING";

  return (
    <section
      className="context-surface intelligence-outlook rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/95 p-3.5 shadow-lg"
      aria-label={t("intelligence.outlook")}
      data-testid="directional-outlook"
    >
      {/* ── HEADER ARCHITETTONICO AUREUS ── */}
      <header className="flex items-start justify-between gap-3 border-b border-[#C5A059]/15 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-1.5 py-0.5 rounded whitespace-nowrap">
              {pair} · H4 MASTER BIAS
            </span>
            <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
              8.5y Backtest Validated
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Direzionalità Sovrana & Matrice Macro</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isCounterTrend ? (
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-[#C5A059]" />
          )}
        </div>
      </header>

      {/* ── TELEMETRIA H4 MASTER & TIER DI VALIDAZIONE ── */}
      {directionalBias ? (
        <div className="mt-3 space-y-2.5">
          {/* Badge Grande Stato H4 */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
              h4Bias === "BULLISH"
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : h4Bias === "BEARISH"
                ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                : "bg-zinc-900/60 border-zinc-700/50 text-zinc-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${
                  h4Bias === "BULLISH"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : h4Bias === "BEARISH"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-zinc-700/30 text-zinc-400"
                }`}
              >
                {h4Bias === "BULLISH" ? (
                  <ArrowUpRight size={18} />
                ) : h4Bias === "BEARISH" ? (
                  <ArrowDownRight size={18} />
                ) : (
                  <Minus size={16} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    BIAS {h4Bias}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                    Confidenza {directionalBias.confidenceScore}%
                  </span>
                </div>
                <div className="text-[11px] text-zinc-300 line-clamp-1">
                  {directionalBias.recommendedAction}
                </div>
              </div>
            </div>

            {/* Edge Tier Chip */}
            <div className="text-right shrink-0">
              <span
                className={`font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${
                  isTierAPlus
                    ? "bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 shadow-[0_0_8px_rgba(197,160,89,0.25)]"
                    : isTierQuality
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : isCounterTrend
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {isTierAPlus
                  ? "TIER A+ (+1.29R)"
                  : isTierQuality
                  ? "TIER QUALITY (+0.58R)"
                  : isCounterTrend
                  ? "ANTI-FADE GUARD (-0.13R)"
                  : "ATTESA NEUTRALE"}
              </span>
            </div>
          </div>

          {/* Allerta Fading Contro-Trend */}
          {directionalBias.antiFadeProtected && (
            <div className="p-2 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-[11px] flex items-center gap-2">
              <ShieldAlert size={14} className="shrink-0 text-rose-400" />
              <span className="whitespace-nowrap font-medium">
                Protezione Contro-Trend Attiva: vietato vendere/comprare contro il Daily HTF (-0.13R storico).
              </span>
            </div>
          )}

          {/* ── I 3 ORIZZONTI: MATRICE MULTI-TIMEFRAME (W1 · D1 · H4) ── */}
          <div className="grid grid-cols-3 gap-2">
            {(["w1", "d1", "h4"] as const).map((tfKey) => {
              const tf = directionalBias.timeframes[tfKey];
              const isBull = tf.direction === "BULLISH";
              const isBear = tf.direction === "BEARISH";
              return (
                <div
                  key={tfKey}
                  className="rounded-lg border border-[#C5A059]/20 bg-[#11131c]/70 p-2 text-center"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-1 border-b border-white/5">
                    <span className="font-bold text-zinc-200">{tf.timeframe}</span>
                    <span
                      className={`px-1 py-0.2 rounded font-bold whitespace-nowrap ${
                        isBull
                          ? "text-emerald-400"
                          : isBear
                          ? "text-rose-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {tf.direction}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">P/D:</span>
                      <span
                        className={`font-mono font-semibold whitespace-nowrap ${
                          tf.rangeZone === "DISCOUNT"
                            ? "text-emerald-400"
                            : tf.rangeZone === "PREMIUM"
                            ? "text-rose-400"
                            : "text-amber-400"
                        }`}
                      >
                        {tf.rangeZone} ({(tf.rangePercentile * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">SMA:</span>
                      <span className="font-mono text-zinc-300 whitespace-nowrap">
                        {tf.priceVsSma}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── LIVELLI CHIAVE DI LIQUIDITÀ & EQUILIBRIO ── */}
          <div className="p-2 rounded-lg border border-white/10 bg-[#11131c]/40 grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Equilibrio 50%:</span>
              <strong className="text-zinc-200 whitespace-nowrap">
                ${directionalBias.timeframes.h4.equilibrium50.toFixed(2)}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Algorithmic OTE (0.786):</span>
              <strong className="text-[#E8C56A] whitespace-nowrap">
                ${directionalBias.timeframes.h4.algorithmic786.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* ── I 4 FATTORI MACRO + COT (COLLAPSIBLE) ── */}
          <div className="rounded-lg border border-[#C5A059]/20 bg-[#11131c]/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMacroBreakdown(!showMacroBreakdown)}
              className="w-full flex items-center justify-between p-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Globe size={13} className="text-[#C5A059]" />
                <span>I 4 Fattori Macroeconomici & Posizionamento COT</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
                    directionalBias.macroScore > 10
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : directionalBias.macroScore < -10
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      : "bg-zinc-800 text-zinc-300 border-zinc-700"
                  }`}
                >
                  Score: {directionalBias.macroScore > 0 ? `+${directionalBias.macroScore}` : directionalBias.macroScore}
                </span>
                {showMacroBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {showMacroBreakdown && (
              <div className="p-2.5 pt-1 space-y-2 border-t border-white/5 text-[11px]">
                {Object.values(directionalBias.macroFactors).map((factor) => (
                  <div
                    key={factor.factor}
                    className="flex items-start justify-between gap-2 p-1.5 rounded bg-black/20 border border-white/5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <strong className="font-semibold text-zinc-200 whitespace-nowrap">
                          {factor.title}
                        </strong>
                        <span
                          className={`font-mono text-[9px] uppercase font-bold px-1 rounded whitespace-nowrap ${
                            factor.status === "BULLISH"
                              ? "text-emerald-400 bg-emerald-950/50"
                              : factor.status === "BEARISH"
                              ? "text-rose-400 bg-rose-950/50"
                              : "text-zinc-400 bg-zinc-800"
                          }`}
                        >
                          {factor.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                        {factor.summary}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[#E8C56A] shrink-0 whitespace-nowrap">
                      {factor.score > 0 ? `+${factor.score}` : factor.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── OUTLOOK PROBABILISTICO STORICO (SE DISPONIBILE) ── */}
      {available && outlook?.probabilities && (
        <details className="mt-3 text-xs text-muted-foreground border-t border-white/5 pt-2">
          <summary className="cursor-pointer py-1 font-semibold text-zinc-300 hover:text-white flex items-center justify-between">
            <span>Probabilità ML Intraday ({pair} 4h)</span>
            <span className="font-mono text-[10px] text-zinc-400">Modello Confermato</span>
          </summary>
          <div className="intelligence-probabilities mt-2">
            {(
              [
                { key: "up", Icon: ArrowUpRight },
                { key: "flat", Icon: Minus },
                { key: "down", Icon: ArrowDownRight },
              ] as const
            ).map(({ key, Icon }) => (
              <div key={key} className={`intelligence-probability intelligence-${key}`}>
                <span className="flex items-center gap-1 text-xs">
                  <Icon size={14} />
                  {t(`intelligence.${key}`)}
                </span>
                <strong className="font-mono text-xl whitespace-nowrap">
                  {new Intl.NumberFormat(language, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(outlook.probabilities![key])}
                </strong>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            {t("intelligence.target")} {time(outlook.targetEnd)} · {t("intelligence.timezone")}
          </p>
        </details>
      )}
    </section>
  );
}
