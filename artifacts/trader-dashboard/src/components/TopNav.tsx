import { BrandMark } from "@/components/BrandMark";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { motion } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
import {
  Volume2,
  VolumeX,
  ScrollText,
  Coins,
  Shield,
  Award,
  FlaskConical,
  TrendingUp,
  BookOpen,
  Package,
  Globe,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { useGetProfile } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFinancialProfile } from "@/lib/financialProfileApi";
import { useFreeTrial } from "@/lib/useFreeTrial";
import { useClerk } from "@clerk/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { apiJSON } from "@/lib/apiFetch";
import { getLimenPageQuote } from "@/lib/limenPageQuotes";
import { computeLimenIntegritySnapshot, type LimenIntegritySnapshot } from "../../../../contracts/limenGrades";
import { openThresholdManifesto } from "@/components/onboarding/ThresholdOfSelectionModal";

export function TopNav() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const pageQuote = getLimenPageQuote(location, search);
  const { data: financialProfile } = useFinancialProfile();
  const { isFreeTrial } = useFreeTrial();
  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-status"],
    queryFn: () => apiJSON("milestones/admin/status"),
    staleTime: 60_000,
  });
  const isAdmin = adminStatus?.isAdmin ?? false;
  const { mode, setMode } = useAudio();
  const { t } = useLanguage();
  const { signOut } = useClerk();
  const { data: profile } = useGetProfile();
  const isPlaying = mode !== "off";
  const avatarSrc =
    profile && profile.avatarUrl
      ? profile.avatarUrl
      : `${import.meta.env.BASE_URL}images/avatar-default.webp`;
  const profileName = profile?.name ?? "Operatore";
  const { data: serverIntegrity } = useQuery<LimenIntegritySnapshot>({
    queryKey: ["profile-integrity"],
    queryFn: () => apiJSON("profile/integrity"),
    staleTime: 30_000,
  });
  const integritySnapshot =
    serverIntegrity ??
    computeLimenIntegritySnapshot({
      legacyLevel: profile?.level ?? 1,
      consecutiveIntegralSessions: profile?.streak ?? 0,
    });

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.0 }}
      className="app-top-nav fixed top-0 left-0 right-0 z-40 lg:left-[var(--app-inset-left)]"
    >
      <div className="bg-background/95 backdrop-blur-md border-b border-border pt-[var(--safe-top)]">
        <div className="mx-auto flex h-[var(--app-header-height)] max-w-[1840px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-5 xl:px-7">
          {/* Brand — mobile/tablet only */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="lg:hidden shrink-0"
          >
            <Link href="/">
              <BrandMark />
            </Link>
          </motion.div>

          {/* Divider — mobile only */}
          <div className="w-px h-4 bg-border/60 lg:hidden shrink-0" />

          {/* Thematic Philosophical Quote */}
          <motion.div
            className="flex-1 min-w-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <motion.div
              key={pageQuote}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="hidden lg:flex items-center min-w-0 pr-4 select-none"
              title={pageQuote}
            >
              <span className="text-primary/70 font-serif text-sm mr-2 leading-none shrink-0">“</span>
              <span className="text-xs sm:text-[13px] font-serif italic tracking-wide text-foreground/85 truncate">
                {pageQuote}
              </span>
              <span className="text-primary/70 font-serif text-sm ml-1 leading-none shrink-0">”</span>
            </motion.div>
          </motion.div>

          {/* Right controls */}
          <motion.div
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            {/* Il Manifesto trigger */}
            <button
              type="button"
              onClick={openThresholdManifesto}
              title={"Il Manifesto — La Soglia di Selezione"}
              className="hidden lg:inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ScrollText className="h-3.5 w-3.5 text-primary" />
              <span>{"Il Manifesto"}</span>
            </button>

            {/* Architettura Patrimoniale quick pill */}
            {!isFreeTrial && (
              <Link
                href="/patrimonio"
                title="Architettura Patrimoniale & Fondamenta di Rischio"
                className={`hidden lg:inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  financialProfile?.isCompleted
                    ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                <Coins className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {financialProfile?.isCompleted ? "Patrimonio: Attivo" : "Patrimonio: Setup"}
                </span>
              </Link>
            )}

            {/* Audio toggle */}
            <motion.button
              type="button"
              aria-label={isPlaying ? "Disattiva audio focus" : "Attiva audio focus"}
              whileTap={{ scale: 0.88 }}
              onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
              className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
                isPlaying
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
              title={isPlaying ? "Frequenza Operativa Attiva" : "Frequenza Operativa Spenta"}
            >
              {isPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </motion.button>

            {/* Operator Dossier avatar */}
            <motion.div whileTap={{ scale: 0.88 }} className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("profile.open_settings")}
                    title={t("profile.settings")}
                    className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-primary hover:bg-primary/10"
                  >
                    <ProfileAvatar
                      name={profileName}
                      src={avatarSrc}
                      alt={t("profile.alt", { name: profileName })}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-[#0A0A0C]/85 py-px text-center font-mono text-[7px] font-bold uppercase tracking-wider text-primary">
                      {integritySnapshot.currentGrade.roman}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 sm:w-80 rounded-lg border border-[#C5A059]/35 bg-[#0C0D12]/98 backdrop-blur-xl p-0 shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_24px_rgba(197,160,89,0.15)] text-foreground overflow-hidden"
                >
                  {/* OPERATOR DOSSIER HEADER */}
                  <div className="p-3.5 border-b border-[#C5A059]/20 bg-gradient-to-b from-[#181924] via-[#0F1017] to-[#0A0B0E]">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-md overflow-hidden border border-[#C5A059]/60 shadow-md bg-black">
                          <ProfileAvatar
                            name={profileName}
                            src={avatarSrc}
                            alt={t("profile.alt", { name: profileName })}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-px rounded-sm bg-[#C5A059] text-black font-mono text-[8px] font-black shadow-sm">
                          {integritySnapshot.currentGrade.roman}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="font-bold text-sm text-[#F4F4F6] truncate tracking-wide">
                            {profileName}
                          </p>
                          <span className="px-1.5 py-0.5 rounded-sm font-mono text-[8.5px] font-bold uppercase tracking-wider bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 shrink-0">
                            {integritySnapshot.currentGrade.code}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {integritySnapshot.currentGrade.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[9.5px]">
                          <span className="text-emerald-400 font-semibold">
                            Integrità: {integritySnapshot.integrityIndex}%
                          </span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="text-[#C5A059] font-medium">
                            Streak: {profile?.streak ?? 0}d
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MENU BODY (CATEGORIZED) */}
                  <div className="p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
                    {/* SEZIONE 1: RANGO & IDENTITÀ */}
                    <div className="px-2.5 pt-2 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#C5A059]/90">
                      Rango &amp; Identità
                    </div>

                    <DropdownMenuItem
                      onSelect={() => navigate("/settings?section=profilo")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          Dossier dell&apos;Operatore
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Profilo, credenziali e licenza</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0" />
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={() => navigate("/milestones")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          I 5 Gradi di Ascesa
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Sigilli di Investitura &amp; NFT</p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded font-mono text-[8.5px] font-bold uppercase bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 shrink-0">
                        {integritySnapshot.currentGrade.code}
                      </span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-white/10 my-1" />

                    {/* SEZIONE 2: METODO & DOTTRINA */}
                    <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Dottrina &amp; Operatività
                    </div>

                    <DropdownMenuItem
                      onSelect={() => navigate("/backtest")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <FlaskConical className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          La Forgia del Passato
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Simulazione storica e backtest</p>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={() => navigate("/protocollo")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          Protocollo Scalp &amp; Swing
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Schematiche e modelli operativi</p>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={() => navigate("/academy")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <BookOpen className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          La Dottrina del Tempo
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Sessioni e finestre di liquidità</p>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-white/10 my-1" />

                    {/* SEZIONE 3: PATRIMONIO & ARSENALE */}
                    <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Patrimonio &amp; Dotazioni
                    </div>

                    {!isFreeTrial && (
                      <DropdownMenuItem
                        onSelect={() => navigate("/patrimonio")}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                          <Coins className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                            Architettura Patrimoniale
                          </p>
                          <p className="text-[9.5px] text-muted-foreground">Pilastri e riserve di capitale</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[8.5px] font-bold uppercase shrink-0 ${
                          financialProfile?.isCompleted
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30"
                        }`}>
                          {financialProfile?.isCompleted ? "Attivo" : "Setup"}
                        </span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className="bg-white/10 my-1" />

                    {/* SEZIONE 4: MANIFESTO & SISTEMA */}
                    <DropdownMenuItem
                      onSelect={openThresholdManifesto}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <ScrollText className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          La Soglia di Selezione
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Il Manifesto di Ingresso</p>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={() => navigate("/settings?section=lingua")}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-[#C5A059] group-hover:border-[#C5A059]/30">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                          Lingua / Language
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">Preferenze di localizzazione</p>
                      </div>
                    </DropdownMenuItem>

                    {isAdmin && (
                      <DropdownMenuItem
                        onSelect={() => navigate("/admin")}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm hover:bg-[#C5A059]/10 hover:text-[#F4E1B3] transition-colors group"
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059] group-hover:border-[#C5A059]/50">
                          <Shield className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground/90 group-hover:text-primary truncate">
                            Pannello di Controllo
                          </p>
                          <p className="text-[9.5px] text-muted-foreground">Console Amministrazione</p>
                        </div>
                        <span className="px-1.5 py-0.5 rounded font-mono text-[8.5px] font-bold uppercase shrink-0 bg-primary/20 text-primary border border-primary/30">
                          Admin
                        </span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className="bg-white/10 my-1" />

                    {/* SEZIONE 5: SESSIONE */}
                    <DropdownMenuItem
                      onSelect={() => void signOut({ redirectUrl: "/" })}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono cursor-pointer rounded-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors group mt-0.5"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-rose-500/25 bg-rose-500/10 text-rose-400 group-hover:border-rose-500/40">
                        <LogOut className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">Disconnetti Sessione</p>
                        <p className="text-[9.5px] text-muted-foreground group-hover:text-rose-300/70">
                          Esci in sicurezza dal Protocollo
                        </p>
                      </div>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}

