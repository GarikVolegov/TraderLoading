import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { X, Plus, BarChart2 } from "lucide-react";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getPairLabel } from "@workspace/pair-catalog";
import { PairSelectionModal } from "@/components/PairSelectionModal";

export function PairPreferencesSettings() {
  const { selectedPairs, setSelectedPairs } = useBackground();
  // Both handlers using this mutation (remove/update pairs) already show
  // their own toast on catch — opt out of App.tsx's global mutation-error
  // toast to avoid a double toast.
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const removePair = async (symbol: string) => {
    const newPairs = selectedPairs.filter((p) => p !== symbol);
    if (newPairs.length === 0) {
      toast({
        description: "Devi avere almeno un pair selezionato.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPairs(newPairs);
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: newPairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Pair rimosso." });
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  const handleConfirm = async (pairs: string[]) => {
    setSelectedPairs(pairs);
    setShowModal(false);
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: pairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: "Pair aggiornati." });
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* Card header with count badge */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-indigo-500/15 shrink-0">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
              </div>
              Pair Preferiti
            </CardTitle>
            {selectedPairs.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                {selectedPairs.length} attivi
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Usati in tutta la dashboard: news, journal, calcolatori e analisi.
          </p>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Pair chips grid */}
          {selectedPairs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedPairs.map((sym) => (
                <span
                  key={sym}
                  className="inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-xl text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/25 min-h-[36px]"
                >
                  {getPairLabel(sym)}
                  <button
                    onClick={() => removePair(sym)}
                    aria-label={`Rimuovi ${sym}`}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-destructive/15 hover:text-destructive transition-colors ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-border/50 bg-secondary/20 text-center gap-2">
              <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground/60">
                Nessun pair selezionato
              </p>
              <p className="text-xs text-muted-foreground/40">
                Aggiungine almeno uno per personalizzare la dashboard
              </p>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-primary/30 text-sm font-medium text-primary hover:bg-primary/8 hover:border-primary/50 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            {selectedPairs.length > 0
              ? "Modifica pair selezionati"
              : "Scegli i tuoi pair"}
          </button>
        </CardContent>
      </Card>

      <PairSelectionModal
        open={showModal}
        onConfirm={handleConfirm}
        initialPairs={selectedPairs}
        dismissible
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// ─── Rewards Library Section ─────────────────────────────────────────────────
