import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  BarChart2,
  Check,
  Crown,
  Shield,
  TerminalSquare,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  LANGUAGES,
  useLanguage,
  type Language,
} from "@/contexts/LanguageContext";

const FEATURE_ITEMS = [
  {
    icon: TrendingUp,
    titleKey: "landing.feature.market.title",
    descKey: "landing.feature.market.desc",
  },
  {
    icon: BarChart2,
    titleKey: "landing.feature.journal.title",
    descKey: "landing.feature.journal.desc",
  },
  {
    icon: Shield,
    titleKey: "landing.feature.risk.title",
    descKey: "landing.feature.risk.desc",
  },
  {
    icon: Zap,
    titleKey: "landing.feature.progress.title",
    descKey: "landing.feature.progress.desc",
  },
] as const;

const FREE_ITEMS = [
  "landing.pricing.free.item1",
  "landing.pricing.free.item2",
  "landing.pricing.free.item3",
  "landing.pricing.free.item4",
] as const;

const PRO_ITEMS = [
  "landing.pricing.pro.item1",
  "landing.pricing.pro.item2",
  "landing.pricing.pro.item3",
] as const;

export const FAQ_ITEMS = [
  {
    questionKey: "landing.faq.free.question",
    answerKey: "landing.faq.free.answer",
  },
  {
    questionKey: "landing.faq.sync.question",
    answerKey: "landing.faq.sync.answer",
  },
  {
    questionKey: "landing.faq.safety.question",
    answerKey: "landing.faq.safety.answer",
  },
  {
    questionKey: "landing.faq.difference.question",
    answerKey: "landing.faq.difference.answer",
  },
  {
    questionKey: "landing.faq.install.question",
    answerKey: "landing.faq.install.answer",
  },
] as const;

const OG_LOCALES: Record<Language, string> = {
  it: "it_IT",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
};

