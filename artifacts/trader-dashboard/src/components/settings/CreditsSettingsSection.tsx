import { useQuery, useMutation } from "@tanstack/react-query";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCreditWallet,
  fetchCreditPacks,
  startCreditCheckout,
  creditWalletKey,
  creditPacksKey,
} from "@/lib/creditsApi";

// In-app credit wallet (sub-project B). Shows the balance + buy-credit packs that
// redirect to Stripe Checkout. Packs with no configured Stripe price are hidden,
// so the section reads "coming soon" until the feature is switched on.
export function CreditsSettingsSection() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: wallet } = useQuery({ queryKey: creditWalletKey(), queryFn: fetchCreditWallet, retry: false });
  const { data: packsData, isLoading } = useQuery({ queryKey: creditPacksKey(), queryFn: fetchCreditPacks, retry: false });

  const checkout = useMutation({
    mutationFn: startCreditCheckout,
    onSuccess: (r) => {
      if (r.url) window.location.href = r.url;
      else toast({ description: t("credits.unavailable"), variant: "destructive" });
    },
    onError: () => toast({ description: t("credits.unavailable"), variant: "destructive" }),
  });

  const packs = (packsData?.packs ?? []).filter((p) => p.priceConfigured);

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{t("credits.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("credits.balance", { n: wallet?.balance ?? 0 })}</p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : packs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("credits.coming_soon")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {packs.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate(p.id)}
              className="flex h-auto flex-col gap-0.5 py-3"
            >
              <span className="font-mono text-lg font-black tabular-nums">{p.credits}</span>
              <span className="text-[10px] text-muted-foreground">{t("credits.buy")}</span>
            </Button>
          ))}
        </div>
      )}

      <p className="text-[10px] leading-snug text-muted-foreground">{t("credits.disclaimer")}</p>
    </div>
  );
}
