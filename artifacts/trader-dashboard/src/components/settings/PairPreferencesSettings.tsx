import { useState } from "react";
import { X, Plus, BarChart2, Coins } from "lucide-react";
import { useSavePairs } from "@/hooks/useSavePairs";
import { uiText } from "@/contexts/LanguageContext";
import { useBackground } from "@/contexts/BackgroundContext";
import { useToast } from "@/hooks/use-toast";
import { getPairLabel } from "@workspace/pair-catalog";
import { PairSelectionModal } from "@/components/PairSelectionModal";

export function PairPreferencesSettings() {
  const { selectedPairs } = useBackground();
  const { save, saving, failed } = useSavePairs();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const removePair = async (symbol: string) => {
    const newPairs = selectedPairs.filter((p) => p !== symbol);
    if (newPairs.length === 0) {
      toast({
        description: "Devi mantenere almeno un asset monitorato.",
        variant: "destructive",
      });
      return;
    }
    if (await save(newPairs)) toast({ description: "Asset rimosso dalla selezione." });
  };

  const handleConfirm = async (pairs: string[]) => {
    if (await save(pairs)) {
      setShowModal(false);
      toast({ description: "Asset eletti aggiornati con successo." });
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
        {/* Header with counter badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
                Asset & Mercati Eletti
              </h3>
              <p className="text-xs font-mono text-muted-foreground/80">
                Strumenti primari utilizzati in tutto il cockpit (News, Journal, Forgia e Analisi).
              </p>
            </div>
          </div>

          {selectedPairs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-[#E8C56A] self-start sm:self-center">
              <span>{selectedPairs.length} {selectedPairs.length === 1 ? "Asset Attivo" : "Asset Attivi"}</span>
            </span>
          )}
        </div>

        {failed && !showModal && (
          <p role="alert" className="text-xs font-mono text-[#ef4444] bg-[#ef4444]/10 p-2.5 rounded-lg border border-[#ef4444]/30">
            {uiText("pairs.save_error")}
          </p>
        )}

        {/* Pair chips grid */}
        {selectedPairs.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedPairs.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#07080b] text-[#E8C56A] border border-[#C5A059]/35 min-h-[36px] shadow-sm"
              >
                <span>{getPairLabel(sym)}</span>
                <button
                  disabled={saving}
                  onClick={() => removePair(sym)}
                  aria-label={`Rimuovi ${sym}`}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground/60 hover:bg-[#ef4444]/20 hover:text-[#ef4444] transition-colors ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-[#C5A059]/25 bg-[#07080b]/60 text-center gap-2">
            <BarChart2 className="w-8 h-8 text-[#C5A059]/40" />
            <p className="text-xs font-mono text-muted-foreground">
              Nessun asset primario configurato
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/60">
              Seleziona gli asset che intendi presenziare quotidianamente.
            </p>
          </div>
        )}

        {/* Action button */}
        <button
          disabled={saving}
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-[#C5A059]/40 bg-[#07080b] text-xs font-mono font-semibold text-[#E8C56A] hover:bg-[#C5A059]/10 hover:border-[#C5A059] active:scale-[0.99] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-[#C5A059]" />
          <span>{selectedPairs.length > 0 ? "Modifica Asset Selezionati" : "Configura i Tuoi Mercati"}</span>
        </button>
      </div>

      <PairSelectionModal
        open={showModal}
        onConfirm={handleConfirm}
        initialPairs={selectedPairs}
        saving={saving}
        failed={failed}
        dismissible
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