function setMetaContent(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const title = t("landing.meta.title");
    const description = t("landing.meta.description");
    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:locale"]', OG_LOCALES[language]);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: language,
      mainEntity: FAQ_ITEMS.map(({ questionKey, answerKey }) => ({
        "@type": "Question",
        name: t(questionKey),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(answerKey),
        },
      })),
    };

    let script = document.getElementById("landing-faq-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "landing-faq-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      document.getElementById("landing-faq-jsonld")?.remove();
    };
  }, [language, t]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] opacity-60 translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-50 -translate-x-1/3 translate-y-1/3" />
      </div>

      <header className="relative z-10 px-3 pt-4 sm:px-8 sm:pt-5">
        <div className="mx-auto w-full max-w-[1820px] rounded-full bg-gradient-to-r from-primary/15 via-white/10 to-blue-500/10 p-px shadow-[0_0_36px_rgba(34,197,94,0.16),0_24px_70px_rgba(0,0,0,0.55)]">
          <div className="relative flex min-h-16 items-center justify-between gap-3 overflow-hidden rounded-full border border-white/20 bg-background/55 px-3 py-2 backdrop-blur-[30px] sm:px-5">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.13)_34%,transparent_43%)] opacity-80" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-blue-500/10 via-transparent to-primary/10" />
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative z-10 flex min-w-0 items-center gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_18px_rgba(34,197,94,0.12)]">
                <TerminalSquare className="h-5 w-5 text-primary" />
              </div>
              <span className="hidden whitespace-nowrap font-mono text-base font-bold tracking-tight text-foreground min-[380px]:inline sm:text-xl">
                TraderLoading
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-3"
            >
              <a
                href="#pricing"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground md:block"
              >
                {t("landing.nav.pricing")}
              </a>
              <button
                onClick={() => setLocation("/sign-in")}
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:block"
              >
                {t("landing.nav.sign_in")}
              </button>
              <label className="sr-only" htmlFor="landing-language">
                {t("landing.language.label")}
              </label>
              <select
                id="landing-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="h-10 rounded-full border border-white/20 bg-card/60 px-2 text-xs font-bold text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary sm:px-3"
                aria-label={t("landing.language.label")}
              >
                {Object.entries(LANGUAGES).map(([code, config]) => (
                  <option key={code} value={code}>
                    {config.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setLocation("/sign-up")}
                className="whitespace-nowrap rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_22px_rgba(34,197,94,0.24)] transition-colors hover:bg-primary/90 sm:px-6"
              >
                {t("landing.nav.get_started")}
              </button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8"
        >
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {t("landing.hero.badge")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mb-6 font-mono"
        >
          {t("landing.hero.title_a")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
            {t("landing.hero.title_b")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          {t("landing.hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button
            onClick={() => setLocation("/sign-up")}
            className="w-full sm:w-auto text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-10 py-4 rounded-xl shadow-[0_0_30px_rgba(0,204,102,0.3)] hover:shadow-[0_0_40px_rgba(0,204,102,0.5)] transform hover:-translate-y-1"
          >
            {t("landing.hero.start_free")}
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            className="w-full sm:w-auto text-lg font-medium border border-border bg-card/50 hover:bg-card hover:border-primary/40 text-foreground transition-all px-10 py-4 rounded-xl backdrop-blur-sm"
          >
            {t("landing.hero.sign_in_existing")}
          </button>
        </motion.div>
      </main>

      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURE_ITEMS.map(({ icon: Icon, titleKey, descKey }, idx) => (
            <motion.div
              key={titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl p-8 text-left hover:border-primary/30 transition-all hover:bg-card/60 group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-3">{t(titleKey)}</h3>
              <p className="text-muted-foreground leading-relaxed text-base">{t(descKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative z-10 px-4 sm:px-6 pb-24 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4 font-mono">
            {t("landing.pricing.heading")}
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            {t("landing.pricing.subtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl p-8 text-left flex flex-col"
            >
              <h3 className="font-bold text-xl mb-1">{t("landing.pricing.free")}</h3>
              <p className="text-4xl font-extrabold mb-6">
                0 EUR
                <span className="text-base font-normal text-muted-foreground">
                  {t("landing.pricing.month")}
                </span>
              </p>
              <ul className="space-y-3 text-base text-muted-foreground mb-8 flex-1">
                {FREE_ITEMS.map((itemKey) => (
                  <li key={itemKey} className="flex items-center gap-3">
                    <Check className="w-4 h-4 shrink-0 text-muted-foreground/70" />
                    {t(itemKey)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setLocation("/sign-up")}
                className="w-full text-base font-medium border border-border bg-card/50 hover:bg-card hover:border-primary/40 text-foreground transition-all px-6 py-3 rounded-xl"
              >
                {t("landing.hero.start_free")}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative bg-card/60 backdrop-blur-sm border border-primary/40 rounded-3xl p-8 text-left flex flex-col shadow-[0_0_40px_rgba(0,204,102,0.12)]"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full">
                {t("landing.pricing.popular")}
              </span>
              <h3 className="font-bold text-xl mb-1 flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                {t("landing.pricing.pro")}
              </h3>
              <p className="text-4xl font-extrabold mb-6">
                7 EUR
                <span className="text-base font-normal text-muted-foreground">
                  {t("landing.pricing.month")}
                </span>
              </p>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t("landing.pricing.pro_intro")}
              </p>
              <ul className="space-y-3 text-base mb-8 flex-1">
                {PRO_ITEMS.map((itemKey) => (
                  <li key={itemKey} className="flex items-center gap-3 font-medium">
                    <Check className="w-4 h-4 shrink-0 text-primary" />
                    {t(itemKey)}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setLocation("/sign-up")}
                className="w-full text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(0,204,102,0.25)]"
              >
                {t("landing.pricing.go_pro")}
              </button>
            </motion.div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("landing.pricing.note")}
          </p>
        </div>
      </section>

      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-10 font-mono">
            {t("landing.faq.heading")}
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map(({ questionKey, answerKey }, idx) => (
              <motion.details
                key={questionKey}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                className="group rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-4 open:border-primary/30 open:bg-card/60 transition-colors"
              >
                <summary className="cursor-pointer list-none text-left font-bold text-foreground text-lg flex items-center justify-between gap-3">
                  {t(questionKey)}
                  <span className="shrink-0 text-primary transition-transform group-open:rotate-45 text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed text-base">
                  {t(answerKey)}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground bg-background/50 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TerminalSquare className="w-4 h-4 opacity-50" />
          <span className="font-mono opacity-50">TraderLoading</span>
        </div>
        <p className="mb-3">
          © {new Date().getFullYear()} TraderLoading. {t("landing.footer.rights")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            {t("landing.footer.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("landing.footer.terms")}
          </Link>
          <a
            href="mailto:assistenza@traderloading.com"
            className="hover:text-foreground"
          >
            {t("landing.footer.support")}
          </a>
        </div>
      </footer>
    </div>
  );
}
