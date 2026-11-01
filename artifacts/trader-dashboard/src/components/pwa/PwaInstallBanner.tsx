import { useState, useEffect } from "react";
import { Download, Share, PlusSquare, X, Smartphone, Check } from "lucide-react";
import { usePwaStandalone } from "@/lib/usePwaStandalone";
import { synestheticClick } from "@/lib/soundFx";

const DISMISS_KEY = "aureus_pwa_banner_dismissed_v1";

export function PwaInstallBanner() {
  const { isStandalone, isInstallable, isIos, hasInstalled, promptInstall } = usePwaStandalone();
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = window.localStorage.getItem(DISMISS_KEY) === "true";
      setDismissed(isDismissed);
    }
  }, []);

  // Non mostrare nulla se già in modalità standalone, installata, o ignorata dall'operatore
  if (isStandalone || hasInstalled || dismissed) {
    return null;
  }

  // Mostra solo se l'app è installabile direttamente (Android/Desktop) oppure su iOS (Safari)
  if (!isInstallable && !isIos) {
    return null;
  }

  const handleDismiss = () => {
    synestheticClick();
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "true");
    }
  };

  const handleInstallClick = async () => {
    synestheticClick();
    setIsInstalling(true);
    try {
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Installazione AUREUS OS Standalone"
      className="relative mx-3 my-2 rounded-xl border border-[#C5A059]/35 bg-[#07080b]/95 p-3 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.6)] z-40 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A]">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]">
                PWA Standalone
              </span>
              <span className="font-mono text-[10px] text-slate-400">100% Schermo Intero</span>
            </div>
            <h4 className="text-xs font-semibold text-white mt-0.5">
              Installa AUREUS OS come App Nativa
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Chiudi avviso installazione"
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-300">
        {isInstallable ? (
          <>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Rimuovi le barre del browser per massima reattività e fluidità nei grafici.
            </p>
            <button
              type="button"
              disabled={isInstalling}
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#C5A059] bg-[#C5A059] px-3.5 py-1.5 font-mono text-[11px] font-bold text-[#07080b] uppercase tracking-wider shadow-[0_0_15px_rgba(197,160,89,0.25)] hover:bg-[#E8C56A] transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Installa App</span>
            </button>
          </>
        ) : (
          <div className="w-full flex items-center gap-2 text-[11px] text-slate-400 leading-relaxed">
            <span>Per visualizzare a schermo intero su iOS:</span>
            <span className="inline-flex items-center gap-1 font-mono text-white bg-white/5 border border-white/10 px-1.5 py-0.5 rounded whitespace-nowrap">
              <Share className="h-3 w-3 text-[#E8C56A]" /> Condividi
            </span>
            <span>→</span>
            <span className="inline-flex items-center gap-1 font-mono text-white bg-white/5 border border-white/10 px-1.5 py-0.5 rounded whitespace-nowrap">
              <PlusSquare className="h-3 w-3 text-[#E8C56A]" /> Aggiungi a Home
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
