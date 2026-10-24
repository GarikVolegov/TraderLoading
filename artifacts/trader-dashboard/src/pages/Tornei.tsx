import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { parseSocialLocation } from "@/lib/chatTabs";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Target, Users, Timer, CheckCircle, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ArenaView } from "@/components/tornei/ArenaView";
import { PercorsoView } from "@/components/tornei/PercorsoView";
import { CertModal } from "@/components/tornei/CertModal";
import { BacktestTournamentHub } from "@/components/backtest-tournament/BacktestTournamentHub";
import { Button } from "@/components/ui/button";
import { countdownParts, pad2 } from "@/components/tornei/format";
import {
  fetchTorneiCurrent,
  fetchTorneiStandings,
  fetchTorneiMe,
  fetchTorneiHall,
  fetchTorneiWallet,
  enrollTornei,
  claimTorneiCertificate,
  torneiCurrentKey,
  torneiStandingsKey,
  torneiMeKey,
  torneiHallKey,
  torneiWalletKey,
  type TorneiMetric,
  type TorneiCertificate,
} from "@/lib/torneiApi";
import "@/components/tornei/tornei.css";

type Dir = "arena" | "percorso" | "battaglie";

export default function Tornei() {
  return <PageLayout fullWidth><TorneiWorkspace /></PageLayout>;
}

