import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";
import { updateChannelPricing } from "@/lib/channelAccessApi";
import type { ChannelType } from "./types";

type Mode = "free" | "one_time" | "subscription";

// Creator/channels.manage editor for a channel's price (marketplace, real €). "free"
// clears the price; one-time/subscription set a € price (subscription also an interval).
// Buyers pay via Stripe; the creator receives the money on their connected account.
export function ChannelPricingModal({ channel, onClose }: { channel: ChannelType; onClose: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const initialMode: Mode =
    channel.priceCents && channel.priceCents > 0
      ? channel.accessModel === "subscription"
        ? "subscription"
        : "one_time"
      : "free";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [price, setPrice] = useState<string>(channel.priceCents ? (channel.priceCents / 100).toFixed(2) : "");
  const [interval, setInterval] = useState<"month" | "year">(channel.subInterval ?? "month");

  const priceCents = Math.round((parseFloat(price) || 0) * 100);
  const priceInvalid = mode !== "free" && (!(priceCents > 0) || priceCents < 50); // Stripe min ~€0.50

  const save = useMutation({
    mutationFn: () =>
      updateChannelPricing(channel.id, {
        priceCents: mode === "free" ? null : priceCents,
        accessModel: mode === "free" ? null : mode,
        subInterval: mode === "subscription" ? interval : null,
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
              min={0.5}
              step={0.5}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="5.00"
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            />
          </label>
        )}

        {mode === "subscription" && (
          <div className="grid grid-cols-2 gap-2">
            {(["month", "year"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${interval === iv ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                {t(`channel.access.interval_${iv}`)}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || priceInvalid}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {save.isPending ? "…" : t("channel.access.save")}
        </button>
        <p className="text-[10px] leading-snug text-muted-foreground">{t("channel.access.pricing_hint")}</p>
      </div>
    </Modal>
  );
}
