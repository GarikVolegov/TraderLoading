import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Stato di errore per una query fallita: distinto dall'empty state ("non hai
 * ancora dati"), che a un utente con dati reali farebbe pensare a una perdita.
 */
export function QueryErrorState({
  onRetry,
  className = "",
}: {
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center ${className}`}
    >
      <p className="text-sm font-medium">{t("common.load_error")}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {t("common.retry")}
      </Button>
    </div>
  );
}
