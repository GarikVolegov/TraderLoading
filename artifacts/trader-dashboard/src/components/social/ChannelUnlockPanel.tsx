import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Lock, Loader2, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { unlockChannel, channelAccessKey } from "@/lib/channelAccessApi";
import { creditWalletKey } from "@/lib/creditsApi";
import type { ChannelType } from "./types";

// Shown in the content area when the viewer selects a locked paid channel. Presents
// the price + access model and an unlock/subscribe button that spends credits.
export function ChannelUnlockPanel({ channel }: { channel: ChannelType }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const price = channel.priceCredits ?? 0;
  const isSubscription = channel.accessModel === "subscription";
  const days = channel.subscriptionPeriodDays ?? 0;

  const unlock = useMutation({
    mutationFn: () => unlockChannel(channel.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", channel.communityId] });
      qc.invalidateQueries({ queryKey: channelAccessKey(channel.id) });
      qc.invalidateQueries({ queryKey: creditWalletKey() });
    },
  });

  const status = (unlock.error as { status?: number } | null)?.status;
  const insufficient = status === 402;

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="tl-panel rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-base">{channel.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isSubscription
              ? t("channel.access.subscription_desc", { credits: price, days })
              : t("channel.access.one_time_desc", { credits: price })}
          </p>
        </div>

        <button
          onClick={() => unlock.mutate()}
          disabled={unlock.isPending}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {unlock.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Coins className="w-4 h-4" />
          )}
          {isSubscription
            ? t("channel.access.subscribe_cta", { credits: price })
            : t("channel.access.unlock_cta", { credits: price })}
        </button>

        {insufficient ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive">{t("channel.access.insufficient")}</p>
            <button
              onClick={() => navigate("/settings")}
              className="text-xs text-primary hover:underline font-medium"
            >
              {t("channel.access.buy_credits")}
            </button>
          </div>
        ) : unlock.isError ? (
          <p className="text-xs text-destructive">{t("channel.access.error")}</p>
        ) : null}

        <p className="text-[10px] leading-snug text-muted-foreground">{t("credits.disclaimer")}</p>
      </div>
    </div>
  );
}
