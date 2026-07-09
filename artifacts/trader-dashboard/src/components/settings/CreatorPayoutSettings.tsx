import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { fetchCreditWallet, creditWalletKey } from "@/lib/creditsApi";
import {
  fetchPayoutConfig,
  fetchPayoutAccount,
  startPayoutOnboarding,
  requestPayout,
  estimateNet,
  payoutConfigKey,
  payoutAccountKey,
} from "@/lib/payoutApi";

// Creator cash-out card (sub-project D). Hidden entirely unless payouts are configured
// (dark by default). Shows onboarding when the Connect account isn't ready, else a
// request form converting earned credits into a real Stripe Transfer.
export function CreatorPayoutSettings() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [credits, setCredits] = useState("");

  const { data: config } = useQuery({ queryKey: payoutConfigKey(), queryFn: fetchPayoutConfig, retry: false });
  const enabled = config?.enabled === true;

  const { data: account } = useQuery({ queryKey: payoutAccountKey(), queryFn: fetchPayoutAccount, retry: false, enabled });
  const { data: wallet } = useQuery({ queryKey: creditWalletKey(), queryFn: fetchCreditWallet, retry: false, enabled });

  const onboard = useMutation({
    mutationFn: startPayoutOnboarding,
    onSuccess: (r) => { if (r.url) window.location.href = r.url; },
    onError: () => toast({ description: t("payout.error"), variant: "destructive" }),
  });

  const cashOut = useMutation({
    mutationFn: () => requestPayout(parseInt(credits) || 0),
    onSuccess: () => {
      setCredits("");
      qc.invalidateQueries({ queryKey: creditWalletKey() });
      toast({ description: t("payout.requested") });
    },
    onError: (err) => {
      const code = (err as { status?: number })?.status;
      toast({ description: code === 402 ? t("payout.insufficient") : t("payout.error"), variant: "destructive" });
    },
  });

  // Dark by default: render nothing until the operator configures payouts.
  if (!config || !enabled) return null;

  const balance = wallet?.balance ?? 0;
  const ready = account?.onboarded && account?.payoutsEnabled;
  const creditsNum = parseInt(credits) || 0;
  const belowMin = creditsNum < config.minCredits;
  const overBalance = creditsNum > balance;

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{t("payout.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("payout.balance", { n: balance })}</p>

      {!ready ? (
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
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("payout.credits_label", { min: config.minCredits })}
            </span>
            <input
              type="number"
              min={config.minCredits}
              step={1}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder={String(config.minCredits)}
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            />
          </label>
          {creditsNum > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("payout.estimate", { amount: estimateNet(creditsNum, config).toFixed(2), currency: config.currency.toUpperCase() })}
            </p>
          )}
          <button
            onClick={() => cashOut.mutate()}
            disabled={cashOut.isPending || belowMin || overBalance}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {cashOut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("payout.cash_out")}
          </button>
        </>
      )}

      <p className="text-[10px] leading-snug text-muted-foreground">{t("payout.disclaimer")}</p>
    </div>
  );
}
