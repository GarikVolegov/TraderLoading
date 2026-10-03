import { useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importTradesCsv } from "@/lib/journalImportApi";

/** Import a broker-statement CSV into the coach. Imported rows land in the
 *  account-trades set (source="manual") that feeds the Panoramica / edge, so a
 *  full query invalidation refreshes those views. */
export function CsvImportButton() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: importTradesCsv,
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast({ title: t("journal.import.done", { imported: r.imported, skipped: r.skipped }) });
    },
    onError: () => toast({ description: t("journal.import.error"), variant: "destructive" }),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const text = await file.text();
    if (!text.trim()) {
      toast({ description: t("journal.import.empty"), variant: "destructive" });
      return;
    }
    mutation.mutate(text);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <Button
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {t("journal.import.button")}
      </Button>
    </>
  );
}
