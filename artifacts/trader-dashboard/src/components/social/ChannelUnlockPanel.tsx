import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Loader2, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { startChannelCheckout, fetchChannelAccess, channelAccessKey } from "@/lib/channelAccessApi";
import type { ChannelType } from "./types";

// Shown when the viewer selects a locked paid channel. Fetches the authoritative price
// and starts a Stripe Checkout (Connect) — the creator is paid directly, entitlement is
// granted on the webhook when the payment completes.
export function ChannelUnlockPanel({ channel }: { channel: ChannelType }) {
  const { t } = useLanguage();

  const { data: access } = useQuery({
    queryKey: channelAccessKey(channel.id),
    queryFn: () => fetchChannelAccess(channel.id),
    staleTime: 0,
  });

  const priceCents = access?.priceCents ?? channel.priceCents ?? 0;
  const currency = (access?.currency ?? channel.currency ?? "eur").toUpperCase();
  const isSubscription = (access?.accessModel ?? channel.accessModel) === "subscription";
  const interval = access?.subInterval ?? channel.subInterval ?? "month";
  const amount = (priceCents / 100).toFixed(2);

  const checkout = useMutation({
    mutationFn: () => startChannelCheckout(channel.id),
    onSuccess: (r) => { if (r.url) window.location.href = r.url; },
  });

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
              ? t("channel.access.subscription_desc", { amount, currency, interval: t(`channel.access.interval_${interval}`) })
              : t("channel.access.one_time_desc", { amount, currency })}
          </p>
        </div>

        <button
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending || checkout.isSuccess}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {checkout.isPending || checkout.isSuccess ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          {isSubscription
            ? t("channel.access.subscribe_cta", { amount, currency })
            : t("channel.access.unlock_cta", { amount, currency })}
        </button>

        {checkout.isError && <p className="text-xs text-destructive">{t("channel.access.error")}</p>}

        <p className="text-[10px] leading-snug text-muted-foreground">{t("channel.access.secure_note")}</p>
      </div>
    </div>
  );
}
