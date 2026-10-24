import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  Layers,
  Calendar,
  TrendingUp,
  Shield,
  Activity,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import type { ProcessState } from "@/lib/traderProcessApi";

function formatPeriodDate(iso: string, lang: string): string {
  try {
    const parts = iso.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return new Intl.DateTimeFormat(lang, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    }
    return iso;
  } catch {
    return iso;
  }
}

/** One presentation for the server-owned priority, across every workspace. */
export function ProcessNextAction({
  state,
  action = true,
}: {
  state: ProcessState;
  action?: boolean;
}) {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const guidance = state.guidance;
  if (!guidance) return null;

  const protocol = state.activeMethod?.protocol;
  const minSamples = protocol?.minSamples;
  const eligible = state.progress.report.eligibleSamples;
  const incomplete = state.progress.report.incompleteSamples;
  const pct = minSamples ? Math.min(100, Math.round((eligible / minSamples) * 100)) : null;
  const checks = state.progress.checks ?? [];
  const phase = state.progress.phase;

  // Phase Title Helper
  const phaseNames: Record<string, string> = {
    define: "Fase I · Fondazione",
    verify: "Fase II · La Forgia",
    apply: "Fase III · Il Varco",
    consolidate: "Fase IV · Libro della Verità",
  };

  return (
    <section
      className="process-next-step space-y-6 rounded-2xl border border-[#C5A059]/35 bg-gradient-to-b from-[#101117] via-[#0C0D12] to-[#08080B] p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      aria-label={copy("next")}
    >
      {/* ── HEADER ROW ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/20 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_8px_#D4AF37]" />
          <p className="process-eyebrow font-mono text-[11px] font-bold text-[#D4AF37] uppercase tracking-[0.2em]">
            {copy("next")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            {phaseNames[phase] ?? phase}
          </span>
          {pct != null && (
            <span className="rounded-md border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#D4AF37]">
              {pct}% VALIDATO
            </span>
          )}
        </div>
      </div>

      {/* ── HERO ACTION & CTA ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pt-1">
        <div className="space-y-2 max-w-2xl">
          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {copy(guidance.action)}
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {copy(guidance.reason)}
          </p>
          {guidance.nextAvailableAt && (
            <div className="pt-1">
              <span className="inline-block rounded border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 font-mono text-xs text-[#D4AF37]">
                {guidance.nextAvailableAt}
              </span>
            </div>
          )}
        </div>

        {action && guidance.action !== "done" && (
          <div className="shrink-0 pt-2 lg:pt-0">
            <Link
              href={guidance.href}
              className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6CA65] to-[#C5A059] px-6 py-3 font-mono text-xs font-black text-[#0A0A0C] uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all"
            >
              <span>{copy(guidance.action === "collect_evidence" ? "recordTest" : guidance.action)}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* ── CRITERI E REQUISITI DI FASE (ORGANIZZATI PULITI) ── */}
      {checks.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider border-t border-border/40 pt-4">
            <span className="text-[#C5A059] font-bold">Criteri & Requisiti di Fase</span>
            <span>
              {checks.filter((c) => c.met).length} / {checks.length} Soddisfatti
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checks.map((check) => {
              const isSamples = check.key === "samples";
              const isPeriod = check.key === "period";
              const isExpectancy = check.key === "expectancy";
              const isDrawdown = check.key === "drawdown";

              // Icon per tipo di controllo
              const icon = isSamples ? (
                <Layers className="h-4 w-4" />
              ) : isPeriod ? (
                <Calendar className="h-4 w-4" />
              ) : isExpectancy ? (
                <TrendingUp className="h-4 w-4" />
              ) : isDrawdown ? (
                <Shield className="h-4 w-4" />
              ) : check.met ? (
                <Check className="h-4 w-4" />
              ) : (
                <Activity className="h-4 w-4" />
              );

              // Valore in evidenza
              let displayValue = check.label;
              let subtitle = check.detail;

              if (isSamples && protocol) {
                displayValue = `${eligible} / ${protocol.minSamples} Evidenze`;
                subtitle =
                  incomplete > 0
                    ? `${incomplete} incomplete da finalizzare prima dell'avanzamento.`
                    : `${eligible} valide registrate per il campione minimo.`;
              } else if (isPeriod && protocol) {
                displayValue = `${formatPeriodDate(protocol.periodStart, language)} — ${formatPeriodDate(protocol.periodEnd, language)}`;
                subtitle = check.met
                  ? "Periodo di test concluso."
                  : "Finestra di test attiva e in osservazione.";
              } else if (isExpectancy && protocol) {
                const currentExp =
                  state.progress.report.expectancyR != null
                    ? `${state.progress.report.expectancyR.toFixed(2)} R`
                    : "— R";
                displayValue = `${currentExp} (Target ≥ ${protocol.minExpectancyR} R)`;
                subtitle = "Rendimento medio netto per unità di rischio.";
              } else if (isDrawdown && protocol) {
                const currentDd =
                  state.progress.report.drawdownR != null
                    ? `${state.progress.report.drawdownR.toFixed(2)} R`
                    : "0.00 R";
                displayValue = `${currentDd} (Limite ≤ ${protocol.maxDrawdownR} R)`;
                subtitle = "Massima flessione negativa cumulata registrata.";
              }

              return (
                <div
                  key={check.key}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                    check.met
                      ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                      : "border-border/60 bg-[#12131A]/90 hover:border-[#C5A059]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            check.met
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30"
                          }`}
                        >
                          {icon}
                        </div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {check.label}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          check.met
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30"
                        }`}
                      >
                        {check.met ? "Soddisfatto" : "In Corso"}
                      </span>
                    </div>

                    <div className="font-mono text-sm font-bold text-foreground">
                      {displayValue}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {subtitle}
                    </p>
                  </div>

                  {isSamples && minSamples != null && (
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden border border-[#C5A059]/20">
                        <div
                          className="h-full bg-gradient-to-r from-[#C5A059] to-[#10B981] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((eligible / minSamples) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
