import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Activity, BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

type AuthPageShellProps = {
  mode: "sign-in" | "sign-up";
  children: ReactNode;
};

const copy = {
  "sign-in": {
    eyebrow: "Sessione protetta",
    title: "Rientra nel tuo centro operativo.",
    body: "Journal, news macro, gestione del rischio e routine restano sincronizzati nel tuo workspace TraderLoading.",
    formLabel: "Accesso account",
  },
  "sign-up": {
    eyebrow: "Nuovo workspace",
    title: "Crea il tuo centro operativo.",
    body: "Configura un account sicuro per salvare progressi, dati di trading, missioni e preferenze su ogni dispositivo.",
    formLabel: "Creazione account",
  },
} as const;

const statusCards = [
  {
    label: "Protezione",
    value: "2FA ready",
    icon: ShieldCheck,
    className: "text-primary",
  },
  {
    label: "Mercati",
    value: "Live flow",
    icon: Activity,
    className: "text-warning",
  },
  {
    label: "Dati",
    value: "Cloud sync",
    icon: BadgeCheck,
    className: "text-accent",
  },
] as const;

const appLogoSrc = `${import.meta.env.BASE_URL}app-icon-192.png`;

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const pageCopy = copy[mode];
  const switchCopy =
    mode === "sign-in"
      ? { label: "Non hai ancora un account?", href: "/sign-up", action: "Registrati" }
      : { label: "Hai gia un account?", href: "/sign-in", action: "Accedi" };

  return (
    <main className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(224_55%_5%)_72%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.09)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:46px_46px]" />
        <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 opacity-50" />
        <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/20 opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10"
      >
        <section className="mx-auto flex w-full max-w-xl flex-col gap-6 text-center lg:mx-0 lg:text-left">
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border border-primary/35 bg-primary/10 p-1 shadow-[0_0_24px_hsl(var(--primary)/0.12)]">
              <img
                src={appLogoSrc}
                alt="Logo ufficiale TraderLoading"
                className="h-full w-full rounded-[6px] object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-base font-bold tracking-wide text-foreground sm:text-lg">
                TraderLoading
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                Secure trader workspace
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              {pageCopy.eyebrow}
            </div>
            <div className="space-y-3">
              <h1 className="font-mono text-3xl font-extrabold leading-tight text-foreground sm:text-4xl lg:text-5xl">
                {pageCopy.title}
              </h1>
              <p className="mx-auto max-w-lg text-sm leading-6 text-muted-foreground sm:text-base lg:mx-0">
                {pageCopy.body}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {statusCards.map(({ label, value, icon: Icon, className }) => (
              <div
                key={label}
                className="rounded-lg border border-border/55 bg-card/70 p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-border/45 bg-secondary/55">
                  <Icon className={`h-4 w-4 ${className}`} aria-hidden="true" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {label}
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[460px] lg:mx-0 lg:justify-self-end">
          <div className="rounded-lg border border-border/60 bg-[#07111f]/95 p-3 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-4">
            <div className="mb-3 flex items-center justify-between rounded-lg border border-border/45 bg-secondary/40 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {pageCopy.formLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
                Online
              </span>
            </div>
            {children}
            <div className="mt-3 rounded-lg border border-border/40 bg-secondary/30 px-3 py-3 text-center text-sm text-muted-foreground">
              {switchCopy.label}{" "}
              <Link
                href={switchCopy.href}
                className="font-bold text-primary transition-colors hover:text-primary/80"
              >
                {switchCopy.action}
              </Link>
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground/80">
              Continuando accetti i{" "}
              <Link href="/terms" className="font-semibold text-primary hover:text-primary/80">
                Termini
              </Link>{" "}
              e confermi di aver letto la{" "}
              <Link href="/privacy" className="font-semibold text-primary hover:text-primary/80">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
