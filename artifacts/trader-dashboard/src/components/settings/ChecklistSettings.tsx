import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useGetChecklist, useCreateChecklistItem, useDeleteChecklistItem, getGetChecklistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";

export function ChecklistSettings() {
  const { data: items, isLoading } = useGetChecklist();
  const [newText, setNewText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  // Each handler's own catch already shows its own toast below — opt out of
  // App.tsx's global mutation-error toast to avoid a double toast.
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
      toast({ title: "Elemento aggiunto" });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
    } catch {
      toast({ description: "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">
          Aggiungi elemento
        </label>
        <div className="flex gap-2">
          <Input
            placeholder={uiText("auto.ui.cba892ec78")}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newText.trim()} size="sm">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          Caricamento...
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border group hover:bg-secondary/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground">{item.text}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>{uiText("auto.ui.dfb6f163d7")}</p>
          <p className="text-xs mt-1">{uiText("auto.ui.83fe33d1ef")}</p>
        </div>
      )}
    </div>
  );
}