export function TorneiWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const [, navigate] = useLocation();
  const location = parseSocialLocation(search);
  const dir: Dir = location.competitionView === "battaglie" ? "battaglie" : location.competitionView === "percorso" ? "percorso" : "arena";
  const metric: TorneiMetric = location.metric;
  const setDir = (value: Dir) => {
    if (value === "battaglie") {
      navigate(`/chat${updateWorkspaceQuery(search, { t: "competizioni", vista: "battaglie", sub: "backtest" })}`);
    } else {
      navigate(`/chat${updateWorkspaceQuery(search, { t: "competizioni", vista: value === "arena" ? "torneo" : "percorso", sub: null })}`);
    }
  };
  const setMetric = (value: TorneiMetric) => navigate(`/chat${updateWorkspaceQuery(search, { t: "competizioni", metrica: value })}`);
  const [selectedCert, setSelectedCert] = useState<TorneiCertificate | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const walletQuery = useQuery({ queryKey: torneiWalletKey(), queryFn: () => fetchTorneiWallet() });
  const hasWallet = Boolean(walletQuery.data?.walletAddress);
  const mintEnabled = walletQuery.data?.mintEnabled ?? false;

  const currentQuery = useQuery({ queryKey: torneiCurrentKey(), queryFn: () => fetchTorneiCurrent() });
  const standingsQuery = useQuery({
    queryKey: torneiStandingsKey(metric),
    queryFn: () => fetchTorneiStandings(metric),
    enabled: dir === "arena",
  });
  const meQuery = useQuery({ queryKey: torneiMeKey(), queryFn: () => fetchTorneiMe(), enabled: dir === "percorso" });
  const hallQuery = useQuery({ queryKey: torneiHallKey(), queryFn: () => fetchTorneiHall(), enabled: dir === "percorso" });

  const enrollMutation = useMutation({
    mutationFn: () => enrollTornei(true),
    onSuccess: (res) => {
      if (res.ok) {
        toast({ title: t("tornei.enroll.success") });
        qc.invalidateQueries({ queryKey: torneiCurrentKey() });
        qc.invalidateQueries({ queryKey: torneiMeKey() });
      } else {
        const key = `tornei.enroll.error.${res.reason}`;
        const title = t(key);
        toast({ title: title === key ? t("tornei.enroll.error.generic") : title, variant: "destructive" });
      }
    },
    onError: () => toast({ title: t("tornei.enroll.error.generic"), variant: "destructive" }),
  });

  // enrollTornei's `consent` param is recorded server-side as the user's
  // agreement to the contest rules + public pseudonymous leaderboard — it
  // must reflect an actual confirmation, not be hardcoded true.
  const handleEnroll = () => {
    if (!window.confirm(t("tornei.consent"))) return;
    enrollMutation.mutate();
  };

  const claimMutation = useMutation({
    mutationFn: (id: number) => claimTorneiCertificate(id),
    onSuccess: (res) => {
      if (res.certificate) setSelectedCert(res.certificate);
      qc.invalidateQueries({ queryKey: torneiMeKey() });
    },
    onError: (error) => {
      const title =
        (error as { status?: number })?.status === 503
          ? t("tornei.cert.mintSoon")
          : t("tornei.cert.failed");
      toast({ title, variant: "destructive" });
    },
  });

  const current = currentQuery.data;
  const season = current?.season;
  const target = season ? (season.status === "upcoming" ? Date.parse(season.startsAt) : Date.parse(season.endsAt)) : 0;
  const showCountdown = Boolean(season && season.status !== "ended");

  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showCountdown]);

  const c = countdownParts(target, now);
  const countdownFormatted = `${c.d}d : ${pad2(c.h)}h : ${pad2(c.m)}m : ${pad2(c.s)}s`;

  const visibleQueries = dir === "arena"
    ? [currentQuery, standingsQuery]
    : [currentQuery, meQuery, hallQuery];
  const failed = visibleQueries.some((query) => query.isError);

  return (
    <div
      className={embedded ? "trn-page trn-embedded h-[calc(100dvh-var(--safe-top)-13.2rem-var(--bottom-nav-clearance))] min-h-0 flex flex-col overflow-hidden w-full" : "trn-page"}
      data-screen-label="Tornei"
    >
      <div
        className="trn-wrap"
        style={embedded ? { padding: 0, maxWidth: "100%", width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" } : undefined}
      >
        {/* Header Telemetria a Tutta Larghezza (~48px) */}
        <header className="flex-none flex items-center justify-between gap-3 px-3.5 py-2 mb-2 rounded-xl border border-[#C5A059]/25 bg-[#0D0E14] text-white w-full overflow-x-auto">
          {/* Sezione Sinistra: Titolo Torneo & Status */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] shrink-0">
              <Trophy size={14} />
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-white whitespace-nowrap">
                Torneo Mensile {season?.label ? `// ${season.label}` : ""}
              </h2>
              {season && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#C5A059]/35 bg-[#C5A059]/10 px-2.5 py-0.5 font-mono text-[9.5px] text-[#E8C56A] font-bold whitespace-nowrap shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C5A059] animate-pulse shrink-0" />
                  {season.status === "live" ? "IN CORSO" : season.status === "upcoming" ? "PROSSIMO" : "CONCLUSO"}
                </span>
              )}
              {current && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#26262E] bg-[#141418] font-mono text-[10px] text-slate-300 whitespace-nowrap shrink-0">
                  <Users size={11} className="text-[#C5A059] shrink-0" />
                  <strong className="text-white">{current.totalPlayers}</strong>&nbsp;{t("tornei.inGara", { n: "" }).trim()}
                </span>
              )}
            </div>
          </div>

          {/* Sezione Centro: Conto alla Rovescia & Progresso */}
          {season && (
            <div className="hidden md:flex items-center gap-2.5 font-mono text-xs text-slate-300 shrink-0">
              <div className="flex items-center gap-2 bg-[#07080B] border border-[#26262E] rounded-lg px-2.5 py-1 whitespace-nowrap shrink-0">
                <Timer size={12} className="text-[#C5A059] shrink-0" />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{t("tornei.countdown")}:</span>
                <span className="text-[#E8C56A] font-bold text-xs font-mono whitespace-nowrap tracking-wide">
                  {showCountdown ? countdownFormatted : t("tornei.status.ended")}
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-2 bg-[#07080B] border border-[#26262E] rounded-lg px-2.5 py-1 text-[10px] whitespace-nowrap shrink-0">
                <span className="text-slate-400 whitespace-nowrap">Mese:</span>
                <div className="w-16 h-1.5 bg-[#181920] rounded-full border border-[#26262E] overflow-hidden shrink-0">
                  <div
                    className="h-full bg-gradient-to-r from-[#9C772C] to-[#C5A059]"
                    style={{ width: `${Math.round(current.progress * 100)}%` }}
                  />
                </div>
                <span className="text-[#E8C56A] font-bold whitespace-nowrap">{Math.round(current.progress * 100)}%</span>
              </div>
            </div>
          )}

          {/* Sezione Destra: Stato Iscrizione & Switcher Vista */}
          <div className="flex items-center gap-2 flex-none">
            {/* Bottone / Badge Iscrizione */}
            {current && (
              <button
                type="button"
                disabled={current.enrolled || enrollMutation.isPending}
                onClick={handleEnroll}
                className={`h-7 px-3 rounded-lg font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  current.enrolled
                    ? "bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/40 cursor-default"
                    : "bg-gradient-to-r from-[#9C772C] to-[#C5A059] text-black hover:brightness-110 shadow-sm"
                }`}
              >
                {enrollMutation.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t("tornei.cta.enrolling")}
                  </>
                ) : current.enrolled ? (
                  <>
                    <CheckCircle size={12} />
                    {t("tornei.cta.enrolled")}
                  </>
                ) : (
                  t("tornei.cta.enroll")
                )}
              </button>
            )}

            {/* Segmented View Switcher */}
            <div className="inline-flex rounded-lg border border-[#26262E] bg-[#07080B] p-0.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDir("arena")}
                className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                  dir === "arena"
                    ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Trophy size={12} />
                {t("tornei.tab.arena")}
              </button>
              <button
                type="button"
                onClick={() => setDir("percorso")}
                className={`px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 ${
                  dir === "percorso"
                    ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Target size={12} />
                {t("tornei.tab.percorso")}
              </button>
            </div>
          </div>
        </header>

        {/* Contenuto Principale: Cockpit Zero-Scroll */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
          {dir === "battaglie" ? (
            <BacktestTournamentHub />
          ) : failed ? (
            <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center my-auto">
              <p>{t("common.load_error")}</p>
              <Button
                variant="outline"
                disabled={visibleQueries.some((query) => query.isFetching)}
                onClick={() => { void Promise.all(visibleQueries.map((query) => query.refetch())); }}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : currentQuery.isPending || !current ? (
            <div className="flex items-center justify-center flex-1 min-h-0 text-slate-400 font-mono text-sm">
              {t("tornei.loading")}
            </div>
          ) : dir === "arena" ? (
            <ArenaView
              current={current}
              standings={standingsQuery.data}
              metric={metric}
              onMetric={setMetric}
              enrolling={enrollMutation.isPending}
              onEnroll={handleEnroll}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PercorsoView
                me={meQuery.data}
                hall={hallQuery.data?.entries ?? []}
                enrolling={enrollMutation.isPending}
                onEnroll={handleEnroll}
                onCertClick={setSelectedCert}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modale Certificato NFT Selezionato */}
      <CertModal
        cert={selectedCert}
        claiming={claimMutation.isPending}
        hasWallet={hasWallet}
        mintEnabled={mintEnabled}
        onClaim={(id) => claimMutation.mutate(id)}
        onClose={() => setSelectedCert(null)}
      />
    </div>
  );
}
