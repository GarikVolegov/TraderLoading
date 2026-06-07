import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChecklist,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  getGetChecklistQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Checklist() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [newText, setNewText] = useState("");
  const { data: items, isLoading } = useGetChecklist();
  const createMutation = useCreateChecklistItem();
  const deleteMutation = useDeleteChecklistItem();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({ data: { text: newText.trim() } });
      setNewText("");
      invalidate();
    } catch {
      toast({ description: t("checklist.error_add"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    invalidate();
  };

  const total = items?.length ?? 0;

  return (
    <PageLayout>
      <PageHeader
        title="Criteri di Conferma"
        subtitle="I requisiti che devi soddisfare prima di entrare in ogni trade"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {t("checklist.add_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="flex gap-2 sm:gap-3">
            <Input
              placeholder={t("checklist.add_placeholder")}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={!newText.trim() || createMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t("checklist.add_button")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium mb-1">Nessun criterio definito</p>
              <p className="text-sm text-muted-foreground">Aggiungi i criteri che devi verificare prima di entrare in ogni trade</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="divide-y divide-border/50">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-4 p-4 group hover:bg-secondary/20 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />

                    <span className="flex-1 text-sm font-medium text-foreground">
                      {item.text}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {total} {total === 1 ? "criterio" : "criteri"} di conferma — spuntali nella Dashboard prima di ogni entrata
        </p>
      )}
    </PageLayout>
  );
}
