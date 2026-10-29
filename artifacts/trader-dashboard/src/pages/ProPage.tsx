import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Crown,
  FlaskConical,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLayout } from "@/components/PageLayout";
import { ProCheckoutDialog } from "@/components/ProCheckoutDialog";
import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBillingStatus } from "@/lib/billingApi";

const PRO_FEATURES = [
  {
    icon: FlaskConical,
    titleKey: "billing.feature.backtesting",
    descKey: "billing.pro_page.backtest.desc",
    bulletKeys: ["billing.pro_page.backtest.b1", "billing.pro_page.backtest.b2", "billing.pro_page.backtest.b3"],
  },
  {
    icon: Trophy,
    titleKey: "billing.feature.leaderboards",
    descKey: "billing.pro_page.leaderboard.desc",
    bulletKeys: ["billing.pro_page.leaderboard.b1", "billing.pro_page.leaderboard.b2", "billing.pro_page.leaderboard.b3"],
  },
  {
    icon: Wallet,
    titleKey: "billing.feature.account_sync",
    descKey: "billing.pro_page.broker.desc",
    bulletKeys: ["billing.pro_page.broker.b1", "billing.pro_page.broker.b2", "billing.pro_page.broker.b3"],
  },
];

const FREE_FEATURES = [
  "billing.pro_page.free_f1",
  "billing.pro_page.free_f2",
  "billing.pro_page.free_f3",
  "billing.pro_page.free_f4",
  "billing.pro_page.free_f5",
];

const PRO_ONLY = ["billing.pro_page.pro_f1", "billing.pro_page.pro_f2", "billing.pro_page.pro_f3"];

