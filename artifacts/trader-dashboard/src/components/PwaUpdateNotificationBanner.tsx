import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import {
  AUREUS_UPDATE_EVENT,
  applyPendingUpdate,
  isPendingUpdateAvailable,
} from "@/lib/pwaAutoUpdater";

export function PwaUpdateNotificationBanner() {
  const [hasUpdate, setHasUpdate] = useState<boolean>(() => isPendingUpdateAvailable());
  const [dismissed, setDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const onUpdateAvailable = () => {
      setHasUpdate(true);
      setDismissed(false);
    };

    window.addEventListener(AUREUS_UPDATE_EVENT, onUpdateAvailable);
    return () => {
      window.removeEventListener(AUREUS_UPDATE_EVENT, onUpdateAvailable);
    };
  }, []);

  if (!hasUpdate || dismissed) {
    return null;
  }

  const handleUpdateClick = () => {
    setIsApplying(true);
    applyPendingUpdate();
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] rounded-xl border border-[#C5A059]/40 bg-[#0d0f14]/95 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shrink-0 mt-0.5">
            <Sparkles size={14} className="animate-pulse" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="text-xs font-semibold text-[#F4F4F6] tracking-wide uppercase font-serif">
                Nuovo Allineamento
              </strong>
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                AUREUS OS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Una nuova forgiatura del software è pronta. Sincronizza ora per applicare le ottimizzazioni.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
          aria-label="Chiudi notifica"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          Più tardi
        </button>
        <button
          type="button"
          onClick={handleUpdateClick}
          disabled={isApplying}
          className="px-3 py-1 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080B] font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_2px_10px_rgba(197,160,89,0.3)] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={12} className={isApplying ? "animate-spin" : ""} />
          <span>{isApplying ? "Sincronizzazione..." : "Aggiorna Ora"}</span>
        </button>
      </div>
    </aside>
  );
}
