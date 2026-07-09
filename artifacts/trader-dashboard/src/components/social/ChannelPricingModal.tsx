import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";
import { updateChannelPricing } from "@/lib/channelAccessApi";
import type { ChannelType } from "./types";

type Mode = "free" | "one_time" | "subscription";

// Creator/channels.manage editor for a channel's price. "free" clears the price;
// one-time/subscription set a credit price (subscription also a period in days).
export function ChannelPricingModal({ channel, onClose }: { channel: ChannelType; onClose: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const initialMode: Mode =
    channel.priceCredits && channel.priceCredits > 0
      ? channel.accessModel === "subscription"
        ? "subscription"
        : "one_time"
      : "free";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [price, setPrice] = useState<string>(channel.priceCredits ? String(channel.priceCredits) : "");
  const [days, setDays] = useState<string>(channel.subscriptionPeriodDays ? String(channel.subscriptionPeriodDays) : "30");

  const priceNum = Number(price);
  const daysNum = Number(days);
  const priceInvalid = mode !== "free" && (!Number.isInteger(priceNum) || priceNum <= 0);
  const daysInvalid = mode === "subscription" && (!Number.isInteger(daysNum) || daysNum <= 0);

  const save = useMutation({
    mutationFn: () =>
      updateChannelPricing(channel.id, {
        priceCredits: mode === "free" ? null : priceNum,
        accessModel: mode === "free" ? null : mode,
        subscriptionPeriodDays: mode === "subscription" ? daysNum : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", channel.communityId] });
      onClose();
    },
    onError: (err) => reportClientError(err, { context: "channel pricing update", notify: false }),
  });

  return (
    <Modal isOpen onClose={onClose} title={t("channel.access.pricing_title")}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["free", "one_time", "subscription"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all ${mode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {t(`channel.access.mode_${m}`)}
            </button>
          ))}
        </div>

        {mode !== "free" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{t("channel.access.price_label")}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100"
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            />
          </label>
        )}

        {mode === "subscription" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{t("channel.access.period_label")}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="30"
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            />
          </label>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || priceInvalid || daysInvalid}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {save.isPending ? "…" : t("channel.access.save")}
        </button>
        <p className="text-[10px] leading-snug text-muted-foreground">{t("channel.access.pricing_hint")}</p>
      </div>
    </Modal>
  );
}
