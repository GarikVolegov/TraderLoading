import { useState } from "react";
import { Link } from "wouter";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { Button } from "@/components/ui/button";
import { Lock, BookOpen, Compass } from "lucide-react";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";
import type { LimenTierId } from "../../../../../contracts/limenServices";

interface LimenServiceLockGateProps {
  serviceId:
    | "forge_of_the_past"
    | "financial_architecture"
    | "doctrine_of_time"
    | "quarterly_tournaments";
  onConfigureClick?: () => void;
}

const SERVICE_META = {
  forge_of_the_past: {
    title: "La Forgia del Passato (Banco di Forgiatura)",
    priceBadge: "Promo 14 Giorni · 2,60 € (poi 10 €/m o 100 €/a)",
    description:
      "Modulo di addestramento nell'ombra e simulatore replay candela per candela. Incluso insieme all'Architettura Patrimoniale nel Piano Dotazione Operativa.",
    defaultTierId: "founders_10" as LimenTierId,
  },
  financial_architecture: {
    title: "Architettura Patrimoniale & Fondamenta di Rischio",
    priceBadge: "Promo 14 Giorni · 2,60 € (poi 10 €/m o 100 €/a)",
    description:
      "Modulo di gestione del capitale e barriere matematiche di drawdown. Incluso insieme alla Forgia del Passato nel Piano Dotazione Operativa.",
    defaultTierId: "founders_10" as LimenTierId,
  },
  doctrine_of_time: {
    title: "La Dottrina del Tempo & Finestra Operativa",
    priceBadge: "Progetto Completo · 150 €/mese o 1.500 €/anno",
    description:
      "Accademia video d'Ordine, studio dei cicli orari bancari, Finestra Operativa e Concilio della Domenica. Richiede l'abilitazione al Progetto Completo.",
    defaultTierId: "complete_150" as LimenTierId,
  },
  quarterly_tournaments: {
    title: "Le Prove del Fuoco (Tornei Trimestrali)",
    priceBadge: "Progetto Completo · Fase Avanzata d'Onore",
    description:
      "I Tornei Trimestrali sono competizioni ad alto rigore riservate al Progetto Completo e ai gradi avanzati dell'Ordine.",
    defaultTierId: "complete_150" as LimenTierId,
  },
} as const;

export function LimenServiceLockGate({
  serviceId,
  onConfigureClick,
}: LimenServiceLockGateProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const meta = SERVICE_META[serviceId];
  const { status, hasApplication, candidateCode } = useLimenEntitlements();

  const handleAction = () => {
    if (onConfigureClick) {
      onConfigureClick();
    } else {
      setModalOpen(true);
    }
  };

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center p-4 text-center">
      <div className="relative w-full max-w-xl rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] p-8 shadow-[0_20px_70px_rgba(0,0,0,0.85)]">
        {/* Architectural Sigil Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-[#C5A059]/50 bg-[#07080b] text-[#C5A059] shadow-[0_0_25px_rgba(197,160,89,0.2)]">
          <Lock className="h-6 w-6 stroke-[2]" />
        </div>

        {/* Status chip */}
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="rounded border border-[#C5A059]/40 bg-[#C5A059]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
            {meta.priceBadge}
          </span>
          {hasApplication && (
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                status === "in_valutazione"
                  ? "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border border-[#475569]/40 bg-[#1e293b]/20 text-[#94a3b8]"
              }`}
            >
              {status === "in_valutazione"
                ? "Candidatura in Valutazione"
                : `Stato: ${status}`}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-serif text-xl font-bold tracking-wide text-[#F4F4F6] sm:text-2xl">
          {meta.title}
        </h2>

        {/* Short description (1-2 lines) */}
        <p className="mt-3 text-xs leading-relaxed text-[#94a3b8]">
          {meta.description}
        </p>

        {hasApplication && candidateCode && (
          <p className="mt-2 font-mono text-[11px] text-[#C5A059]/80">
            Candidatura Registrata: <strong className="text-white">{candidateCode}</strong>
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-[#C5A059]/20">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="border-[#C5A059]/40 bg-[#07080b] text-xs font-mono font-semibold uppercase tracking-wider text-[#C5A059] hover:bg-[#C5A059]/15"
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              Torna al Varco
            </Button>
          </Link>

          <Link href="/journal">
            <Button
              variant="outline"
              size="sm"
              className="border-[#475569] bg-[#11131c] text-xs font-mono font-semibold uppercase tracking-wider text-[#F4F4F6] hover:bg-[#161822]"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Il Libro della Verità
            </Button>
          </Link>

          <Button
            size="sm"
            onClick={handleAction}
            className="bg-[#C5A059] text-xs font-mono font-bold uppercase tracking-wider text-[#07080b] hover:bg-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.3)] transition-all cursor-pointer"
          >
            Richiedi Dotazione
          </Button>
        </div>
      </div>

      <LimenCandidacyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTierId={meta.defaultTierId}
      />
    </div>
  );
}
