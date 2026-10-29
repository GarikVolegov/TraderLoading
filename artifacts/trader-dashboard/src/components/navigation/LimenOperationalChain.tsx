import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SigilIcon, type SigilVariant } from "@/components/ui/SigilIcon";

interface SubPillar {
  id: string;
  label: string;
  href: string;
  isActive: (pathname: string, search: string) => boolean;
}

interface ChainStage {
  id: string;
  roman: string;
  label: string;
  sublabel: string;
  href: (pair: string | null) => string;
  sigil: SigilVariant;
  matches: (pathname: string, search: string) => boolean;
  subPillars?: (pair: string | null) => readonly SubPillar[];
}

function withPair(baseHref: string, pair: string | null): string {
  if (!pair) return baseHref;
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}pair=${encodeURIComponent(pair)}`;
}

const CHAIN_STAGES: readonly ChainStage[] = [
  {
    id: "contemplation",
    roman: "I",
    label: "Contemplazione",
    sublabel: "Scenario & Macro",
    href: (pair) => withPair("/?vista=mercati", pair),
    sigil: "threshold",
    matches: (pathname, search) =>
      pathname === "/" &&
      (search.includes("vista=mercati") ||
        search.includes("vista=notizie") ||
        search.includes("vista=strumenti")),
    subPillars: (pair) => [
      {
        id: "mercati",
        label: "Mercati & Grafico",
        href: withPair("/?vista=mercati", pair),
        isActive: (p, s) => p === "/" && (s.includes("vista=mercati") || (!s.includes("vista=notizie") && !s.includes("vista=strumenti"))),
      },
      {
        id: "notizie",
        label: "Notizie Macro",
        href: withPair("/?vista=notizie", pair),
        isActive: (p, s) => p === "/" && s.includes("vista=notizie"),
      },
      {
        id: "strumenti",
        label: "Strumenti",
        href: withPair("/?vista=strumenti", pair),
        isActive: (p, s) => p === "/" && s.includes("vista=strumenti"),
      },
    ],
  },
  {
    id: "threshold",
    roman: "II",
    label: "Il Varco & Custode",
    sublabel: "Esecuzione & Regola",
    href: (pair) => withPair("/", pair),
    sigil: "keeper",
    matches: (pathname, search) =>
      pathname === "/" && !search.includes("vista="),
    subPillars: (pair) => [
      {
        id: "varco",
        label: "Il Varco (3 Colonne)",
        href: withPair("/", pair),
        isActive: (p, s) => p === "/" && !s.includes("vista="),
      },
    ],
  },
  {
    id: "forge",
    roman: "III",
    label: "La Forgia & Dottrina",
    sublabel: "Simulazione & Tempo",
    href: () => "/backtest",
    sigil: "forge",
    matches: (pathname) => pathname.startsWith("/backtest") || pathname.startsWith("/academy"),
    subPillars: () => [
      {
        id: "backtest",
        label: "La Forgia (Backtest)",
        href: "/backtest",
        isActive: (p) => p.startsWith("/backtest"),
      },
      {
        id: "academy",
        label: "La Dottrina del Tempo",
        href: "/academy",
        isActive: (p) => p.startsWith("/academy"),
      },
    ],
  },
  {
    id: "truth",
    roman: "IV",
    label: "Il Libro della Verità",
    sublabel: "Cronaca & Integrità",
    href: () => "/journal",
    sigil: "book-of-truth",
    matches: (pathname) => pathname.startsWith("/journal") || pathname.startsWith("/wiki"),
    subPillars: () => [
      {
        id: "registro",
        label: "Registro Sovrano Unificato",
        href: "/journal",
        isActive: (p) => p.startsWith("/journal"),
      },
    ],
  },
  {
    id: "ascension",
    roman: "V",
    label: "I Gradi & La Fratellanza",
    sublabel: "Ascesa & Eredità",
    href: () => "/milestones",
    sigil: "hierarchy",
    matches: (pathname) =>
      pathname.startsWith("/milestones") ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/pro"),
    subPillars: () => [
      {
        id: "milestones",
        label: "I 5 Gradi & Sigilli",
        href: "/milestones",
        isActive: (p) => p.startsWith("/milestones"),
      },
      {
        id: "chat",
        label: "Il Concilio",
        href: "/chat",
        isActive: (p) => p.startsWith("/chat"),
      },
    ],
  },
];

export function LimenOperationalChain({ compact = false }: { compact?: boolean }) {
  const [pathname] = useLocation();
  const search = useSearch();
  const activePair = new URLSearchParams(search).get("pair");

  const activeIndex = Math.max(
    0,
    CHAIN_STAGES.findIndex((stage) => stage.matches(pathname, search)),
  );
  const currentStage = CHAIN_STAGES[activeIndex];
  const prevStage = activeIndex > 0 ? CHAIN_STAGES[activeIndex - 1] : null;
  const nextStage =
    activeIndex < CHAIN_STAGES.length - 1 ? CHAIN_STAGES[activeIndex + 1] : CHAIN_STAGES[0];
  const subPillars = currentStage?.subPillars ? currentStage.subPillars(activePair) : [];

  return (
    <nav
      aria-label={"Catena Operativa AUREUS"}
      className={`limen-chain-bar relative overflow-hidden border border-border/85 bg-card/90 backdrop-blur-md transition-colors ${
        compact ? "px-3 py-1.5" : "px-3.5 py-2 sm:px-4"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {CHAIN_STAGES.map((stage, idx) => {
            const isActive = idx === activeIndex;
            const isCompleted = idx < activeIndex;
            return (
              <div key={stage.id} className="flex items-center gap-1 shrink-0">
                <Link
                  href={stage.href(activePair)}
                  className={`group relative flex items-center gap-2 px-2.5 py-1.5 text-xs transition-all duration-200 ${
                    isActive
                      ? "text-primary font-semibold"
                      : isCompleted
                        ? "text-foreground/85 hover:text-primary"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="limen-operational-chain-pill"
                      className="absolute inset-0 border border-primary/45 bg-primary/10"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-5 w-5 items-center justify-center border font-mono text-[9px] font-bold transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCompleted
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background/70 text-muted-foreground group-hover:border-primary/40"
                    }`}
                  >
                    {stage.roman}
                  </span>
                  <span className="relative z-10 flex flex-col leading-tight">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                      {stage.label}
                    </span>
                    {!compact && (
                      <span className="hidden 2xl:inline text-[9px] text-muted-foreground font-normal">
                        {stage.sublabel}
                      </span>
                    )}
                  </span>
                </Link>
                {idx < CHAIN_STAGES.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`h-[1px] w-2.5 sm:w-3.5 transition-colors ${
                      idx < activeIndex ? "bg-primary/50" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-auto">
          {subPillars.length > 0 && (
            <div className="hidden xl:flex items-center gap-1 border border-border/80 bg-background/70 p-0.5 mr-1">
              {subPillars.map((pillar) => {
                const active = pillar.isActive(pathname, search);
                return (
                  <Link
                    key={pillar.id}
                    href={pillar.href}
                    className={`relative px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors ${
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="limen-chain-subpillar-pill"
                        className="absolute inset-0 border border-primary/40 bg-primary/14"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{pillar.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {prevStage && (
            <Link
              href={prevStage.href(activePair)}
              className="inline-flex items-center gap-1.5 border border-border bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ArrowLeft size={11} />
              <span>{prevStage.label}</span>
            </Link>
          )}
          {nextStage && (
            <Link
              href={nextStage.href(activePair)}
              className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
            >
              <SigilIcon variant={nextStage.sigil} size={11} />
              <span>{`Prossimo: ${nextStage.label}`}</span>
              <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

