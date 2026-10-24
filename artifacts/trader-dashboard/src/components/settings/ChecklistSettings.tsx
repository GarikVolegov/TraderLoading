import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";
import { useGetChecklist, useCreateChecklistItem, useDeleteChecklistItem, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";

export function ChecklistSettings() {
  const { data: items, isLoading } = useGetChecklist();
  const [newText, setNewText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const suppress = { mutation: { meta: { suppressGlobalError: true } } };
  const createMutation = useCreateChecklistItem(suppress);
  const deleteMutation = useDeleteChecklistItem(suppress);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: { text: newText.trim(), completed: false },
      });
      setNewText("");
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      toast({ title: "Regola aggiunta al Custode della Soglia" });
    } catch {
      toast({ description: "Errore durante l'aggiunta", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
      toast({ title: "Regola rimossa" });
    } catch {
      toast({ description: "Errore durante la rimozione", variant: "destructive" });
    }
  };

  const activeCount = items?.length ?? 0;

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
      {/* Header and Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Il Custode della Soglia (Guardrail Pre-Trade)
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              I criteri inviolabili che devi convalidare prima di qualsiasi esecuzione a mercato.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-[#E8C56A] self-start sm:self-center">
          <span>{activeCount} {activeCount === 1 ? "Regola Attiva" : "Regole Attive"}</span>
        </span>
      </div>

      {/* Add New Rule input */}
      <div className="rounded-xl border border-[#C5A059]/20 bg-[#11131c]/70 p-3.5 space-y-2">
        <label className="text-[11px] font-mono uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          Nuova Regola di Convalida
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="es. HTF allineato, Nessuna notizia ad alto impatto entro 30 min..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 bg-[#07080b] border-[#C5A059]/30 font-mono text-xs text-[#F4F4F6] focus:border-[#C5A059]"
          />
          <Button
            onClick={handleAdd}
            disabled={!newText.trim() || createMutation.isPending}
            className="bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono text-xs font-bold px-4"
          >
            <Plus className="w-4 h-4 mr-1 text-black" />
            Aggiungi
          </Button>
        </div>
      </div>

      {/* Checklist items list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#26262E] bg-[#07080b]/90 hover:border-[#C5A059]/35 hover:bg-[#11131c]/60 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <span className="font-mono text-[10px] font-bold text-[#C5A059]/70 shrink-0 w-5">
                  #{String(idx + 1).padStart(2, "0")}
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#10b981]/70 shrink-0" />
                <p className="text-xs font-mono text-[#F4F4F6] truncate">
                  {item.text}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="text-[#ef4444] hover:bg-[#ef4444]/10 hover:text-[#ef4444] opacity-70 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#26262E] bg-[#07080b]/60 p-8 text-center space-y-1">
          <ShieldAlert className="w-6 h-6 text-[#C5A059]/60 mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">{uiText("auto.ui.dfb6f163d7")}</p>
          <p className="text-[11px] font-mono text-muted-foreground/60">{uiText("auto.ui.83fe33d1ef")}</p>
        </div>
      )}
    </div>
  );
}
