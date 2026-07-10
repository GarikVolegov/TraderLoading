import { useQuery, useMutation } from "@tanstack/react-query";
import { Banknote, Loader2, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchPayoutAccount,
  startPayoutOnboarding,
  fetchDashboardLink,
  payoutAccountKey,
} from "@/lib/payoutApi";

// Creator "receive payments" card (marketplace model). A creator onboards Stripe Connect
// so buyers can pay for their paid channels; Stripe pays them out on their connected
// account. No in-app cash-out — Stripe handles the money.
export function CreatorPayoutSettings() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: account } = useQuery({ queryKey: payoutAccountKey(), queryFn: fetchPayoutAccount, retry: false });

  const onboard = useMutation({
    mutationFn: startPayoutOnboarding,
    onSuccess: (r) => { if (r.url) window.location.href = r.url; },
    onError: () => toast({ description: t("payout.error"), variant: "destructive" }),
  });
  const dashboard = useMutation({
    mutationFn: fetchDashboardLink,
    onSuccess: (r) => { if (r.url) window.open(r.url, "_blank", "noopener"); },
    onError: () => toast({ description: t("payout.error"), variant: "destructive" }),
  });

  const ready = account?.onboarded && account?.payoutsEnabled;

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{t("payout.title")}</h2>
      </div>

      {ready ? (
        <>
          <p className="text-sm text-emerald-500 font-medium">{t("payout.ready")}</p>
          <button
            onClick={() => dashboard.mutate()}
            disabled={dashboard.isPending}
            className="w-full py-2.5 border border-border rounded-xl font-semibold text-sm hover:bg-secondary/40 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {dashboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {t("payout.dashboard_cta")}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("payout.onboard_hint")}</p>
          <button
            onClick={() => onboard.mutate()}
            disabled={onboard.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {onboard.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {account?.onboarded ? t("payout.finish_setup") : t("payout.onboard_cta")}
          </button>
        </>
      )}

      <p className="text-[10px] leading-snug text-muted-foreground">{t("payout.disclaimer")}</p>
    </div>
  );
}
