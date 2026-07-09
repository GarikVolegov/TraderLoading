import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchCreditTransactions, creditTransactionsKey } from "@/lib/creditsApi";

const KNOWN_REASONS = new Set(["purchase", "spend", "grant", "refund", "channel_sale", "chargeback"]);

// Collapsible credit ledger (transparency). Lazy-loaded on expand.
export function CreditActivity() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: creditTransactionsKey(),
    queryFn: fetchCreditTransactions,
    retry: false,
    enabled: open,
  });
  const txs = data?.transactions ?? [];

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline font-medium">
        {open ? t("credits.history_hide") : t("credits.history_show")}
      </button>
      {open &&
        (txs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("credits.history_empty")}</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {t(KNOWN_REASONS.has(tx.reason) ? `credits.tx.reason_${tx.reason}` : "credits.tx.reason_other")}
                  <span className="ml-1.5 opacity-60">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </span>
                <span className={`shrink-0 font-mono tabular-nums ${tx.delta >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {tx.delta >= 0 ? "+" : ""}
                  {tx.delta}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
