import { Link } from "wouter";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { useFinancialProfile } from "@/lib/financialProfileApi";
import { useFreeTrial } from "@/lib/useFreeTrial";

interface FinancialArchitectureBannerProps {
  className?: string;
}

export function FinancialArchitectureBanner({ className = "" }: FinancialArchitectureBannerProps) {
  const { data: profile } = useFinancialProfile();
  const { isFreeTrial } = useFreeTrial();

  // Se è attiva la prova gratuita o l'architettura patrimoniale è già stata validata e completata, non mostrare il banner
  if (isFreeTrial || profile?.isCompleted) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`relative min-w-0 shrink-0 rounded-xl border border-[#C5A059]/40 bg-gradient-to-r from-[#141418] via-[#1A1814] to-[#141418] p-4 sm:p-5 text-[#F4F4F6] shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                Prerequisito di Metodo LIMEN
              </span>
              <span className="rounded bg-[#8B1E1E]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#ef4444] border border-[#8B1E1E]">
                Setup Obbligatorio
              </span>
            </div>
            <h4
              className="text-sm sm:text-base font-bold uppercase tracking-wide text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Architettura Patrimoniale & Fondamenta di Rischio
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Il trading non inizia dal grafico, ma dalla struttura finanziaria sottostante. La tenuta psicologica a mercato richiede un fondo di riserva adeguato e un conto di trading equilibrato rispetto al tuo patrimonio totale.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center self-start md:self-center">
          <Link
            href="/patrimonio"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#C5A059] bg-[#C5A059] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#0A0A0C] transition-all hover:bg-[#d8b56f] hover:shadow-[0_0_15px_rgba(197,160,89,0.3)]"
          >
            <span>Configura Architettura</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
