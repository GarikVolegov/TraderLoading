import { useEffect, useState } from "react";
import { LIMEN_MANIFESTO } from "../../../../../contracts/limenLexicon";
import { LIMEN_GRADES } from "../../../../../contracts/limenGrades";
import { SigilIcon } from "@/components/ui/SigilIcon";

const STORAGE_KEY = "limen.threshold_selection_pact.v1";
const OPEN_EVENT = "limen:open-threshold-manifesto";

export function openThresholdManifesto() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  }
}

export function hasAcceptedThresholdPact(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "accepted";
  } catch {
    return true;
  }
}

/**
 * A. Onboarding e Pagina d'Ingresso ("La Soglia di Selezione")
 *
 * Prima di accedere a Il Varco (Centro di Comando) al primo login, l'Operatore
 * attraversa La Soglia di Selezione:
 * 1. Visualizzazione de "Il Manifesto: Il Codice della Presenza e dell'Eredità"
 * 2. Il Patto di Ingresso: pulsante solenne "Accetto la Regola. Esco dalla Deriva."
 *    che sblocca ufficialmente il GRADO I — Il Neofita al Varco.
 */
export function ThresholdOfSelectionModal() {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const handleExplicitOpen = () => {
      setAcknowledged(hasAcceptedThresholdPact());
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handleExplicitOpen);

    // Check URL parameter ?soglia=1 or first-login state
    const params = new URLSearchParams(window.location.search);
    if (params.get("soglia") === "1") {
      setOpen(true);
    } else if (
      typeof navigator !== "undefined" &&
      !navigator.webdriver &&
      !hasAcceptedThresholdPact()
    ) {
      setOpen(true);
    }

    return () => {
      window.removeEventListener(OPEN_EVENT, handleExplicitOpen);
    };
  }, []);

  if (!open) return null;

  const gradeOne = LIMEN_GRADES[0];

  const handleAcceptPact = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore storage quota errors
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="limen-threshold-title"
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-[#0A0A0C]/95 p-4 backdrop-blur-md"
    >
      <div className="relative my-auto w-full max-w-3xl border border-[#C5A059]/45 bg-[#141418] p-6 text-[#F4F4F6] shadow-[0_24px_80px_rgba(0,0,0,0.85)] sm:p-10">
        {/* Top architectural gold rule */}
        <div className="mb-6 flex items-center justify-between border-b border-[#26262E] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-[#C5A059]/50 bg-[#0A0A0C] text-[#C5A059]">
              <SigilIcon variant="threshold" size={20} />
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-[#C5A059]">
                {LIMEN_MANIFESTO.gateTitle}
              </p>
              <p className="font-mono text-[10px] tracking-[0.16em] text-[#F4F4F6]/60">
                {LIMEN_MANIFESTO.manifestoSubheader}
              </p>
            </div>
          </div>
          <span className="border border-[#C5A059]/40 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C5A059]">
            {gradeOne.code}
          </span>
        </div>

        {/* Manifesto Title */}
        <h1
          id="limen-threshold-title"
          className="mb-5 font-serif text-xl font-bold uppercase tracking-[0.12em] text-[#F4F4F6] sm:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {LIMEN_MANIFESTO.manifestoHeader}
        </h1>

        {/* Manifesto Body */}
        <div className="space-y-3.5 border-l-2 border-[#C5A059]/45 pl-4 text-sm leading-relaxed text-[#F4F4F6]/85">
          {LIMEN_MANIFESTO.paragraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {/* 3 Architectural Pillars */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {LIMEN_MANIFESTO.pillars.map((pillar) => (
            <div
              key={pillar.label}
              className="border border-[#26262E] bg-[#0A0A0C] p-3.5"
            >
              <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#C5A059]">
                {pillar.label}
              </div>
              <p className="text-xs leading-relaxed text-[#F4F4F6]/75">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        {/* Grado I Unlock Preview */}
        <div className="mt-6 border border-[#26262E] bg-[#0A0A0C]/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <SigilIcon variant="sigil-grade-1" size={18} className="text-[#C5A059]" />
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#F4F4F6]">
                 INVESTITURA INIZIALE: {gradeOne.fullTitle}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8B1E1E]">
              Codice di Chiamata 20% BLOCCATO (Sblocco al Grado II)
            </span>
          </div>
          <p className="mt-2 text-xs text-[#F4F4F6]/70">
            Attraversando Il Varco sblocchi l&apos;accesso immediato a{" "}
            <strong className="text-[#F4F4F6]">L&apos;Ordine Giornaliero</strong>,{" "}
            <strong className="text-[#F4F4F6]">La Forgia del Passato</strong> e{" "}
            <strong className="text-[#F4F4F6]">La Dottrina del Tempo (Swing &amp; Scalp)</strong>.
          </p>
        </div>

        {/* Solemn Pact Confirmation */}
        <div className="mt-6 border-t border-[#26262E] pt-5">
          <label className="mb-4 flex cursor-pointer items-start gap-3 text-xs text-[#F4F4F6]/85">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#C5A059]"
            />
            <span>{LIMEN_MANIFESTO.pactDeclaration}</span>
          </label>

          <button
            type="button"
            disabled={!acknowledged}
            onClick={handleAcceptPact}
            className="flex min-h-12 w-full items-center justify-center gap-3 border border-[#C5A059] bg-[#C5A059] px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#0A0A0C] transition-all hover:bg-[#D4B475] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SigilIcon variant="threshold" size={16} />
            <span>{LIMEN_MANIFESTO.pactButtonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
