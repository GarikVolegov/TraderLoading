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
    "rounded-md py-2 text-center text-xs font-mono font-bold tracking-wider uppercase transition-all";
  const toggleActive =
    "bg-[#C5A059] text-[#0A0A0C] shadow-[0_0_15px_rgba(197,160,89,0.3)]";
  const toggleIdle = "text-[#8E8E98] hover:text-[#F4F4F6]";

  return (
    <main
      className="relative flex min-h-[100dvh] items-center overflow-hidden px-4 py-6 text-foreground sm:px-6 lg:px-10"
      style={{ backgroundColor: "#0A0A0C" }}
      data-brand="LIMEN"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 22% 12%, rgba(197,160,89,0.10), transparent 60%)," +
            "radial-gradient(55% 50% at 88% 92%, rgba(197,160,89,0.06), transparent 65%)," +
            "linear-gradient(180deg, #0A0A0C 0%, #121216 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(197,160,89,0.06) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(197,160,89,0.06) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(100% 100% at 50% 0%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(100% 100% at 50% 0%, black, transparent 75%)",
          }}
        />
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
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#C5A059]/40 bg-[#141418] text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.2)] overflow-hidden">
              <img src="/app-icon-192.png?v=20261021g" alt="LIMEN" className="h-full w-full object-cover" />
              <Rocket className="hidden" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold tracking-[0.2em] text-[#F4F4F6] uppercase">LIMEN</p>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                {t("auth.shell.brand.tagline")}
              </p>
            </div>
          </div>

          <div>
            <span className="mb-3 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
              {eyebrow}
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-wide text-[#F4F4F6] lg:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#8E8E98]">{body}</p>
          </div>

          <div className="flex flex-col gap-3.5">
            {trust.map(({ icon: Icon, title: rowTitle, desc }) => (
              <div key={rowTitle} className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-[#C5A059]/20 bg-[#141418] text-[#C5A059]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F4F4F6]">{rowTitle}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[#8E8E98]">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {rating && rating.count > 0 && (
            <div className="flex items-center gap-2.5 border-t border-[#25252E] pt-4 text-[13px] text-[#8E8E98]">
              <span className="inline-flex gap-0.5 text-[#C5A059]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                ))}
              </span>
              <span>
                <strong className="font-mono font-bold text-[#F4F4F6]">{rating.average.toFixed(1)}/5</strong> ·{" "}
                {rating.count} {t("auth.shell.social.reviews")}
              </span>
            </div>
          )}
        </section>

        {/* Form card */}
        <section className="mx-auto w-full max-w-[460px] lg:justify-self-end">
          <div className="rounded-xl border border-[#C5A059]/30 bg-[#121216]/95 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-[#25252E] bg-[#0A0A0C] p-1">
              <Link href="/sign-in" className={`${toggleBase} ${isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signin")}
              </Link>
              <Link href="/sign-up" className={`${toggleBase} ${!isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signup")}
              </Link>
            </div>

            {children}

            <p className="mt-4 text-center text-xs leading-5 text-[#8E8E98]">
              {t("auth.shell.legal.intro")}{" "}
              <Link href="/terms" className="font-semibold text-[#C5A059] hover:underline">
                {t("auth.shell.legal.terms")}
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="font-semibold text-[#C5A059] hover:underline">
                {t("auth.shell.legal.privacy")}
              </Link>
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-[#25252E] pt-3 text-center text-xs text-[#8E8E98]">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-[#C5A059]" aria-hidden="true" />
              {t("auth.shell.footer.secure")}
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