function formatDate(value: string | null | undefined, localeCode: string, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(localeCode, { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(value),
  );
}

const sectionMotion = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function ProPage() {
  const billing = useBillingStatus();
  const { language, t } = useLanguage();
  const localeCode = language === "en" ? "en-US" : language;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [limenModalOpen, setLimenModalOpen] = useState(false);
  const isPro = billing.data?.pro === true;
  // Fail open (unlike ProUpgradeGate, which already gates on billing.isPending
  // and only needs a default for the rare error case): this page has no loading
  // skeleton, so a fail-closed default would flash "unavailable" to EVERY user
  // on EVERY visit during the normal (Stripe configured) case, which is worse
  // than the narrow click-race window this guards — and a click in that window
  // still lands on ProCheckoutDialog's existing graceful 503 retry UI, not a crash.
  const checkoutAvailable = billing.data?.checkoutAvailable ?? true;
  const renewalDate = formatDate(billing.data?.currentPeriodEnd, localeCode, t("billing.date_unavailable"));

  return (
    <PageLayout>
      <div className="relative overflow-hidden rounded-[6px] border border-border/80 bg-[#0E0E12]">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-[#C5A059]/8 blur-[100px]" />

        {/* ── Hero ── */}
        <section className="relative px-4 pb-10 pt-8 text-center sm:pt-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-[4px] border border-[#C5A059]/35 bg-[#C5A059]/10 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#C5A059]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("billing.pro_page.badge")}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold uppercase tracking-wider sm:text-5xl"
          >
            {t("billing.pro_page.headline_1")}{" "}
            <span className="text-[#C5A059]">
              {t("billing.pro_page.headline_2")}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base"
          >
            {t("billing.pro_page.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8"
          >
            {billing.isLoading ? (
              <div className="mx-auto h-24 w-64 animate-pulse rounded-[6px] bg-card/60" />
            ) : isPro ? (
              <div className="mx-auto max-w-md space-y-3">
                <div className="inline-flex items-center gap-2 rounded-[4px] border border-[#C5A059]/40 bg-[#C5A059]/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#C5A059]">
                  <BadgeCheck className="h-4 w-4" />
                  {t("billing.pro_page.already_pro")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {billing.data?.cancelAtPeriodEnd
                    ? t("billing.pro_page.active_until", { date: renewalDate })
                    : t("billing.pro_page.renewal", { date: renewalDate })}
                </p>
                <Link href="/settings?section=abbonamento">
                  <Button type="button" variant="outline">
                    {t("billing.manage_subscription")}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p>
                  <span className="font-mono text-4xl font-extrabold tabular-nums text-[#F4F4F6]">{t("billing.price_amount")}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t("billing.per_month_suffix")}</span>
                </p>
                {checkoutAvailable ? (
                  <Button
                    type="button"
                    size="lg"
                    className="px-10 font-mono text-xs font-bold uppercase tracking-[0.16em]"
                    onClick={() => setCheckoutOpen(true)}
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    {t("billing.upgrade_cta")}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("billing.checkout_unavailable")}</p>
                )}
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("billing.pro_page.stripe_secure")}
                </p>
              </div>
            )}

            {/* Iniziativa Protocollo LIMEN */}
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-[#C5A059]/40 bg-[#07080b]/90 p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A]">
                      Dotazioni Protocollo AUREUS
                    </span>
                    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      10 €/m · 150 €/m
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#94a3b8] leading-relaxed">
                    Forgia del Passato, Architettura Patrimoniale e Dottrina del Tempo disponibili su candidatura con piano mensile o annuale.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setLimenModalOpen(true)}
                  className="shrink-0 border border-[#C5A059] bg-[#C5A059] text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#E8C56A] h-8 px-4"
                >
                  Configura
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Showcase feature ── */}
        <section className="relative px-4 pb-12">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
            {PRO_FEATURES.map(({ icon: Icon, titleKey, descKey, bulletKeys }, idx) => (
              <motion.div key={titleKey} {...sectionMotion} transition={{ delay: 0.08 * idx }}>
                <Card className="h-full rounded-[6px] border-border/80 bg-[#141418] transition-colors hover:border-[#C5A059]/40">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold uppercase tracking-wider text-[#F4F4F6]">{t(titleKey)}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{t(descKey)}</p>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {bulletKeys.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" />
                          {t(b)}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Confronto Free vs Pro ── */}
        <section className="relative px-4 pb-12">
          <motion.h2 {...sectionMotion} className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-wider">
            {t("billing.pro_page.compare_title")}
          </motion.h2>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            <motion.div {...sectionMotion}>
              <Card className="h-full rounded-[6px] border-border/80 bg-[#141418]/80">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h3 className="font-display text-base font-bold uppercase tracking-wider">{t("billing.status.free")}</h3>
                    <p className="font-mono text-2xl font-extrabold tabular-nums">
                      {t("billing.pro_page.free_price")}<span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">{t("billing.per_month_suffix")}</span>
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        {t(f)}
                      </li>
                    ))}
                    {PRO_ONLY.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground/50">
                        <Lock className="h-4 w-4 shrink-0" />
                        {t(f)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div {...sectionMotion} transition={{ delay: 0.08 }}>
              <Card className="relative h-full rounded-[6px] border-[#C5A059]/50 bg-[#141418]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[4px] bg-[#C5A059] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A0A0C]">
                  {t("billing.pro_page.recommended")}
                </span>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wider">
                      <Crown className="h-4 w-4 text-[#C5A059]" />
                      {t("billing.pro_page.badge")}
                    </h3>
                    <p className="font-mono text-2xl font-extrabold tabular-nums">
                      {t("billing.price_amount")}<span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">{t("billing.per_month_suffix")}</span>
                    </p>
                  </div>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("billing.pro_page.everything_plus")}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {PRO_ONLY.map((f) => (
                      <li key={f} className="flex items-center gap-2 font-medium">
                        <Check className="h-4 w-4 shrink-0 text-[#C5A059]" />
                        {t(f)}
                      </li>
                    ))}
                  </ul>
                  {/* Unlike the hero CTA above, this card isn't inside the
                      billing.isLoading ternary — gate it directly so the button
                      can't render active (and clickable) during the fetch
                      window, where checkoutAvailable's fail-open default would
                      otherwise show it regardless of real server config. */}
                  {!billing.isLoading && !isPro && checkoutAvailable && (
                    <Button type="button" className="w-full font-mono text-xs font-bold uppercase tracking-[0.16em]" onClick={() => setCheckoutOpen(true)}>
                      {t("billing.upgrade_cta")}
                    </Button>
                  )}
                  {!billing.isLoading && !isPro && !checkoutAvailable && (
                    <p className="text-center text-xs text-muted-foreground">{t("billing.checkout_unavailable")}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ── Trust ── */}
        <motion.section {...sectionMotion} className="relative px-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t("billing.pro_page.secure_payments")}
            </span>
            <span>{t("billing.pro_page.cancel_anytime")}</span>
            <Link href="/settings?section=abbonamento" className="underline-offset-2 hover:text-foreground hover:underline">
              {t("billing.pro_page.manage_invoices")}
            </Link>
          </div>
        </motion.section>
      </div>

      <ProCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <LimenCandidacyModal isOpen={limenModalOpen} onClose={() => setLimenModalOpen(false)} />
    </PageLayout>
  );
}
