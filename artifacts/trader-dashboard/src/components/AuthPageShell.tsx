import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  Star,
  Zap,
  BookOpen,
  Shield,
  Flame,
  Sparkles,
  Crosshair,
  Info,
  Check,
  Lock,
  ArrowRight,
} from "lucide-react";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";
import type { LimenBillingCycle, LimenTierId } from "../../../../contracts/limenServices";

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

interface ProtocolModule {
  id: string;
  title: string;
  category: string;
  detail: string;
  rule: string;
  unlockedIn: LimenTierId[];
  icon: ReactNode;
}

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const { t } = useLanguage();
  const isSignIn = mode === "sign-in";
  const [customModalOpen, setCustomModalOpen] = useState(false);

  // Read saved or URL parameters
  const [selectedTier, setSelectedTier] = useState<LimenTierId>(() => {
    if (typeof window !== "undefined") {
      const urlPlan = new URLSearchParams(window.location.search).get("plan");
      if (urlPlan === "founders_10" || urlPlan === "complete_150" || urlPlan === "base_free") {
        return urlPlan;
      }
      const saved = window.sessionStorage.getItem("limen_pending_candidacy_tier");
      if (saved === "founders_10" || saved === "complete_150" || saved === "base_free") {
        return saved as LimenTierId;
      }
    }
    return "founders_10";
  });

  const [billingCycle, setBillingCycle] = useState<LimenBillingCycle>(() => {
    if (typeof window !== "undefined") {
      const urlCycle = new URLSearchParams(window.location.search).get("cycle");
      if (urlCycle === "yearly" || urlCycle === "monthly") return urlCycle;
      const saved = window.sessionStorage.getItem("limen_pending_candidacy_cycle");
      if (saved === "yearly" || saved === "monthly") return saved as LimenBillingCycle;
    }
    return "monthly";
  });

  const [contactChannel, setContactChannel] = useState<"whatsapp" | "telegram">(() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("limen_pending_candidacy_contact_channel");
      if (saved === "telegram" || saved === "whatsapp") return saved;
    }
    return "whatsapp";
  });

  const [contactHandle, setContactHandle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("limen_pending_candidacy_contact_handle") || "";
    }
    return "";
  });

  const [candidateName, setCandidateName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("limen_pending_candidacy_name") || "";
    }
    return "";
  });

  const [motivation, setMotivation] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("limen_pending_candidacy_motivation") || "";
    }
    return "";
  });

  const [commitmentAccepted, setCommitmentAccepted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("limen_pending_candidacy_commitment") === "accepted";
    }
    return false;
  });

  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [candidacyError, setCandidacyError] = useState<string | null>(null);

  const [candidateCode] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return (
        window.sessionStorage.getItem("limen_candidate_code") ||
        window.localStorage.getItem("limen_candidate_code") ||
        null
      );
    }
    return null;
  });

  const handleTierChange = (tier: LimenTierId) => {
    setSelectedTier(tier);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_tier", tier);
    }
  };

  const handleCycleChange = (cycle: LimenBillingCycle) => {
    setBillingCycle(cycle);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_cycle", cycle);
    }
  };

  const handleContactChannelChange = (ch: "whatsapp" | "telegram") => {
    setContactChannel(ch);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_contact_channel", ch);
    }
  };

  const handleContactHandleChange = (val: string) => {
    setContactHandle(val);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_contact_handle", val);
    }
  };

  const handleCandidateNameChange = (val: string) => {
    setCandidateName(val);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_name", val);
    }
    if (candidacyError) setCandidacyError(null);
  };

  const handleMotivationChange = (val: string) => {
    setMotivation(val);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_motivation", val);
    }
    if (candidacyError) setCandidacyError(null);
  };

  const handleCommitmentChange = (accepted: boolean) => {
    setCommitmentAccepted(accepted);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("limen_pending_candidacy_commitment", accepted ? "accepted" : "");
    }
    if (candidacyError) setCandidacyError(null);
  };

  const handleProceedToCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setCandidacyError("Inserisci il tuo Nome o Pseudonimo Operativo per la candidatura.");
      return;
    }
    if (!contactHandle.trim()) {
      setCandidacyError("Inserisci il recapito Telegram o WhatsApp per consentire al Custode di contattarti.");
      return;
    }
    if (!motivation.trim() || motivation.trim().length < 8) {
      setCandidacyError("Indica la tua motivazione d'ingresso per la valutazione e selezione del Custode.");
      return;
    }
    if (!commitmentAccepted) {
      setCandidacyError("È richiesta l'adesione formale al Patto di Disciplina dell'Ordine.");
      return;
    }
    setCandidacyError(null);
    setSignUpStep(2);
  };

  const protocolModules: ProtocolModule[] = [
    {
      id: "varco",
      title: "Il Varco & Il Custode",
      category: "Cockpit Decisionale",
      detail: "Checklist pre-trade chirurgica anti-overtrading e guardrail disciplinari di sessione.",
      rule: "Nessun trade aperto senza checklist completata.",
      unlockedIn: ["base_free", "founders_10", "complete_150"],
      icon: <Zap className="h-4 w-4" />,
    },
    {
      id: "verita",
      title: "Il Libro della Verità",
      category: "Registro Monastico",
      detail: "Diario spietato con Indice d'Integrità e tracciamento matematico dell'errore.",
      rule: "Ogni deviazione dal piano abbatte l'Integrità.",
      unlockedIn: ["base_free", "founders_10", "complete_150"],
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: "fratellanza",
      title: "La Fratellanza & I 5 Gradi",
      category: "Agorà dell'Onore",
      detail: "Conclave riservato degli Operatori e gerarchia meritocratica dal Novizio al Fondatore.",
      rule: "Avanzamento di rango governato solo da metriche verificate.",
      unlockedIn: ["base_free", "founders_10", "complete_150"],
      icon: <Shield className="h-4 w-4" />,
    },
    {
      id: "forgia",
      title: "La Forgia del Passato",
      category: "Banco di Forgiatura Replay",
      detail: "Simulatore di replay storico bar-by-bar con esecuzione realistica a tick.",
      rule: "1.000 ore di Forgia prima dell'espansione reale.",
      unlockedIn: ["founders_10", "complete_150"],
      icon: <Flame className="h-4 w-4" />,
    },
    {
      id: "patrimonio",
      title: "Architettura Patrimoniale",
      category: "Preservazione del Capitale",
      detail: "Fondamenta matematiche di rischio, dimensionamento lotti e barriere di rovina.",
      rule: "Massimo 1.0% di rischio capitale per posizione.",
      unlockedIn: ["founders_10", "complete_150"],
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: "dottrina",
      title: "La Dottrina del Tempo",
      category: "Accademia d'Élite",
      detail: "Percorsi video: Arte dell'Assedio & Arte del Duello sui cicli algoritmici.",
      rule: "Comprensione profonda della liquidità istituzionale.",
      unlockedIn: ["complete_150"],
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      id: "finestra",
      title: "La Finestra Operativa & Tornei",
      category: "Kill-Zone Live & Arene",
      detail: "Sessioni di mercato coordinate con telemetria live e Prove del Fuoco trimestrali.",
      rule: "Operatività ristretta esclusivamente alla kill-zone stabilita.",
      unlockedIn: ["complete_150"],
      icon: <Crosshair className="h-4 w-4" />,
    },
  ];

  const [activeModule, setActiveModule] = useState<ProtocolModule>(protocolModules[0]);

  const { data: stats } = useQuery({
    queryKey: ["auth", "public-stats"],
    queryFn: fetchPublicStats,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const rating = stats?.rating ?? null;

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
      className="relative flex min-h-[100dvh] lg:h-[100dvh] lg:max-h-[100dvh] items-center justify-center overflow-y-auto lg:overflow-hidden px-4 py-3 text-foreground sm:px-6 lg:px-8"
      style={{ backgroundColor: "#07080b" }}
      data-brand="AUREUS"
    >
      {/* Background glow and imperial subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 22% 12%, rgba(197,160,89,0.12), transparent 60%)," +
            "radial-gradient(55% 50% at 88% 92%, rgba(197,160,89,0.06), transparent 65%)," +
            "linear-gradient(180deg, #07080b 0%, #0d0f14 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(197,160,89,0.05) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(197,160,89,0.05) 1px, transparent 1px)",
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
        className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8"
      >
        {/* Brand & Lore Panel (Desktop) */}
        <section className="mx-auto hidden w-full max-w-xl flex-col justify-between gap-4 lg:flex">
          {/* Header Sigil + Brand */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] overflow-hidden shadow-[0_0_20px_rgba(197,160,89,0.22)] shrink-0 flex items-center justify-center">
              <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
              <Rocket className="hidden" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-baseline gap-2.5">
                <span className="font-serif text-2xl font-black tracking-[0.22em] text-[#F4F4F6] uppercase leading-none">
                  AUREUS
                </span>
                <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-[#C5A059] uppercase leading-none">
                  Operating System
                </span>
              </div>
            </div>
          </div>

          {/* Title & Introduction */}
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight tracking-wide text-[#F4F4F6] lg:text-[26px]">
              {title}
            </h1>
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-[#94a3b8]">{body}</p>
          </div>

          {/* Matrice Interattiva dei Moduli del Protocollo */}
          <div className="rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/90 p-4 shadow-xl backdrop-blur-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#C5A059]">
                Dotazione del Protocollo · Moduli Operativi
              </span>
              <span className="font-mono text-[9px] text-[#8E8E98] uppercase">
                Tocca per ispezionare
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {protocolModules.map((mod, idx) => {
                const isUnlocked = mod.unlockedIn.includes(selectedTier);
                const isSelected = activeModule.id === mod.id;
                const isLast = idx === protocolModules.length - 1;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActiveModule(mod)}
                    onMouseEnter={() => setActiveModule(mod)}
                    className={`group flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all cursor-pointer ${
                      isLast ? "col-span-2" : ""
                    } ${
                      isSelected
                        ? "border-[#E8C56A] bg-[#1a1c29] shadow-[0_0_12px_rgba(197,160,89,0.25)]"
                        : "border-[#25252E] bg-[#07080b]/70 hover:border-[#C5A059]/40 hover:bg-[#11131c]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                          isUnlocked
                            ? "border-[#C5A059]/40 bg-[#0d0f14] text-[#E8C56A]"
                            : "border-[#25252E] bg-[#07080b] text-[#555]"
                        }`}
                      >
                        {mod.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-mono text-[10px] sm:text-[10.5px] font-bold leading-tight ${
                            isSelected ? "text-[#E8C56A]" : "text-[#F4F4F6]"
                          }`}
                        >
                          {mod.title}
                        </p>
                        <p className="font-mono text-[8.5px] text-[#8E8E98] leading-tight mt-0.5">
                          {mod.category}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`font-mono text-[7.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap border ${
                        isUnlocked
                          ? "border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]"
                          : "border-[#25252E] bg-[#11131c] text-[#777]"
                      }`}
                    >
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Check className="h-2 w-2" /> ATTIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <Lock className="h-2 w-2" /> BLOCCATO
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tactical Micro-Inspector HUD */}
            <div className="mt-2.5 rounded-lg border border-[#C5A059]/25 bg-[#07080b]/95 p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#E8C56A]">
                    <Info className="h-4 w-4 text-[#C5A059] shrink-0" />
                    <span>{activeModule.title}</span>
                  </div>
                  <p className="text-[#94a3b8] font-mono text-[10px] font-normal mt-0.5">
                    {activeModule.category}
                  </p>
                </div>
                <span
                  className={`font-mono text-[8.5px] uppercase font-bold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                    activeModule.unlockedIn.includes(selectedTier)
                      ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981]"
                      : "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#E8C56A]"
                  }`}
                >
                  {activeModule.unlockedIn.includes(selectedTier)
                    ? "Incluso nel Piano"
                    : "Dotazione Superiore"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#F4F4F6] font-normal">
                {activeModule.detail}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-[#C5A059]">
                <strong className="uppercase text-[#E8C56A]">Regola del Custode:</strong>
                <span className="text-[#C5A059]/90">{activeModule.rule}</span>
              </div>
            </div>
          </div>

          {/* I 5 Gradi di Ascesa dell'Ordine */}
          <div className="rounded-xl border border-[#C5A059]/20 bg-[#0d0f14]/80 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#C5A059]">
                I 5 Gradi di Ascesa dell'Ordine
              </span>
              <span className="font-mono text-[8.5px] text-[#8E8E98] uppercase">
                Punto di Partenza: Grado I
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center font-mono text-[8.5px]">
              <div className="rounded border border-[#C5A059] bg-[#C5A059]/20 py-1 font-bold text-[#E8C56A] shadow-[0_0_8px_rgba(197,160,89,0.25)] whitespace-nowrap">
                I. Novizio
              </div>
              <div className="rounded border border-[#25252E] bg-[#11131c]/60 py-1 text-[#8E8E98] whitespace-nowrap">
                II. Custode
              </div>
              <div className="rounded border border-[#25252E] bg-[#11131c]/60 py-1 text-[#8E8E98] whitespace-nowrap">
                III. Sovrano
              </div>
              <div className="rounded border border-[#25252E] bg-[#11131c]/60 py-1 text-[#8E8E98] whitespace-nowrap">
                IV. Architetto
              </div>
              <div className="rounded border border-[#25252E] bg-[#11131c]/60 py-1 text-[#8E8E98] whitespace-nowrap">
                V. Fondatore
              </div>
            </div>
          </div>

          {/* Sigilli di Rigore Crittografico & Stats */}
          <div className="flex flex-col gap-2 pt-0.5">
            <div className="grid grid-cols-3 gap-2">
              {trust.map(({ icon: Icon, title: rowTitle }) => (
                <div
                  key={rowTitle}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#C5A059]/25 bg-[#0d0f14]/85 px-2 py-1.5 text-center shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-[#C5A059] shrink-0" aria-hidden="true" />
                  <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#F4F4F6] leading-tight">
                    {rowTitle}
                  </span>
                </div>
              ))}
            </div>

            {/* Real-time rating telemetria */}
            {rating && rating.count > 0 && (
              <div className="flex items-center justify-between border-t border-[#25252E] pt-2 text-[11px] text-[#8E8E98]">
                <div className="flex items-center gap-1 text-[#C5A059]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3 w-3 fill-current" aria-hidden="true" />
                  ))}
                  <strong className="font-mono font-bold text-[#F4F4F6] ml-1">
                    {rating.average.toFixed(1)}/5
                  </strong>
                </div>
                <span>
                  {rating.count} {t("auth.shell.social.reviews")}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right Flank: Form Card & Terminale del Varco */}
        <section className="mx-auto w-full max-w-[500px] lg:justify-self-end">
          <div className="relative rounded-2xl border border-[#C5A059]/40 bg-[#0d0f14]/95 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-5">
            {/* Architectural Imperial Corners */}
            <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-[#E8C56A] pointer-events-none" />
            <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-[#E8C56A] pointer-events-none" />
            <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-[#E8C56A] pointer-events-none" />
            <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-[#E8C56A] pointer-events-none" />

            {/* Mobile Header */}
            <div className="mb-3 flex items-center justify-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#141418] overflow-hidden">
                <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
              </span>
              <span className="font-serif text-sm font-bold tracking-wider text-[#F4F4F6] uppercase">
                AUREUS
              </span>
            </div>

            {/* Mode Toggle */}
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[#25252E] bg-[#07080b] p-0.5">
              <Link href="/sign-in" className={`${toggleBase} ${isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signin")}
              </Link>
              <Link href="/sign-up" className={`${toggleBase} ${!isSignIn ? toggleActive : toggleIdle}`}>
                {t("auth.toggle.signup")}
              </Link>
            </div>

            {/* Rilevamento Codice Candidatura se già inviato */}
            {candidateCode && (
              <div className="mb-2.5 flex items-center justify-between rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 px-3 py-1 text-[10px] font-mono text-[#10b981]">
                <span className="font-bold uppercase tracking-wider">✦ Candidatura Rilevata</span>
                <span className="font-bold tracking-tight">{candidateCode}</span>
              </div>
            )}

            {/* Flusso di Candidatura & Registrazione (2 Passi) o Accesso Diretto */}
            {!isSignIn ? (
              signUpStep === 1 ? (
                /* PASSO 1: Dossier di Selezione e Patto di Disciplina */
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-[#25252E] pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[9px] font-bold">
                        1
                      </span>
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#F4F4F6]">
                        Dossier di Candidatura
                      </span>
                    </div>
                    <span className="rounded border border-[#C5A059]/40 bg-[#C5A059]/10 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#E8C56A]">
                      Valutazione del Custode
                    </span>
                  </div>

                  {/* Selettore Dotazione Candidatura */}
                  <div className="rounded-xl border border-[#C5A059]/35 bg-[#07080b]/95 p-2.5 shadow-inner">
                    <div className="mb-1.5 flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#C5A059]">
                        Dotazione Richiesta
                      </span>
                      {/* Toggle Mensile / Annuale */}
                      <div className="inline-flex items-center rounded border border-[#C5A059]/30 bg-[#141418] p-0.5">
                        <button
                          type="button"
                          onClick={() => handleCycleChange("monthly")}
                          className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            billingCycle === "monthly"
                              ? "bg-[#C5A059] text-[#07080b]"
                              : "text-[#8E8E98] hover:text-[#F4F4F6]"
                          }`}
                        >
                          Mensile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCycleChange("yearly")}
                          className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            billingCycle === "yearly"
                              ? "bg-[#C5A059] text-[#07080b]"
                              : "text-[#8E8E98] hover:text-[#F4F4F6]"
                          }`}
                        >
                          Annuale (-17%)
                        </button>
                      </div>
                    </div>

                    {/* 3 Tier Pills */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => handleTierChange("base_free")}
                        className={`flex flex-col items-center justify-center rounded-lg border p-1 text-center transition-all cursor-pointer ${
                          selectedTier === "base_free"
                            ? "border-[#E8C56A] bg-[#C5A059]/20 shadow-[0_0_12px_rgba(197,160,89,0.25)] ring-1 ring-[#E8C56A]/60"
                            : "border-[#25252E] bg-[#11131c]/60 hover:border-[#C5A059]/40"
                        }`}
                      >
                        <span className="font-mono text-[8.5px] font-bold text-[#F4F4F6] uppercase">Soglia Base</span>
                        <span className="font-mono text-xs font-extrabold text-[#C5A059] whitespace-nowrap">0 €</span>
                        <span className="font-mono text-[7px] text-[#8E8E98] uppercase">Inclusa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTierChange("founders_10")}
                        className={`relative flex flex-col items-center justify-center rounded-lg border p-1 text-center transition-all cursor-pointer ${
                          selectedTier === "founders_10"
                            ? "border-[#E8C56A] bg-[#C5A059]/20 shadow-[0_0_12px_rgba(197,160,89,0.25)] ring-1 ring-[#E8C56A]/60"
                            : "border-[#25252E] bg-[#11131c]/60 hover:border-[#C5A059]/40"
                        }`}
                      >
                        <span className="absolute -top-1.5 rounded bg-[#10b981] px-1 py-0 font-mono text-[6.5px] font-bold uppercase text-[#07080b]">
                          {billingCycle === "monthly" ? "Promo 14G" : "Top Scelta"}
                        </span>
                        <span className="font-mono text-[8.5px] font-bold text-[#F4F4F6] uppercase">Dotazione</span>
                        <span className="font-mono text-xs font-extrabold text-[#C5A059] whitespace-nowrap">
                          {billingCycle === "monthly" ? "2,60 €" : "100 €/a"}
                        </span>
                        <span className="font-mono text-[7px] text-[#8E8E98] uppercase">
                          {billingCycle === "monthly" ? "14 giorni" : "+Forgia +Rischio"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTierChange("complete_150")}
                        className={`flex flex-col items-center justify-center rounded-lg border p-1 text-center transition-all cursor-pointer ${
                          selectedTier === "complete_150"
                            ? "border-[#E8C56A] bg-[#C5A059]/20 shadow-[0_0_12px_rgba(197,160,89,0.25)] ring-1 ring-[#E8C56A]/60"
                            : "border-[#25252E] bg-[#11131c]/60 hover:border-[#C5A059]/40"
                        }`}
                      >
                        <span className="font-mono text-[8.5px] font-bold text-[#F4F4F6] uppercase">Completo</span>
                        <span className="font-mono text-xs font-extrabold text-[#C5A059] whitespace-nowrap">
                          {billingCycle === "monthly" ? "150 €/m" : "1.500 €/a"}
                        </span>
                        <span className="font-mono text-[7px] text-[#8E8E98] uppercase">+Dottrina +Tornei</span>
                      </button>
                    </div>

                    {/* Nome Operativo & Recapito Custode */}
                    <div className="grid grid-cols-2 gap-2 mb-1.5">
                      <div className="rounded-lg border border-[#25252E] bg-[#11131c]/80 p-1.5">
                        <span className="block mb-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#C5A059]">
                          Nome o Pseudonimo *
                        </span>
                        <input
                          type="text"
                          value={candidateName}
                          onChange={(e) => handleCandidateNameChange(e.target.value)}
                          placeholder="Es. Marco R."
                          className="w-full rounded border border-[#C5A059]/25 bg-[#07080b] px-2 py-1 font-mono text-xs text-[#F4F4F6] placeholder-[#555] focus:border-[#C5A059] focus:outline-none"
                        />
                      </div>

                      <div className="rounded-lg border border-[#25252E] bg-[#11131c]/80 p-1.5">
                        <div className="flex items-center justify-between mb-1 text-[8.5px]">
                          <span className="font-mono font-bold uppercase tracking-wider text-[#C5A059]">
                            Recapito Custode *
                          </span>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleContactChannelChange("whatsapp")}
                              className={`rounded px-1 py-0 font-mono text-[7.5px] font-bold uppercase transition-all ${
                                contactChannel === "whatsapp"
                                  ? "bg-[#10b981] text-[#07080b]"
                                  : "text-[#8E8E98] hover:text-[#F4F4F6]"
                              }`}
                            >
                              WA
                            </button>
                            <button
                              type="button"
                              onClick={() => handleContactChannelChange("telegram")}
                              className={`rounded px-1 py-0 font-mono text-[7.5px] font-bold uppercase transition-all ${
                                contactChannel === "telegram"
                                  ? "bg-[#38bdf8] text-[#07080b]"
                                  : "text-[#8E8E98] hover:text-[#F4F4F6]"
                              }`}
                            >
                              TG
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={contactHandle}
                          onChange={(e) => handleContactHandleChange(e.target.value)}
                          placeholder={contactChannel === "whatsapp" ? "+39 340..." : "@username"}
                          className="w-full rounded border border-[#C5A059]/25 bg-[#07080b] px-2 py-1 font-mono text-xs text-[#F4F4F6] placeholder-[#555] focus:border-[#C5A059] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[8.5px]">
                      <span className="text-[#8E8E98] truncate max-w-[240px]">
                        {selectedTier === "base_free" && "Varco + Libro della Verità + Fratellanza"}
                        {selectedTier === "founders_10" && "Base + Forgia del Passato + Architettura"}
                        {selectedTier === "complete_150" && "Dotazione Totale + Dottrina + Tornei"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomModalOpen(true)}
                        className="font-mono text-[#C5A059] hover:underline font-bold uppercase tracking-wider shrink-0 ml-1 cursor-pointer"
                      >
                        Confronta Servizi ↗
                      </button>
                    </div>
                  </div>

                  {/* Motivazione d'Ingresso per la Selezione */}
                  <div className="rounded-xl border border-[#25252E] bg-[#11131c]/80 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#C5A059]">
                        Motivazione d'Ingresso per la Selezione *
                      </span>
                      <span className="font-mono text-[8px] text-[#8E8E98]">
                        Perché intendi unirti?
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={motivation}
                      onChange={(e) => handleMotivationChange(e.target.value)}
                      placeholder="Spiega per quale motivo intendi unirti ad AUREUS e quale obiettivo operativo intendi raggiungere..."
                      className="w-full resize-none rounded border border-[#C5A059]/25 bg-[#07080b] p-1.5 font-mono text-[10.5px] leading-relaxed text-[#F4F4F6] placeholder-[#555] focus:border-[#C5A059] focus:outline-none"
                    />
                  </div>

                  {/* Patto di Disciplina & Integrità */}
                  <label className="flex items-start gap-2 rounded-xl border border-[#C5A059]/30 bg-[#07080b]/90 p-2 cursor-pointer transition hover:border-[#C5A059]/60">
                    <input
                      type="checkbox"
                      checked={commitmentAccepted}
                      onChange={(e) => handleCommitmentChange(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-[#C5A059] bg-[#11131c] text-[#C5A059] accent-[#C5A059] cursor-pointer shrink-0"
                    />
                    <div className="flex-1 text-[9.5px] leading-snug text-[#8E8E98]">
                      <span className="font-bold text-[#F4F4F6] block mb-0.5 font-mono uppercase text-[8.5px] tracking-wide">
                        Patto di Disciplina & Integrità *
                      </span>
                      Dichiaro di essere disposto a sottomettermi alle regole matematiche dell'Ordine, eliminare ogni deriva emotiva e rispettare con rigore L'Ordine Giornaliero.
                    </div>
                  </label>

                  {/* Errore di Validazione */}
                  {candidacyError && (
                    <div className="rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1 text-[9.5px] font-mono text-[#ef4444] text-center">
                      {candidacyError}
                    </div>
                  )}

                  {/* Procedi al Passo 2 */}
                  <button
                    type="button"
                    onClick={handleProceedToCredentials}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C5A059] bg-gradient-to-r from-[#C5A059] via-[#E8C56A] to-[#C5A059] py-2 text-xs font-bold uppercase tracking-wider text-[#07080b] shadow-[0_0_16px_rgba(197,160,89,0.3)] transition hover:brightness-110 cursor-pointer active:scale-[0.99]"
                  >
                    <span>Conferma Candidatura e Vai al Varco</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                /* PASSO 2: Creazione Credenziali e Associazione Candidatura */
                <div className="flex flex-col gap-2">
                  {/* Riepilogo Sintetico Dossier */}
                  <div className="rounded-xl border border-[#C5A059]/40 bg-[#07080b] p-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-[#25252E] pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-[#10b981]/20 text-[#10b981] font-mono text-[9px] font-bold">
                          ✓
                        </span>
                        <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#E8C56A]">
                          Dossier Pronto per il Custode
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSignUpStep(1)}
                        className="font-mono text-[8.5px] text-[#C5A059] hover:underline font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Modifica Dossier ✎
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[9.5px] font-mono">
                      <div className="truncate">
                        <span className="text-[#555] block text-[7.5px] uppercase">Operatore</span>
                        <span className="text-[#F4F4F6] font-bold truncate block">{candidateName}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[#555] block text-[7.5px] uppercase">Dotazione</span>
                        <span className="text-[#C5A059] font-bold truncate block">
                          {selectedTier === "base_free" ? "Soglia Base" : selectedTier === "founders_10" ? "Prime Persone" : "Completo"}
                        </span>
                      </div>
                      <div className="truncate">
                        <span className="text-[#555] block text-[7.5px] uppercase">Recapito</span>
                        <span className="text-[#F4F4F6] font-bold truncate block">{contactHandle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-b border-[#25252E] pb-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-[#C5A059]/20 text-[#E8C56A] font-mono text-[9px] font-bold">
                        2
                      </span>
                      <span className="font-mono font-bold uppercase tracking-wider text-[#F4F4F6]">
                        Chiavi d'Accesso Personali
                      </span>
                    </div>
                    <span className="font-mono text-[8px] text-[#8E8E98] uppercase">
                      Crittografia Sovrana
                    </span>
                  </div>

                  {/* Clerk Form (SignUp) */}
                  {children}

                  <p className="text-center font-mono text-[9px] text-[#8E8E98] leading-tight">
                    Le credenziali create assoceranno il tuo account al Dossier di Candidatura per la selezione del Custode.
                  </p>
                </div>
              )
            ) : (
              /* Accesso Diretto (Sign In) */
              <div className="flex flex-col gap-2">
                {/* Clerk Form (SignIn) */}
                {children}

                <p className="text-center font-mono text-[9.5px] text-[#8E8E98] leading-tight">
                  Hai già inviato la candidatura? Accedi per visualizzare lo stato di revisione.
                </p>
              </div>
            )}

            {/* Footer Sovrano e Conformità Legale (Senza Collisioni Orizzontali) */}
            <div className="mt-3 flex flex-col items-center gap-1 border-t border-[#25252E] pt-2 text-center">
              <div className="text-[10px] text-[#8E8E98]">
                <span>{t("auth.shell.legal.intro")} </span>
                <Link href="/terms" className="text-[#C5A059] hover:underline font-medium">
                  {t("auth.shell.legal.terms")}
                </Link>
                <span> · </span>
                <Link href="/privacy" className="text-[#C5A059] hover:underline font-medium">
                  {t("auth.shell.legal.privacy")}
                </Link>
              </div>
              <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[#C5A059]/90">
                <ShieldCheck className="h-3 w-3 text-[#C5A059] shrink-0" aria-hidden="true" />
                <span>{t("auth.shell.footer.secure")}</span>
              </div>
            </div>
          </div>
        </section>
      </motion.div>

      {/* Dossier di Confronto e Dotazione */}
      <LimenCandidacyModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        defaultTierId={selectedTier}
        defaultBillingCycle={billingCycle}
        onSelectPlanAndCycle={(tier, cycle) => {
          handleTierChange(tier);
          handleCycleChange(cycle);
        }}
      />
    </main>
  );
}
