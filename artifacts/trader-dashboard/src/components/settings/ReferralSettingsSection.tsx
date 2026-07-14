import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { fetchReferral, referralKey } from "@/lib/referralApi";

export function ReferralSettingsSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: referralKey(),
    queryFn: () => fetchReferral(),
    retry: false,
  });

  // The API returns a relative link; share the absolute URL.
  const inviteUrl = data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${data.link}`
    : "";

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({ title: t("referral.copied") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is still selectable */
    }
  }

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{t("referral.title")}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : data ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("referral.desc", { xp: data.rewardXp })}
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t("referral.title")}
              className="flex-1 min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground/90"
            />
            <Button size="sm" onClick={copy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5">{t("referral.copy")}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-primary" />
            {t("referral.invited", { count: data.referrals })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("referral.error")}</p>
      )}
    </div>
  );
}
