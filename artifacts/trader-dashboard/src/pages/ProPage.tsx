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
  const isPro = billing.data?.pro === true;
  const renewalDate = formatDate(billing.data?.currentPeriodEnd, localeCode, t("billing.date_unavailable"));

  return (
    <PageLayout>
      <div className="relative overflow-hidden rounded-3xl">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />

        {/* ── Hero ── */}
        <section className="relative px-4 pb-12 pt-10 text-center sm:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("billing.pro_page.badge")}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-5 max-w-2xl font-mono text-3xl font-extrabold tracking-tight sm:text-5xl"
          >
            {t("billing.pro_page.headline_1")}{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
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
              <div className="mx-auto h-24 w-64 animate-pulse rounded-2xl bg-card/60" />
            ) : isPro ? (
              <div className="mx-auto max-w-md space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
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
                  <span className="text-4xl font-extrabold">{t("billing.price_amount")}</span>
                  <span className="text-muted-foreground">{t("billing.per_month_suffix")}</span>
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="px-10 shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-shadow hover:shadow-[0_0_40px_rgba(34,197,94,0.45)]"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  {t("billing.upgrade_cta")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("billing.pro_page.stripe_secure")}
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Showcase feature ── */}
        <section className="relative px-4 pb-12">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
            {PRO_FEATURES.map(({ icon: Icon, titleKey, descKey, bulletKeys }, idx) => (
              <motion.div key={titleKey} {...sectionMotion} transition={{ delay: 0.08 * idx }}>
                <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/30">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{t(titleKey)}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{t(descKey)}</p>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {bulletKeys.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
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
          <motion.h2 {...sectionMotion} className="mb-6 text-center font-mono text-2xl font-extrabold">
            {t("billing.pro_page.compare_title")}
          </motion.h2>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            <motion.div {...sectionMotion}>
              <Card className="h-full border-border/50 bg-card/40">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h3 className="text-lg font-bold">{t("billing.status.free")}</h3>
                    <p className="text-2xl font-extrabold">
                      {t("billing.pro_page.free_price")}<span className="text-sm font-normal text-muted-foreground">{t("billing.per_month_suffix")}</span>
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
              <Card className="relative h-full border-primary/40 bg-card/60 shadow-[0_0_30px_rgba(34,197,94,0.12)]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  {t("billing.pro_page.recommended")}
                </span>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <Crown className="h-4 w-4 text-primary" />
                      {t("billing.pro_page.badge")}
                    </h3>
                    <p className="text-2xl font-extrabold">
                      {t("billing.price_amount")}<span className="text-sm font-normal text-muted-foreground">{t("billing.per_month_suffix")}</span>
                    </p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("billing.pro_page.everything_plus")}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {PRO_ONLY.map((f) => (
                      <li key={f} className="flex items-center gap-2 font-medium">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {t(f)}
                      </li>
                    ))}
                  </ul>
                  {!isPro && (
                    <Button type="button" className="w-full" onClick={() => setCheckoutOpen(true)}>
                      {t("billing.upgrade_cta")}
                    </Button>
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
    </PageLayout>
  );
}
