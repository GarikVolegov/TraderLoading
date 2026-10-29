import { useState } from "react";
import { Link } from "wouter";
import { ShieldAlert, ArrowRight, X } from "lucide-react";
import { useFinancialProfile } from "@/lib/financialProfileApi";
import { useFreeTrial } from "@/lib/useFreeTrial";
import { synestheticClick } from "@/lib/soundFx";

interface FinancialArchitectureBannerProps {
  className?: string;
}

export function FinancialArchitectureBanner({ className = "" }: FinancialArchitectureBannerProps) {
  const { data: profile } = useFinancialProfile();
  const { isFreeTrial } = useFreeTrial();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("aureus_dismiss_fin_banner") === "true";
    } catch {
      return false;
    }
  });

  // Se è attiva la prova gratuita, l'avviso è stato congedato o l'architettura patrimoniale è completata, non mostrare
  if (isFreeTrial || profile?.isCompleted || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    synestheticClick();
    setDismissed(true);
    try {
      localStorage.setItem("aureus_dismiss_fin_banner", "true");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="alert"
      className={`relative min-w-0 shrink-0 rounded-lg border border-[#C5A059]/30 bg-gradient-to-r from-[#141418] via-[#1A1814] to-[#141418] px-3 py-1.5 text-[#F4F4F6] shadow-sm flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldAlert className="h-4 w-4 shrink-0 text-[#C5A059]" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#C5A059] shrink-0 whitespace-nowrap hidden sm:inline">
          Architettura Patrimoniale:
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          Configura il fondo di riserva per completare le fondamenta di rischio.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/patrimonio"
          className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/50 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A] transition-all hover:bg-[#C5A059]/25 hover:border-[#C5A059] whitespace-nowrap"
        >
          <span>Configura</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Chiudi avviso architettura patrimoniale"
          title="Nascondi avviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
