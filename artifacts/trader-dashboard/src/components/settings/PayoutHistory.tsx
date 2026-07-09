import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchPayoutHistory, payoutHistoryKey } from "@/lib/payoutApi";

const KNOWN_STATUS = new Set(["pending", "paid", "failed", "refunded"]);

// Collapsible payout history (transparency). Lazy-loaded on expand.
export function PayoutHistory() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: payoutHistoryKey(),
    queryFn: fetchPayoutHistory,
    retry: false,
    enabled: open,
  });
  const payouts = data?.payouts ?? [];

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline font-medium">
        {open ? t("payout.history_hide") : t("payout.history_show")}
      </button>
      {open &&
        (payouts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("payout.history_empty")}</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {(p.netCents / 100).toFixed(2)} {p.currency.toUpperCase()}
                  <span className="ml-1.5 opacity-60">{new Date(p.createdAt).toLocaleDateString()}</span>
                </span>
                <span className="shrink-0 font-medium">
                  {t(KNOWN_STATUS.has(p.status) ? `payout.status_${p.status}` : "payout.status_pending")}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
