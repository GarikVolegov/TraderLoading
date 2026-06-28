import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, MessagesSquare, Rocket, ShieldCheck, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type AuthPageShellProps = {
  mode: "sign-in" | "sign-up";
  children: ReactNode;
};

interface PublicStatsResponse {
  traders: number;
  trades: number;
  pairs: number;
  rating: { average: number; count: number } | null;
}

async function fetchPublicStats(): Promise<PublicStatsResponse> {
  const res = await fetch("/api/public/stats");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PublicStatsResponse>;
}

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const { t } = useLanguage();
  const isSignIn = mode === "sign-in";

  const { data: stats } = useQuery({
    queryKey: ["auth", "public-stats"],
    queryFn: fetchPublicStats,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const rating = stats?.rating ?? null;

  const eyebrow = isSignIn ? t("auth.shell.signin.eyebrow") : t("auth.shell.signup.eyebrow");
  const title = isSignIn ? t("auth.shell.signin.title") : t("auth.shell.signup.title");
  const body = isSignIn ? t("auth.shell.signin.body") : t("auth.shell.signup.body");

  const trust = [
    { icon: MessagesSquare, title: t("auth.shell.trust.e2ee.title"), desc: t("auth.shell.trust.e2ee.desc") },
    { icon: Eye, title: t("auth.shell.trust.readonly.title"), desc: t("auth.shell.trust.readonly.desc") },
    { icon: ShieldCheck, title: t("auth.shell.trust.gdpr.title"), desc: t("auth.shell.trust.gdpr.desc") },
  ];

  const toggleBase =
    "rounded-lg py-2 text-center text-sm font-semibold transition-colors";
  const toggleActive =
    "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.25)]";
  const toggleIdle = "text-muted-foreground hover:text-foreground";

  return (
    <main className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_18%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(224_55%_5%)_72%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:46px_46px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10"
      >
        {/* Brand panel (hidden on mobile, per the design's @media max-width:880px) */}
        <section className="mx-auto hidden w-full max-w-xl flex-col gap-7 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-base font-bold tracking-tight text-foreground">TraderLoading</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/75">
                {t("auth.shell.brand.tagline")}
              </p>
            </div>
          </div>

          <div>
            <span className="mb-3 inline-block text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </span>
            <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-mono text-4xl font-extrabold leading-[1.1] tracking-tight text-transparent lg:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{body}</p>
          </div>

          <div className="flex flex-col gap-3.5">
            {trust.map(({ icon: Icon, title: rowTitle, desc }) => (
              <div key={rowTitle} className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{rowTitle}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {rating && rating.count > 0 && (
            <div className="flex items-center gap-2.5 border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
              <span className="inline-flex gap-0.5 text-warning">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                ))}
              </span>
              <span>
                <strong className="font-mono font-bold text-foreground">{rating.average.toFixed(1)}/5</strong> ·{" "}
                {rating.count} {t("auth.shell.social.reviews")}
              </span>
            </div>
          )}
        </section>

        {/* Form card */}
        <section className="mx-auto w-full max-w-[460px] lg:justify-self-end">
          <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-5">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
              <Link href="/sign-in" className={`${toggleBase} ${isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signin")}
              </Link>
              <Link href="/sign-up" className={`${toggleBase} ${!isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signup")}
              </Link>
            </div>

            {children}

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground/80">
              {t("auth.shell.legal.intro")}{" "}
              <Link href="/terms" className="font-semibold text-primary hover:text-primary/80">
                {t("auth.shell.legal.terms")}
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="font-semibold text-primary hover:text-primary/80">
                {t("auth.shell.legal.privacy")}
              </Link>
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border/50 pt-3 text-center text-xs text-muted-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              {t("auth.shell.footer.secure")}
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
