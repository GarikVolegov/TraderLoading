import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Lock, Loader2, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { unlockChannel, fetchChannelAccess, channelAccessKey } from "@/lib/channelAccessApi";
import { creditWalletKey } from "@/lib/creditsApi";
import type { ChannelType } from "./types";

// Shown in the content area when the viewer selects a locked paid channel. Fetches the
// authoritative access state (fresh price/model) and offers an unlock/subscribe button
// that spends credits — passing the shown price so the server rejects a stale charge.
export function ChannelUnlockPanel({ channel }: { channel: ChannelType }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  // Fresh, server-authoritative price/model (the channel prop can be up to ~10s stale).
  const { data: access } = useQuery({
    queryKey: channelAccessKey(channel.id),
    queryFn: () => fetchChannelAccess(channel.id),
    staleTime: 0,
  });

  const price = access?.priceCredits ?? channel.priceCredits ?? 0;
  const isSubscription = (access?.accessModel ?? channel.accessModel) === "subscription";
  const days = access?.subscriptionPeriodDays ?? channel.subscriptionPeriodDays ?? 0;

  const unlock = useMutation({
    mutationFn: () => unlockChannel(channel.id, price),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", channel.communityId] });
      qc.invalidateQueries({ queryKey: channelAccessKey(channel.id) });
      qc.invalidateQueries({ queryKey: creditWalletKey() });
    },
    onError: (err) => {
      // A concurrent price change (409) — refresh the shown price so the retry is honest.
      if ((err as { status?: number })?.status === 409) {
        qc.invalidateQueries({ queryKey: channelAccessKey(channel.id) });
        qc.invalidateQueries({ queryKey: ["community", channel.communityId] });
      }
    },
  });

  const status = (unlock.error as { status?: number } | null)?.status;
  const insufficient = status === 402;
  const priceChanged = status === 409;
  // Keep the button disabled after success too — it re-enables before the panel unmounts.
  const busy = unlock.isPending || unlock.isSuccess;

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
          disabled={busy}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {busy ? (
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
              onClick={() => navigate("/settings?section=abbonamento")}
              className="text-xs text-primary hover:underline font-medium"
            >
              {t("channel.access.buy_credits")}
            </button>
          </div>
        ) : priceChanged ? (
          <p className="text-xs text-destructive">{t("channel.access.price_changed")}</p>
        ) : unlock.isError ? (
          <p className="text-xs text-destructive">{t("channel.access.error")}</p>
        ) : null}

        <p className="text-[10px] leading-snug text-muted-foreground">{t("credits.disclaimer")}</p>
      </div>
    </div>
  );
}
